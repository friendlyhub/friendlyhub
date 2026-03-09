use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::db::Db;
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub github_id: i64,
    pub github_login: String,
    pub display_name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub github_access_token: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub github_login: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            github_login: u.github_login,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            role: u.role,
            created_at: u.created_at,
        }
    }
}

impl User {
    fn to_item(&self) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S(format!("USER#{}", self.id)));
        item.insert("SK".into(), AttributeValue::S(format!("USER#{}", self.id)));
        item.insert("GSI1PK".into(), AttributeValue::S(format!("GHID#{}", self.github_id)));
        item.insert("GSI1SK".into(), AttributeValue::S(format!("USER#{}", self.id)));
        item.insert("id".into(), AttributeValue::S(self.id.to_string()));
        item.insert("github_id".into(), AttributeValue::N(self.github_id.to_string()));
        item.insert("github_login".into(), AttributeValue::S(self.github_login.clone()));
        item.insert("display_name".into(), AttributeValue::S(self.display_name.clone()));
        if let Some(ref e) = self.email {
            item.insert("email".into(), AttributeValue::S(e.clone()));
        }
        if let Some(ref a) = self.avatar_url {
            item.insert("avatar_url".into(), AttributeValue::S(a.clone()));
        }
        item.insert("role".into(), AttributeValue::S(self.role.clone()));
        if let Some(ref t) = self.github_access_token {
            item.insert("github_access_token".into(), AttributeValue::S(t.clone()));
        }
        item.insert("created_at".into(), AttributeValue::S(self.created_at.to_rfc3339()));
        item.insert("updated_at".into(), AttributeValue::S(self.updated_at.to_rfc3339()));
        item.insert("entity_type".into(), AttributeValue::S("User".into()));
        item
    }

    pub(crate) fn from_item(item: &HashMap<String, AttributeValue>) -> Result<Self, AppError> {
        Ok(Self {
            id: super::helpers::get_uuid(item, "id")?,
            github_id: super::helpers::get_i64(item, "github_id")?,
            github_login: super::helpers::get_string(item, "github_login")?,
            display_name: super::helpers::get_string(item, "display_name")?,
            email: super::helpers::get_string_opt(item, "email"),
            avatar_url: super::helpers::get_string_opt(item, "avatar_url"),
            role: super::helpers::get_string(item, "role")?,
            github_access_token: super::helpers::get_string_opt(item, "github_access_token"),
            created_at: super::helpers::get_datetime(item, "created_at")?,
            updated_at: super::helpers::get_datetime(item, "updated_at")?,
        })
    }
}

pub async fn upsert_from_github(
    db: &Db,
    github_id: i64,
    github_login: &str,
    display_name: &str,
    email: Option<&str>,
    avatar_url: Option<&str>,
    access_token: Option<&str>,
) -> Result<User, AppError> {
    let existing = find_by_github_id(db, github_id).await?;
    let now = Utc::now();

    let user = match existing {
        Some(mut u) => {
            u.github_login = github_login.to_string();
            u.display_name = display_name.to_string();
            if let Some(e) = email {
                u.email = Some(e.to_string());
            }
            if let Some(a) = avatar_url {
                u.avatar_url = Some(a.to_string());
            }
            if let Some(t) = access_token {
                u.github_access_token = Some(t.to_string());
            }
            u.updated_at = now;
            u
        }
        None => User {
            id: Uuid::new_v4(),
            github_id,
            github_login: github_login.to_string(),
            display_name: display_name.to_string(),
            email: email.map(String::from),
            avatar_url: avatar_url.map(String::from),
            role: "developer".to_string(),
            github_access_token: access_token.map(String::from),
            created_at: now,
            updated_at: now,
        },
    };

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(user.to_item()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(user)
}

async fn find_by_github_id(db: &Db, github_id: i64) -> Result<Option<User>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("GHID#{github_id}")))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    match result.items().first() {
        Some(item) => Ok(Some(User::from_item(item)?)),
        None => Ok(None),
    }
}

pub async fn list_all(db: &Db) -> Result<Vec<User>, AppError> {
    let mut users = Vec::new();
    let mut exclusive_start_key = None;

    loop {
        let mut scan = db
            .client
            .scan()
            .table_name(&db.table)
            .filter_expression("entity_type = :et")
            .expression_attribute_values(":et", AttributeValue::S("User".into()));

        if let Some(key) = exclusive_start_key {
            scan = scan.set_exclusive_start_key(Some(key));
        }

        let result = scan
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("DynamoDB scan failed: {e}")))?;

        for item in result.items() {
            users.push(User::from_item(item)?);
        }

        match result.last_evaluated_key() {
            Some(key) => exclusive_start_key = Some(key.to_owned()),
            None => break,
        }
    }

    users.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(users)
}

pub async fn update_role(db: &Db, id: Uuid, role: &str) -> Result<(), AppError> {
    let key = format!("USER#{id}");
    db.client
        .update_item()
        .table_name(&db.table)
        .key("PK", AttributeValue::S(key.clone()))
        .key("SK", AttributeValue::S(key))
        .update_expression("SET #r = :role, updated_at = :now")
        .expression_attribute_names("#r", "role")
        .expression_attribute_values(":role", AttributeValue::S(role.to_string()))
        .expression_attribute_values(":now", AttributeValue::S(Utc::now().to_rfc3339()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB update_item failed: {e}")))?;
    Ok(())
}

pub async fn delete(db: &Db, id: Uuid) -> Result<(), AppError> {
    let key = format!("USER#{id}");
    db.client
        .delete_item()
        .table_name(&db.table)
        .key("PK", AttributeValue::S(key.clone()))
        .key("SK", AttributeValue::S(key))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB delete_item failed: {e}")))?;
    Ok(())
}

pub async fn find_by_id(db: &Db, id: Uuid) -> Result<Option<User>, AppError> {
    let key = format!("USER#{id}");
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
        Some(item) => Ok(Some(User::from_item(item)?)),
        None => Ok(None),
    }
}
