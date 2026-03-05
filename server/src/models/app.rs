use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::helpers;
use crate::db::Db;
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct App {
    pub id: Uuid,
    pub app_id: String,
    pub owner_id: Uuid,
    pub name: String,
    pub summary: String,
    pub description: String,
    pub categories: Vec<String>,
    pub homepage_url: Option<String>,
    pub source_url: Option<String>,
    pub license: Option<String>,
    pub is_published: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AppResponse {
    pub id: Uuid,
    pub app_id: String,
    pub owner_id: Uuid,
    pub name: String,
    pub summary: String,
    pub description: String,
    pub categories: Vec<String>,
    pub homepage_url: Option<String>,
    pub source_url: Option<String>,
    pub license: Option<String>,
    pub is_published: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

impl From<App> for AppResponse {
    fn from(a: App) -> Self {
        Self {
            id: a.id,
            app_id: a.app_id,
            owner_id: a.owner_id,
            name: a.name,
            summary: a.summary,
            description: a.description,
            categories: a.categories,
            homepage_url: a.homepage_url,
            source_url: a.source_url,
            license: a.license,
            is_published: a.is_published,
            is_verified: a.is_verified,
            created_at: a.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateApp {
    pub app_id: String,
    pub name: String,
    pub summary: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub categories: Vec<String>,
    pub homepage_url: Option<String>,
    pub source_url: Option<String>,
    pub license: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApp {
    pub name: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub categories: Option<Vec<String>>,
    pub homepage_url: Option<String>,
    pub source_url: Option<String>,
    pub license: Option<String>,
}

impl App {
    fn to_item(&self) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S(format!("APP#{}", self.id)));
        item.insert("SK".into(), AttributeValue::S(format!("APP#{}", self.id)));
        // GSI1: lookup by app_id string
        item.insert("GSI1PK".into(), AttributeValue::S(format!("APPID#{}", self.app_id)));
        item.insert("GSI1SK".into(), AttributeValue::S(format!("APP#{}", self.id)));
        // GSI2: lookup by owner
        item.insert("GSI2PK".into(), AttributeValue::S(format!("OWNER#{}", self.owner_id)));
        item.insert("GSI2SK".into(), AttributeValue::S(format!("APP#{}", self.created_at.to_rfc3339())));
        item.insert("id".into(), AttributeValue::S(self.id.to_string()));
        item.insert("app_id".into(), AttributeValue::S(self.app_id.clone()));
        item.insert("owner_id".into(), AttributeValue::S(self.owner_id.to_string()));
        item.insert("name".into(), AttributeValue::S(self.name.clone()));
        item.insert("summary".into(), AttributeValue::S(self.summary.clone()));
        item.insert("description".into(), AttributeValue::S(self.description.clone()));
        item.insert("categories".into(), helpers::string_list_to_av(&self.categories));
        if let Some(ref u) = self.homepage_url {
            item.insert("homepage_url".into(), AttributeValue::S(u.clone()));
        }
        if let Some(ref u) = self.source_url {
            item.insert("source_url".into(), AttributeValue::S(u.clone()));
        }
        if let Some(ref l) = self.license {
            item.insert("license".into(), AttributeValue::S(l.clone()));
        }
        item.insert("is_published".into(), AttributeValue::Bool(self.is_published));
        item.insert("is_verified".into(), AttributeValue::Bool(self.is_verified));
        item.insert("created_at".into(), AttributeValue::S(self.created_at.to_rfc3339()));
        item.insert("updated_at".into(), AttributeValue::S(self.updated_at.to_rfc3339()));
        item.insert("entity_type".into(), AttributeValue::S("App".into()));
        item
    }

    fn from_item(item: &HashMap<String, AttributeValue>) -> Result<Self, AppError> {
        Ok(Self {
            id: helpers::get_uuid(item, "id")?,
            app_id: helpers::get_string(item, "app_id")?,
            owner_id: helpers::get_uuid(item, "owner_id")?,
            name: helpers::get_string(item, "name")?,
            summary: helpers::get_string(item, "summary")?,
            description: helpers::get_string(item, "description")?,
            categories: helpers::get_string_list(item, "categories"),
            homepage_url: helpers::get_string_opt(item, "homepage_url"),
            source_url: helpers::get_string_opt(item, "source_url"),
            license: helpers::get_string_opt(item, "license"),
            is_published: helpers::get_bool(item, "is_published"),
            is_verified: helpers::get_bool(item, "is_verified"),
            created_at: helpers::get_datetime(item, "created_at")?,
            updated_at: helpers::get_datetime(item, "updated_at")?,
        })
    }
}

pub async fn create(db: &Db, owner_id: Uuid, input: &CreateApp) -> Result<App, AppError> {
    let now = Utc::now();
    let app = App {
        id: Uuid::new_v4(),
        app_id: input.app_id.clone(),
        owner_id,
        name: input.name.clone(),
        summary: input.summary.clone(),
        description: input.description.clone(),
        categories: input.categories.clone(),
        homepage_url: input.homepage_url.clone(),
        source_url: input.source_url.clone(),
        license: input.license.clone(),
        is_published: false,
        is_verified: false,
        created_at: now,
        updated_at: now,
    };

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(app.to_item()))
        .condition_expression("attribute_not_exists(PK)")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(app)
}

pub async fn find_by_app_id(db: &Db, app_id: &str) -> Result<Option<App>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("APPID#{app_id}")))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    match result.items().first() {
        Some(item) => Ok(Some(App::from_item(item)?)),
        None => Ok(None),
    }
}

