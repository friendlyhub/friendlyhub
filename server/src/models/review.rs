use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::helpers;
use crate::db::Db;
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Review {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub reviewer_id: Uuid,
    pub decision: String,
    pub comment: String,
    pub created_at: DateTime<Utc>,
}

impl Review {
    fn to_item(&self) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        // Reviews are stored under the submission's PK for easy querying
        item.insert("PK".into(), AttributeValue::S(format!("SUB#{}", self.submission_id)));
        item.insert("SK".into(), AttributeValue::S(format!("REV#{}", self.id)));
        item.insert("id".into(), AttributeValue::S(self.id.to_string()));
        item.insert("submission_id".into(), AttributeValue::S(self.submission_id.to_string()));
        item.insert("reviewer_id".into(), AttributeValue::S(self.reviewer_id.to_string()));
        item.insert("decision".into(), AttributeValue::S(self.decision.clone()));
        item.insert("comment".into(), AttributeValue::S(self.comment.clone()));
        item.insert("created_at".into(), AttributeValue::S(self.created_at.to_rfc3339()));
        item.insert("entity_type".into(), AttributeValue::S("Review".into()));
        item
    }

    fn from_item(item: &HashMap<String, AttributeValue>) -> Result<Self, AppError> {
        Ok(Self {
            id: helpers::get_uuid(item, "id")?,
            submission_id: helpers::get_uuid(item, "submission_id")?,
            reviewer_id: helpers::get_uuid(item, "reviewer_id")?,
            decision: helpers::get_string(item, "decision")?,
            comment: helpers::get_string(item, "comment")?,
            created_at: helpers::get_datetime(item, "created_at")?,
        })
    }
}

pub async fn create(
    db: &Db,
    submission_id: Uuid,
    reviewer_id: Uuid,
    decision: &str,
    comment: &str,
) -> Result<Review, AppError> {
    let rev = Review {
        id: Uuid::new_v4(),
        submission_id,
        reviewer_id,
        decision: decision.to_string(),
        comment: comment.to_string(),
        created_at: Utc::now(),
    };

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(rev.to_item()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(rev)
}

pub async fn list_by_submission(db: &Db, submission_id: Uuid) -> Result<Vec<Review>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .key_condition_expression("PK = :pk AND begins_with(SK, :prefix)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("SUB#{submission_id}")))
        .expression_attribute_values(":prefix", AttributeValue::S("REV#".into()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    result.items().iter().map(|item| Review::from_item(item)).collect()
}
