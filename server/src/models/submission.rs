use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::helpers;
use crate::db::Db;
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Submission {
    pub id: Uuid,
    pub app_id: Uuid,
    pub submitter_id: Uuid,
    pub version: String,
    pub manifest: serde_json::Value,
    pub source_ref: Option<String>,
    pub status: String,
    pub gha_run_id: Option<i64>,
    pub gha_run_url: Option<String>,
    pub fm_build_id: Option<i32>,
    pub build_log_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Valid status transitions:
/// pending_build -> building -> build_failed | pending_review
/// pending_review -> approved | changes_requested
/// approved -> published
const VALID_TRANSITIONS: &[(&str, &str)] = &[
    ("pending_build", "building"),
    ("building", "build_failed"),
    ("building", "pending_review"),
    ("pending_review", "approved"),
    ("pending_review", "changes_requested"),
    ("approved", "published"),
];

pub fn is_valid_transition(from: &str, to: &str) -> bool {
    VALID_TRANSITIONS
        .iter()
        .any(|(f, t)| *f == from && *t == to)
}

impl Submission {
    fn to_item(&self) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S(format!("SUB#{}", self.id)));
        item.insert("SK".into(), AttributeValue::S(format!("SUB#{}", self.id)));
        // GSI1: query by status (for review queue)
        item.insert("GSI1PK".into(), AttributeValue::S(format!("STATUS#{}", self.status)));
        item.insert("GSI1SK".into(), AttributeValue::S(format!("SUB#{}", self.created_at.to_rfc3339())));
        // GSI2: query by submitter
        item.insert("GSI2PK".into(), AttributeValue::S(format!("SUBMITTER#{}", self.submitter_id)));
        item.insert("GSI2SK".into(), AttributeValue::S(format!("SUB#{}", self.created_at.to_rfc3339())));
        item.insert("id".into(), AttributeValue::S(self.id.to_string()));
        item.insert("app_id".into(), AttributeValue::S(self.app_id.to_string()));
        item.insert("submitter_id".into(), AttributeValue::S(self.submitter_id.to_string()));
        item.insert("version".into(), AttributeValue::S(self.version.clone()));
        item.insert("manifest".into(), AttributeValue::S(self.manifest.to_string()));
        if let Some(ref sr) = self.source_ref {
            item.insert("source_ref".into(), AttributeValue::S(sr.clone()));
        }
        item.insert("status".into(), AttributeValue::S(self.status.clone()));
        if let Some(rid) = self.gha_run_id {
            item.insert("gha_run_id".into(), AttributeValue::N(rid.to_string()));
        }
        if let Some(ref url) = self.gha_run_url {
            item.insert("gha_run_url".into(), AttributeValue::S(url.clone()));
        }
        if let Some(fid) = self.fm_build_id {
            item.insert("fm_build_id".into(), AttributeValue::N(fid.to_string()));
        }
        if let Some(ref url) = self.build_log_url {
            item.insert("build_log_url".into(), AttributeValue::S(url.clone()));
        }
        item.insert("created_at".into(), AttributeValue::S(self.created_at.to_rfc3339()));
        item.insert("updated_at".into(), AttributeValue::S(self.updated_at.to_rfc3339()));
        item.insert("entity_type".into(), AttributeValue::S("Submission".into()));
        item
    }

    fn from_item(item: &HashMap<String, AttributeValue>) -> Result<Self, AppError> {
        Ok(Self {
            id: helpers::get_uuid(item, "id")?,
            app_id: helpers::get_uuid(item, "app_id")?,
            submitter_id: helpers::get_uuid(item, "submitter_id")?,
            version: helpers::get_string(item, "version")?,
            manifest: helpers::get_json(item, "manifest")?,
            source_ref: helpers::get_string_opt(item, "source_ref"),
            status: helpers::get_string(item, "status")?,
            gha_run_id: helpers::get_i64_opt(item, "gha_run_id"),
            gha_run_url: helpers::get_string_opt(item, "gha_run_url"),
            fm_build_id: helpers::get_i32_opt(item, "fm_build_id"),
            build_log_url: helpers::get_string_opt(item, "build_log_url"),
            created_at: helpers::get_datetime(item, "created_at")?,
            updated_at: helpers::get_datetime(item, "updated_at")?,
        })
    }
}

