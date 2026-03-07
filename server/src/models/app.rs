use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::helpers;
use crate::db::Db;
use crate::errors::AppError;
use crate::services::metainfo::{Branding, MetainfoData, Release, Screenshot};

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
    pub developer_name: Option<String>,
    pub icon_url: Option<String>,
    pub bugtracker_url: Option<String>,
    pub vcs_url: Option<String>,
    pub screenshots: Vec<Screenshot>,
    pub releases: Vec<Release>,
    pub branding: Option<Branding>,
    pub project_license: Option<String>,
    pub keywords: Vec<String>,
    pub finish_args: Vec<String>,
    pub download_size: Option<i64>,
    pub installed_size: Option<i64>,
    pub install_count: i64,
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
    pub developer_name: Option<String>,
    pub icon_url: Option<String>,
    pub bugtracker_url: Option<String>,
    pub vcs_url: Option<String>,
    pub screenshots: Vec<Screenshot>,
    pub releases: Vec<Release>,
    pub branding: Option<Branding>,
    pub project_license: Option<String>,
    pub keywords: Vec<String>,
    pub finish_args: Vec<String>,
    pub download_size: Option<i64>,
    pub installed_size: Option<i64>,
    pub install_count: i64,
    pub is_published: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
            developer_name: a.developer_name,
            icon_url: a.icon_url,
            bugtracker_url: a.bugtracker_url,
            vcs_url: a.vcs_url,
            screenshots: a.screenshots,
            releases: a.releases,
            branding: a.branding,
            project_license: a.project_license,
            keywords: a.keywords,
            finish_args: a.finish_args,
            download_size: a.download_size,
            installed_size: a.installed_size,
            install_count: a.install_count,
            is_published: a.is_published,
            is_verified: a.is_verified,
            created_at: a.created_at,
            updated_at: a.updated_at,
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
    pub homepage_url: Option<String>,
    pub source_url: Option<String>,
    pub license: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApp {
    pub name: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
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
        if let Some(ref d) = self.developer_name {
            item.insert("developer_name".into(), AttributeValue::S(d.clone()));
        }
        if let Some(ref i) = self.icon_url {
            item.insert("icon_url".into(), AttributeValue::S(i.clone()));
        }
        if let Some(ref b) = self.bugtracker_url {
            item.insert("bugtracker_url".into(), AttributeValue::S(b.clone()));
        }
        if let Some(ref v) = self.vcs_url {
            item.insert("vcs_url".into(), AttributeValue::S(v.clone()));
        }
        if !self.screenshots.is_empty() {
            item.insert("screenshots".into(), AttributeValue::S(
                serde_json::to_string(&self.screenshots).unwrap_or_default()
            ));
        }
        if !self.releases.is_empty() {
            item.insert("releases".into(), AttributeValue::S(
                serde_json::to_string(&self.releases).unwrap_or_default()
            ));
        }
        if let Some(ref b) = self.branding {
            item.insert("branding".into(), AttributeValue::S(
                serde_json::to_string(b).unwrap_or_default()
            ));
        }
        if let Some(ref p) = self.project_license {
            item.insert("project_license".into(), AttributeValue::S(p.clone()));
        }
        if !self.keywords.is_empty() {
            item.insert("keywords".into(), helpers::string_list_to_av(&self.keywords));
        }
        if !self.finish_args.is_empty() {
            item.insert("finish_args".into(), helpers::string_list_to_av(&self.finish_args));
        }
        if let Some(s) = self.download_size {
            item.insert("download_size".into(), AttributeValue::N(s.to_string()));
        }
        if let Some(s) = self.installed_size {
            item.insert("installed_size".into(), AttributeValue::N(s.to_string()));
        }
        item.insert("install_count".into(), AttributeValue::N(self.install_count.to_string()));
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
            developer_name: helpers::get_string_opt(item, "developer_name"),
            icon_url: helpers::get_string_opt(item, "icon_url"),
            bugtracker_url: helpers::get_string_opt(item, "bugtracker_url"),
            vcs_url: helpers::get_string_opt(item, "vcs_url"),
            screenshots: helpers::get_string_opt(item, "screenshots")
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default(),
            releases: helpers::get_string_opt(item, "releases")
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default(),
            branding: helpers::get_string_opt(item, "branding")
                .and_then(|s| serde_json::from_str(&s).ok()),
            project_license: helpers::get_string_opt(item, "project_license"),
            keywords: helpers::get_string_list(item, "keywords"),
            finish_args: helpers::get_string_list(item, "finish_args"),
            download_size: helpers::get_i64_opt(item, "download_size"),
            installed_size: helpers::get_i64_opt(item, "installed_size"),
            install_count: helpers::get_i64_opt(item, "install_count").unwrap_or(0),
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
        categories: Vec::new(),
        homepage_url: input.homepage_url.clone(),
        source_url: input.source_url.clone(),
        license: input.license.clone(),
        developer_name: None,
        icon_url: None,
        bugtracker_url: None,
        vcs_url: None,
        screenshots: Vec::new(),
        releases: Vec::new(),
        branding: None,
        project_license: None,
        keywords: Vec::new(),
        finish_args: Vec::new(),
        download_size: None,
        installed_size: None,
        install_count: 0,
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

pub async fn update_from_metainfo(
    db: &Db,
    id: Uuid,
    data: &MetainfoData,
    finish_args: Vec<String>,
) -> Result<(), AppError> {
    let mut app = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if let Some(ref name) = data.name {
        app.name = name.clone();
    }
    if let Some(ref summary) = data.summary {
        app.summary = summary.clone();
    }
    if let Some(ref desc) = data.description {
        app.description = desc.clone();
    }
    app.developer_name = data.developer_name.clone();
    app.icon_url = data.icon_url.clone();
    app.screenshots = data.screenshots.clone();
    app.releases = data.releases.clone();
    app.branding = data.branding.clone();
    app.project_license = data.project_license.clone();
    app.finish_args = finish_args;

    if let Some(ref url) = data.homepage_url {
        app.homepage_url = Some(url.clone());
    }
    if let Some(ref url) = data.bugtracker_url {
        app.bugtracker_url = Some(url.clone());
    }
    if let Some(ref url) = data.vcs_url {
        app.vcs_url = Some(url.clone());
        app.source_url = Some(url.clone());
    }

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

pub async fn update_from_appstream(
    db: &Db,
    id: Uuid,
    categories: Vec<String>,
    keywords: Vec<String>,
    icon_url: Option<String>,
) -> Result<(), AppError> {
    let mut app = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if !categories.is_empty() {
        app.categories = categories;
    }
    if !keywords.is_empty() {
        app.keywords = keywords;
    }
    if let Some(url) = icon_url {
        app.icon_url = Some(url);
    }
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

pub async fn update_sizes(
    db: &Db,
    id: Uuid,
    download_size: Option<i64>,
    installed_size: Option<i64>,
) -> Result<(), AppError> {
    let mut app = find_by_id(db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if let Some(s) = download_size {
        app.download_size = Some(s);
    }
    if let Some(s) = installed_size {
        app.installed_size = Some(s);
    }
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

pub async fn increment_install_count(db: &Db, id: Uuid, delta: i64) -> Result<(), AppError> {
    let key = format!("APP#{id}");
    db.client
        .update_item()
        .table_name(&db.table)
        .key("PK", AttributeValue::S(key.clone()))
        .key("SK", AttributeValue::S(key))
        .update_expression("ADD install_count :delta")
        .expression_attribute_values(":delta", AttributeValue::N(delta.to_string()))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("DynamoDB update_item failed: {e}")))?;
    Ok(())
}

pub async fn delete(db: &Db, id: Uuid) -> Result<(), AppError> {
    let key = format!("APP#{id}");
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
