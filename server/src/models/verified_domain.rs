use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::helpers;
use crate::db::Db;
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedDomain {
    pub domain: String,
    pub user_id: Uuid,
    pub token: String,
    pub verified: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl VerifiedDomain {
    fn to_item(&self) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S(format!("DOMAIN#{}", self.domain)));
        item.insert("SK".into(), AttributeValue::S(format!("USER#{}", self.user_id)));
        item.insert("domain".into(), AttributeValue::S(self.domain.clone()));
        item.insert("user_id".into(), AttributeValue::S(self.user_id.to_string()));
        item.insert("token".into(), AttributeValue::S(self.token.clone()));
        item.insert("verified".into(), AttributeValue::Bool(self.verified));
        if let Some(ref v) = self.verified_at {
            item.insert("verified_at".into(), AttributeValue::S(v.to_rfc3339()));
        }
        item.insert("created_at".into(), AttributeValue::S(self.created_at.to_rfc3339()));
        item.insert("entity_type".into(), AttributeValue::S("VerifiedDomain".into()));
        item
    }

    fn from_item(item: &HashMap<String, AttributeValue>) -> Result<Self, AppError> {
        Ok(Self {
            domain: helpers::get_string(item, "domain")?,
            user_id: helpers::get_uuid(item, "user_id")?,
            token: helpers::get_string(item, "token")?,
            verified: helpers::get_bool(item, "verified"),
            verified_at: helpers::get_string_opt(item, "verified_at")
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
            created_at: helpers::get_datetime(item, "created_at")?,
        })
    }
}

pub async fn find_by_domain_and_user(
    db: &Db,
    domain: &str,
    user_id: Uuid,
) -> Result<Option<VerifiedDomain>, AppError> {
    let result = db
        .client
        .get_item()
        .table_name(&db.table)
        .key("PK", AttributeValue::S(format!("DOMAIN#{domain}")))
        .key("SK", AttributeValue::S(format!("USER#{user_id}")))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB get_item failed: {e}")))?;

    match result.item() {
        Some(item) => Ok(Some(VerifiedDomain::from_item(item)?)),
        None => Ok(None),
    }
}

pub async fn create_or_get(
    db: &Db,
    domain: &str,
    user_id: Uuid,
) -> Result<VerifiedDomain, AppError> {
    if let Some(existing) = find_by_domain_and_user(db, domain, user_id).await? {
        return Ok(existing);
    }

    let token = generate_token();
    let record = VerifiedDomain {
        domain: domain.to_string(),
        user_id,
        token,
        verified: false,
        verified_at: None,
        created_at: Utc::now(),
    };

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(record.to_item()))
        .condition_expression("attribute_not_exists(PK) AND attribute_not_exists(SK)")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(record)
}

pub async fn mark_verified(
    db: &Db,
    domain: &str,
    user_id: Uuid,
) -> Result<(), AppError> {
    let now = Utc::now();
    db.client
        .update_item()
        .table_name(&db.table)
        .key("PK", AttributeValue::S(format!("DOMAIN#{domain}")))
        .key("SK", AttributeValue::S(format!("USER#{user_id}")))
        .update_expression("SET verified = :v, verified_at = :va")
        .expression_attribute_values(":v", AttributeValue::Bool(true))
        .expression_attribute_values(":va", AttributeValue::S(now.to_rfc3339()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB update_item failed: {e}")))?;
    Ok(())
}

fn generate_token() -> String {
    use rand::Rng;
    let mut rng = rand::rng();
    let bytes: [u8; 32] = rng.random();
    hex::encode(bytes)
}