pub async fn create(
    db: &Db,
    app_id: Uuid,
    submitter_id: Uuid,
    version: &str,
    manifest: &serde_json::Value,
) -> Result<Submission, AppError> {
    let now = Utc::now();
    let sub = Submission {
        id: Uuid::new_v4(),
        app_id,
        submitter_id,
        version: version.to_string(),
        manifest: manifest.clone(),
        source_ref: None,
        status: "pending_build".to_string(),
        gha_run_id: None,
        gha_run_url: None,
        fm_build_id: None,
        build_log_url: None,
        created_at: now,
        updated_at: now,
    };

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(sub.to_item()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(sub)
}

pub async fn find_by_id(db: &Db, id: Uuid) -> Result<Option<Submission>, AppError> {
    let key = format!("SUB#{id}");
    let result = db
        .client
        .get_item()
        .table_name(&db.table)
        .key("PK", AttributeValue::S(key.clone()))
        .key("SK", AttributeValue::S(key))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB get_item failed: {e}")))?;

    match result.item() {
        Some(item) => Ok(Some(Submission::from_item(item)?)),
        None => Ok(None),
    }
}

pub async fn list_by_submitter(db: &Db, submitter_id: Uuid) -> Result<Vec<Submission>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .index_name("GSI2")
        .key_condition_expression("GSI2PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("SUBMITTER#{submitter_id}")))
        .scan_index_forward(false)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    result.items().iter().map(|item| Submission::from_item(item)).collect()
}

pub async fn list_by_status(db: &Db, status: &str) -> Result<Vec<Submission>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("STATUS#{status}")))
        .scan_index_forward(true)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    result.items().iter().map(|item| Submission::from_item(item)).collect()
}

pub async fn list_by_app(db: &Db, app_id: Uuid) -> Result<Vec<Submission>, AppError> {
    // Scan with filter — acceptable at low volume
    let result = db
        .client
        .scan()
        .table_name(&db.table)
        .filter_expression("entity_type = :et AND app_id = :aid")
        .expression_attribute_values(":et", AttributeValue::S("Submission".into()))
        .expression_attribute_values(":aid", AttributeValue::S(app_id.to_string()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB scan failed: {e}")))?;

    let mut subs: Vec<Submission> = result.items().iter().map(|item| Submission::from_item(item)).collect::<Result<Vec<_>, _>>()?;
    subs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(subs)
}

async fn save(db: &Db, sub: &Submission) -> Result<(), AppError> {
    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(sub.to_item()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;
    Ok(())
}

pub async fn update_status(db: &Db, id: Uuid, new_status: &str) -> Result<Submission, AppError> {
    let mut sub = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
    sub.status = new_status.to_string();
    sub.updated_at = Utc::now();
    save(db, &sub).await?;
    Ok(sub)
}

pub async fn set_build_info(db: &Db, id: Uuid, gha_run_id: i64, gha_run_url: &str) -> Result<(), AppError> {
    let mut sub = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
    sub.gha_run_id = Some(gha_run_id);
    sub.gha_run_url = Some(gha_run_url.to_string());
    sub.status = "building".to_string();
    sub.updated_at = Utc::now();
    save(db, &sub).await
}

pub async fn set_fm_build_id(db: &Db, id: Uuid, fm_build_id: i32) -> Result<(), AppError> {
    let mut sub = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
    sub.fm_build_id = Some(fm_build_id);
    sub.updated_at = Utc::now();
    save(db, &sub).await
}

pub async fn set_build_log_url(db: &Db, id: Uuid, url: &str) -> Result<(), AppError> {
    let mut sub = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
    sub.build_log_url = Some(url.to_string());
    sub.updated_at = Utc::now();
    save(db, &sub).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_transitions_accepted() {
        assert!(is_valid_transition("pending_build", "building"));
        assert!(is_valid_transition("building", "build_failed"));
        assert!(is_valid_transition("building", "pending_review"));
        assert!(is_valid_transition("pending_review", "approved"));
        assert!(is_valid_transition("pending_review", "changes_requested"));
        assert!(is_valid_transition("approved", "published"));
    }

    #[test]
    fn invalid_transitions_rejected() {
        assert!(!is_valid_transition("pending_build", "approved"));
        assert!(!is_valid_transition("building", "published"));
        assert!(!is_valid_transition("pending_review", "building"));
        assert!(!is_valid_transition("approved", "changes_requested"));
        assert!(!is_valid_transition("published", "pending_build"));
    }

    #[test]
    fn backward_transitions_rejected() {
        assert!(!is_valid_transition("building", "pending_build"));
        assert!(!is_valid_transition("pending_review", "building"));
        assert!(!is_valid_transition("published", "approved"));
    }

    #[test]
    fn same_status_rejected() {
        assert!(!is_valid_transition("building", "building"));
        assert!(!is_valid_transition("pending_review", "pending_review"));
    }

    #[test]
    fn unknown_status_rejected() {
        assert!(!is_valid_transition("pending_build", "bogus"));
        assert!(!is_valid_transition("nonexistent", "building"));
    }
}
