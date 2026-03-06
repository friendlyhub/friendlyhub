use aws_sdk_dynamodb::types::AttributeValue;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::db::Db;
use crate::errors::AppError;
use crate::models::helpers;
use crate::services::manifest;
use std::collections::HashMap;

/// Result of a single automated check.
#[derive(Debug, Serialize)]
pub struct CheckResult {
    pub check_name: String,
    /// "passed", "warning", "failed"
    pub status: String,
    pub message: Option<String>,
    pub details: Option<Value>,
}

/// Run all automated checks on a submission's manifest.
pub fn run_checks(manifest_value: &Value) -> Vec<CheckResult> {
    let mut results = Vec::new();
    results.push(check_manifest_lint(manifest_value));
    results.push(check_permissions_audit(manifest_value));
    results.push(check_metadata_completeness(manifest_value));
    results
}

/// Are all checks passing (no failures)?
pub fn all_passed(results: &[CheckResult]) -> bool {
    results.iter().all(|r| r.status != "failed")
}

/// Save check results to DynamoDB. Stored under the submission's PK with SK prefix CHK#.
pub async fn save_results(
    db: &Db,
    submission_id: Uuid,
    results: &[CheckResult],
) -> Result<(), AppError> {
    for result in results {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S(format!("SUB#{submission_id}")));
        item.insert("SK".into(), AttributeValue::S(format!("CHK#{}", result.check_name)));
        item.insert("submission_id".into(), AttributeValue::S(submission_id.to_string()));
        item.insert("check_name".into(), AttributeValue::S(result.check_name.clone()));
        item.insert("status".into(), AttributeValue::S(result.status.clone()));
        if let Some(ref msg) = result.message {
            item.insert("message".into(), AttributeValue::S(msg.clone()));
        }
        if let Some(ref det) = result.details {
            item.insert("details".into(), AttributeValue::S(det.to_string()));
        }
        item.insert("created_at".into(), AttributeValue::S(chrono::Utc::now().to_rfc3339()));
        item.insert("entity_type".into(), AttributeValue::S("Check".into()));

        db.client
            .put_item()
            .table_name(&db.table)
            .set_item(Some(item))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct CheckResultRow {
    pub check_name: String,
    pub status: String,
    pub message: Option<String>,
    pub details: Option<Value>,
}

/// Delete all check results for a submission.
pub async fn delete_results(db: &Db, submission_id: Uuid) -> Result<(), AppError> {
    let rows = get_results(db, submission_id).await?;
    for row in &rows {
        db.client
            .delete_item()
            .table_name(&db.table)
            .key("PK", AttributeValue::S(format!("SUB#{submission_id}")))
            .key("SK", AttributeValue::S(format!("CHK#{}", row.check_name)))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("DynamoDB delete_item failed: {e}")))?;
    }
    Ok(())
}

