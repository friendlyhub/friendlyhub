use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::errors::AppError;

/// Result of validating a Flatpak manifest.
#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub parsed_app_id: Option<String>,
    pub parsed_runtime: Option<String>,
    pub parsed_sdk: Option<String>,
}

/// Minimal structure we expect from a Flatpak manifest.
/// Flatpak manifests can be JSON or YAML.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
struct FlatpakManifest {
    #[serde(alias = "id", alias = "app-id")]
    app_id: Option<String>,
    runtime: Option<String>,
    runtime_version: Option<String>,
    sdk: Option<String>,
    command: Option<String>,
    #[serde(default)]
    modules: Vec<Value>,
    #[serde(default)]
    finish_args: Vec<String>,
}

/// Parse and validate a Flatpak manifest from a JSON value.
/// The manifest may have been originally submitted as YAML or JSON;
/// by this point it should already be a serde_json::Value.
pub fn validate(manifest: &Value) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let parsed: FlatpakManifest = match serde_json::from_value(manifest.clone()) {
        Ok(m) => m,
        Err(e) => {
            return ValidationResult {
                valid: false,
                errors: vec![format!("Failed to parse manifest: {e}")],
                warnings: vec![],
                parsed_app_id: None,
                parsed_runtime: None,
                parsed_sdk: None,
            };
        }
    };

    // Required fields
    let app_id = match &parsed.app_id {
        Some(id) => {
            validate_app_id(id, &mut errors);
            Some(id.clone())
        }
        None => {
            errors.push("Missing required field: app-id (or id)".into());
            None
        }
    };

    if parsed.runtime.is_none() {
        errors.push("Missing required field: runtime".into());
    }

    if parsed.sdk.is_none() {
        errors.push("Missing required field: sdk".into());
    }

    if parsed.command.is_none() {
        errors.push("Missing required field: command".into());
    }

    if parsed.modules.is_empty() {
        errors.push("Manifest must have at least one module".into());
    }

    // Warnings (non-blocking)
    if parsed.runtime_version.is_none() {
        warnings.push("No runtime-version specified; build may use an unpredictable version".into());
    }

    if parsed.finish_args.is_empty() {
        warnings.push("No finish-args specified; app will have no permissions".into());
    }

    // Check for dangerous permissions
    check_permissions(&parsed.finish_args, &mut warnings);

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
        parsed_app_id: app_id,
        parsed_runtime: parsed.runtime,
        parsed_sdk: parsed.sdk,
    }
}

/// Parse a manifest from YAML or JSON string into a serde_json::Value.
pub fn parse_manifest_str(input: &str) -> Result<Value, AppError> {
    // Try JSON first, then YAML
    if let Ok(v) = serde_json::from_str::<Value>(input) {
        return Ok(v);
    }
    serde_yaml::from_str::<Value>(input)
        .map_err(|e| AppError::BadRequest(format!("Invalid manifest format (not valid JSON or YAML): {e}")))
}

fn validate_app_id(app_id: &str, errors: &mut Vec<String>) {
    // Flatpak app IDs must be reverse-DNS with at least 3 components
    let parts: Vec<&str> = app_id.split('.').collect();
    if parts.len() < 3 {
        errors.push(format!(
            "app-id '{app_id}' must have at least 3 components (e.g. org.example.App)"
        ));
        return;
    }

    for part in &parts {
        if part.is_empty() {
            errors.push(format!("app-id '{app_id}' has an empty component"));
            return;
        }
        if !part.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
            errors.push(format!(
                "app-id '{app_id}' contains invalid characters (only alphanumeric, _ and - allowed)"
            ));
            return;
        }
    }
}

/// Parse a manifest from YAML string into a serde_json::Value.
pub fn parse_yaml_manifest(input: &str) -> Result<Value, AppError> {
    serde_yaml::from_str::<Value>(input)
        .map_err(|e| AppError::BadRequest(format!("Invalid YAML manifest: {e}")))
}