pub async fn find_by_id(db: &Db, id: Uuid) -> Result<Option<App>, AppError> {
    let key = format!("APP#{id}");
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
        Some(item) => Ok(Some(App::from_item(item)?)),
        None => Ok(None),
    }
}

pub async fn list_by_owner(db: &Db, owner_id: Uuid) -> Result<Vec<App>, AppError> {
    let result = db
        .client
        .query()
        .table_name(&db.table)
        .index_name("GSI2")
        .key_condition_expression("GSI2PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("OWNER#{owner_id}")))
        .scan_index_forward(false)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB query failed: {e}")))?;

    result.items().iter().map(|item| App::from_item(item)).collect()
}

pub async fn list_published(
    db: &Db,
    search: Option<&str>,
    limit: i64,
    _offset: i64,
) -> Result<Vec<App>, AppError> {
    // Scan for published apps. For search, do client-side filtering.
    // At scale, this should be replaced with a search service (Phase 6: Meilisearch).
    let mut builder = db
        .client
        .scan()
        .table_name(&db.table)
        .filter_expression("entity_type = :et AND is_published = :pub")
        .expression_attribute_values(":et", AttributeValue::S("App".into()))
        .expression_attribute_values(":pub", AttributeValue::Bool(true))
        .limit(limit as i32);

    if let Some(q) = search {
        if !q.is_empty() {
            let q_lower = q.to_lowercase();
            // DynamoDB doesn't have full-text search, so we use contains on name+summary
            builder = builder
                .filter_expression("entity_type = :et AND is_published = :pub AND (contains(#n, :q) OR contains(summary, :q))")
                .expression_attribute_names("#n", "name")
                .expression_attribute_values(":q", AttributeValue::S(q_lower));
        }
    }

    let result = builder
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB scan failed: {e}")))?;

    let mut apps: Vec<App> = result.items().iter().map(|item| App::from_item(item)).collect::<Result<Vec<_>, _>>()?;
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(apps)
}

pub async fn update(db: &Db, id: Uuid, input: &UpdateApp) -> Result<App, AppError> {
    let mut app = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if let Some(ref n) = input.name { app.name = n.clone(); }
    if let Some(ref s) = input.summary { app.summary = s.clone(); }
    if let Some(ref d) = input.description { app.description = d.clone(); }
    if let Some(ref c) = input.categories { app.categories = c.clone(); }
    if let Some(ref h) = input.homepage_url { app.homepage_url = Some(h.clone()); }
    if let Some(ref s) = input.source_url { app.source_url = Some(s.clone()); }
    if let Some(ref l) = input.license { app.license = Some(l.clone()); }
    app.updated_at = Utc::now();

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(app.to_item()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(app)
}

pub async fn set_published(db: &Db, id: Uuid, published: bool) -> Result<(), AppError> {
    let mut app = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    app.is_published = published;
    app.updated_at = Utc::now();

    db.client
        .put_item()
        .table_name(&db.table)
        .set_item(Some(app.to_item()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB put_item failed: {e}")))?;

    Ok(())
}