/// Load check results for a submission.
pub async fn get_results(db: &Db, submission_id: Uuid) -> Result<Vec<CheckResultRow>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .key_condition_expression("PK = :pk AND begins_with(SK, :prefix)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("SUB#{submission_id}")))
        .expression_attribute_values(":prefix", AttributeValue::S("CHK#".into()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    result
        .items()
        .iter()
        .map(|item| {
            Ok(CheckResultRow {
                check_name: helpers::get_string(item, "check_name")?,
                status: helpers::get_string(item, "status")?,
                message: helpers::get_string_opt(item, "message"),
                details: helpers::get_json_opt(item, "details"),
            })
        })
        .collect()
}

// --- Individual checks ---

fn check_manifest_lint(manifest_value: &Value) -> CheckResult {
    let validation = manifest::validate(manifest_value);

    if !validation.valid {
        return CheckResult {
            check_name: "manifest_lint".into(),
            status: "failed".into(),
            message: Some(format!("Manifest has errors: {}", validation.errors.join("; "))),
            details: Some(serde_json::json!({
                "errors": validation.errors,
                "warnings": validation.warnings,
            })),
        };
    }

    if !validation.warnings.is_empty() {
        return CheckResult {
            check_name: "manifest_lint".into(),
            status: "warning".into(),
            message: Some(format!("{} warning(s)", validation.warnings.len())),
            details: Some(serde_json::json!({
                "warnings": validation.warnings,
            })),
        };
    }

    CheckResult {
        check_name: "manifest_lint".into(),
        status: "passed".into(),
        message: None,
        details: None,
    }
}

fn check_permissions_audit(manifest_value: &Value) -> CheckResult {
    let finish_args: Vec<String> = manifest_value
        .get("finish-args")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let dangerous_patterns = [
        ("--filesystem=host", "Full host filesystem access — app can read/write all user files"),
        ("--filesystem=/", "Root filesystem access — app can read/write the entire system"),
        ("--socket=system-bus", "Full system D-Bus access — can control system services"),
        ("--device=all", "Access to all devices including input devices"),
        ("--share=network", ""),
    ];

    let mut flagged = Vec::new();
    for arg in &finish_args {
        for (pattern, desc) in &dangerous_patterns {
            if arg == *pattern && !desc.is_empty() {
                flagged.push(serde_json::json!({
                    "permission": pattern,
                    "concern": desc,
                }));
            }
        }
    }

    if !flagged.is_empty() {
        CheckResult {
            check_name: "permissions_audit".into(),
            status: "warning".into(),
            message: Some(format!("{} potentially dangerous permission(s) detected", flagged.len())),
            details: Some(serde_json::json!({ "flagged_permissions": flagged })),
        }
    } else {
        CheckResult {
            check_name: "permissions_audit".into(),
            status: "passed".into(),
            message: None,
            details: None,
        }
    }
}

fn check_metadata_completeness(manifest_value: &Value) -> CheckResult {
    let mut missing = Vec::new();
    let manifest_str = manifest_value.to_string();

    if !manifest_str.contains(".desktop") {
        missing.push("No .desktop file reference found — app may not appear in launchers");
    }

    if !manifest_str.contains(".metainfo.xml") && !manifest_str.contains(".appdata.xml") {
        missing.push("No AppStream metainfo/appdata file found — app store listings need this");
    }

    if missing.is_empty() {
        CheckResult {
            check_name: "metadata_completeness".into(),
            status: "passed".into(),
            message: None,
            details: None,
        }
    } else {
        CheckResult {
            check_name: "metadata_completeness".into(),
            status: "warning".into(),
            message: Some(format!("{} metadata concern(s)", missing.len())),
            details: Some(serde_json::json!({ "concerns": missing })),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn full_manifest() -> Value {
        json!({
            "app-id": "org.example.TestApp",
            "runtime": "org.freedesktop.Platform",
            "runtime-version": "24.08",
            "sdk": "org.freedesktop.Sdk",
            "command": "test-app",
            "modules": [{
                "name": "test-app",
                "buildsystem": "simple",
                "sources": [{"type": "file", "path": "org.example.TestApp.desktop"}],
                "build-commands": ["install -D org.example.TestApp.metainfo.xml"]
            }],
            "finish-args": ["--share=ipc", "--socket=fallback-x11"]
        })
    }

    #[test]
    fn run_checks_returns_three_results() {
        let results = run_checks(&full_manifest());
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn all_passed_with_clean_manifest() {
        let results = run_checks(&full_manifest());
        assert!(all_passed(&results));
    }

    #[test]
    fn all_passed_allows_warnings() {
        let results = vec![
            CheckResult { check_name: "a".into(), status: "passed".into(), message: None, details: None },
            CheckResult { check_name: "b".into(), status: "warning".into(), message: None, details: None },
        ];
        assert!(all_passed(&results));
    }

    #[test]
    fn all_passed_fails_on_failure() {
        let results = vec![
            CheckResult { check_name: "a".into(), status: "passed".into(), message: None, details: None },
            CheckResult { check_name: "b".into(), status: "failed".into(), message: None, details: None },
        ];
        assert!(!all_passed(&results));
    }

    #[test]
    fn manifest_lint_passes_valid() {
        let result = check_manifest_lint(&full_manifest());
        assert_eq!(result.status, "passed");
    }

    #[test]
    fn manifest_lint_fails_invalid() {
        let result = check_manifest_lint(&json!({"bogus": true}));
        assert_eq!(result.status, "failed");
    }

    #[test]
    fn manifest_lint_warns_on_missing_runtime_version() {
        let mut m = full_manifest();
        m.as_object_mut().unwrap().remove("runtime-version");
        let result = check_manifest_lint(&m);
        assert_eq!(result.status, "warning");
    }

    #[test]
    fn permissions_audit_passes_safe() {
        let result = check_permissions_audit(&full_manifest());
        assert_eq!(result.status, "passed");
    }

    #[test]
    fn permissions_audit_warns_filesystem_host() {
        let m = json!({"finish-args": ["--filesystem=host"]});
        let result = check_permissions_audit(&m);
        assert_eq!(result.status, "warning");
    }

    #[test]
    fn permissions_audit_warns_multiple_dangerous() {
        let m = json!({"finish-args": ["--filesystem=host", "--device=all"]});
        let result = check_permissions_audit(&m);
        assert_eq!(result.status, "warning");
    }

    #[test]
    fn permissions_audit_ignores_network() {
        let m = json!({"finish-args": ["--share=network"]});
        let result = check_permissions_audit(&m);
        assert_eq!(result.status, "passed");
    }

    #[test]
    fn metadata_passes_with_desktop_and_metainfo() {
        let result = check_metadata_completeness(&full_manifest());
        assert_eq!(result.status, "passed");
    }

    #[test]
    fn metadata_warns_missing_desktop() {
        let m = json!({"modules": [{"sources": [{"path": "org.example.TestApp.metainfo.xml"}]}]});
        let result = check_metadata_completeness(&m);
        assert_eq!(result.status, "warning");
    }

    #[test]
    fn metadata_warns_missing_both() {
        let m = json!({"modules": [{"sources": [{"path": "main.c"}]}]});
        let result = check_metadata_completeness(&m);
        assert_eq!(result.status, "warning");
    }

    #[test]
    fn metadata_accepts_appdata_xml() {
        let m = json!({"modules": [{"sources": [
            {"path": "org.example.App.desktop"},
            {"path": "org.example.App.appdata.xml"}
        ]}]});
        let result = check_metadata_completeness(&m);
        assert_eq!(result.status, "passed");
    }
}