fn check_permissions(finish_args: &[String], warnings: &mut Vec<String>) {
    let dangerous = [
        ("--filesystem=host", "Full host filesystem access"),
        ("--filesystem=/", "Root filesystem access"),
        ("--socket=system-bus", "Full system D-Bus access"),
        ("--device=all", "Access to all devices"),
    ];

    for arg in finish_args {
        for (pattern, desc) in &dangerous {
            if arg == *pattern {
                warnings.push(format!("Dangerous permission: {desc} ({pattern})"));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_manifest() -> Value {
        json!({
            "app-id": "org.example.TestApp",
            "runtime": "org.freedesktop.Platform",
            "runtime-version": "24.08",
            "sdk": "org.freedesktop.Sdk",
            "command": "test-app",
            "modules": [{"name": "test-app", "buildsystem": "simple"}],
            "finish-args": ["--share=ipc", "--socket=fallback-x11"]
        })
    }

    #[test]
    fn valid_manifest_passes() {
        let result = validate(&valid_manifest());
        assert!(result.valid, "errors: {:?}", result.errors);
        assert_eq!(result.parsed_app_id.as_deref(), Some("org.example.TestApp"));
        assert_eq!(result.parsed_runtime.as_deref(), Some("org.freedesktop.Platform"));
        assert_eq!(result.parsed_sdk.as_deref(), Some("org.freedesktop.Sdk"));
    }

    #[test]
    fn missing_app_id_fails() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("app-id");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("app-id")));
    }

    #[test]
    fn missing_runtime_fails() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("runtime");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("runtime")));
    }

    #[test]
    fn missing_sdk_fails() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("sdk");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("sdk")));
    }

    #[test]
    fn missing_command_fails() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("command");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("command")));
    }

    #[test]
    fn empty_modules_fails() {
        let mut m = valid_manifest();
        m["modules"] = json!([]);
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("module")));
    }

    #[test]
    fn app_id_two_components_fails() {
        let mut m = valid_manifest();
        m["app-id"] = json!("org.example");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("3 components")));
    }

    #[test]
    fn app_id_empty_component_fails() {
        let mut m = valid_manifest();
        m["app-id"] = json!("org..App");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("empty component")));
    }

    #[test]
    fn app_id_invalid_chars_fails() {
        let mut m = valid_manifest();
        m["app-id"] = json!("org.example.My App");
        let result = validate(&m);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("invalid characters")));
    }

    #[test]
    fn app_id_with_hyphens_passes() {
        let mut m = valid_manifest();
        m["app-id"] = json!("org.my-project.My-App");
        let result = validate(&m);
        assert!(result.valid, "errors: {:?}", result.errors);
    }

    #[test]
    fn id_alias_works() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("app-id");
        m["id"] = json!("org.example.AliasApp");
        let result = validate(&m);
        assert!(result.valid, "errors: {:?}", result.errors);
        assert_eq!(result.parsed_app_id.as_deref(), Some("org.example.AliasApp"));
    }

    #[test]
    fn missing_runtime_version_warns() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("runtime-version");
        let result = validate(&m);
        assert!(result.valid);
        assert!(result.warnings.iter().any(|w| w.contains("runtime-version")));
    }

    #[test]
    fn no_finish_args_warns() {
        let mut m = valid_manifest();
        m.as_object_mut().unwrap().remove("finish-args");
        let result = validate(&m);
        assert!(result.valid);
        assert!(result.warnings.iter().any(|w| w.contains("finish-args")));
    }

    #[test]
    fn dangerous_filesystem_host_warns() {
        let mut m = valid_manifest();
        m["finish-args"] = json!(["--filesystem=host"]);
        let result = validate(&m);
        assert!(result.valid);
        assert!(result.warnings.iter().any(|w| w.contains("host filesystem")));
    }

    #[test]
    fn dangerous_device_all_warns() {
        let mut m = valid_manifest();
        m["finish-args"] = json!(["--device=all"]);
        let result = validate(&m);
        assert!(result.valid);
        assert!(result.warnings.iter().any(|w| w.contains("all devices")));
    }

    #[test]
    fn safe_permissions_no_warning() {
        let m = valid_manifest(); // has --share=ipc, --socket=fallback-x11
        let result = validate(&m);
        assert!(result.valid);
        assert!(!result.warnings.iter().any(|w| w.contains("Dangerous")));
    }

    #[test]
    fn garbage_input_fails() {
        let result = validate(&json!("not an object"));
        assert!(!result.valid);
        assert!(result.errors[0].contains("parse"));
    }

    #[test]
    fn parse_manifest_str_json() {
        let input = r#"{"app-id": "org.example.App"}"#;
        let v = parse_manifest_str(input).unwrap();
        assert_eq!(v["app-id"], "org.example.App");
    }

    #[test]
    fn parse_manifest_str_yaml() {
        let input = "app-id: org.example.App\nruntime: org.freedesktop.Platform\n";
        let v = parse_manifest_str(input).unwrap();
        assert_eq!(v["app-id"], "org.example.App");
    }

    #[test]
    fn parse_manifest_str_invalid() {
        let result = parse_manifest_str("{{{{not valid");
        assert!(result.is_err());
    }
}
