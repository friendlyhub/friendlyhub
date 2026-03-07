use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::errors::AppError;
use crate::models::{app::{self, AppResponse, CreateApp, UpdateApp}, review, submission};
use crate::router::AppState;
use crate::services::checks;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/apps", get(list_apps).post(create_app))
        .route("/apps/mine", get(my_apps))
        .route("/apps/by-owner/{owner_id}", get(apps_by_owner))
        .route("/apps/{app_id}", get(get_app).put(update_app).delete(delete_app))
        .route("/apps/{app_id}/unpublish", axum::routing::post(unpublish_app))
        .route("/apps/{app_id}/flatpakref", get(get_flatpakref))
}

#[derive(Deserialize)]
struct ListParams {
    q: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn list_apps(
    State(state): State<AppState>,
    Query(params): Query<ListParams>,
) -> Result<Json<Vec<AppResponse>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let apps = app::list_published(&state.db, params.q.as_deref(), limit, offset).await?;
    let responses: Vec<AppResponse> = apps.into_iter().map(AppResponse::from).collect();
    Ok(Json(responses))
}

async fn get_app(
    State(state): State<AppState>,
    Path(app_id): Path<String>,
) -> Result<Json<AppResponse>, AppError> {
    // Try by app_id string first, then by UUID
    let found = if let Ok(uuid) = app_id.parse::<Uuid>() {
        app::find_by_id(&state.db, uuid).await?
    } else {
        app::find_by_app_id(&state.db, &app_id).await?
    };

    let a = found.ok_or_else(|| AppError::NotFound("App not found".into()))?;
    Ok(Json(AppResponse::from(a)))
}

async fn create_app(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateApp>,
) -> Result<Json<AppResponse>, AppError> {
    // Check app_id doesn't already exist
    if app::find_by_app_id(&state.db, &input.app_id)
        .await?
        .is_some()
    {
        return Err(AppError::BadRequest(format!(
            "App '{}' already exists",
            input.app_id
        )));
    }

    let a = app::create(&state.db, auth.user_id, &input).await?;
    Ok(Json(AppResponse::from(a)))
}

async fn update_app(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(app_id): Path<String>,
    Json(input): Json<UpdateApp>,
) -> Result<Json<AppResponse>, AppError> {
    let a = app::find_by_app_id(&state.db, &app_id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if a.owner_id != auth.user_id && auth.role != "admin" {
        return Err(AppError::Forbidden);
    }

    let updated = app::update(&state.db, a.id, &input).await?;
    Ok(Json(AppResponse::from(updated)))
}

async fn apps_by_owner(
    State(state): State<AppState>,
    Path(owner_id): Path<Uuid>,
) -> Result<Json<Vec<AppResponse>>, AppError> {
    let apps = app::list_by_owner(&state.db, owner_id).await?;
    let responses: Vec<AppResponse> = apps
        .into_iter()
        .filter(|a| a.is_published)
        .map(AppResponse::from)
        .collect();
    Ok(Json(responses))
}

async fn my_apps(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<AppResponse>>, AppError> {
    let apps = app::list_by_owner(&state.db, auth.user_id).await?;
    let responses: Vec<AppResponse> = apps.into_iter().map(AppResponse::from).collect();
    Ok(Json(responses))
}

async fn unpublish_app(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(app_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let a = app::find_by_app_id(&state.db, &app_id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if a.owner_id != auth.user_id && auth.role != "admin" {
        return Err(AppError::Forbidden);
    }

    app::set_published(&state.db, a.id, false).await?;

    Ok(Json(serde_json::json!({ "status": "unpublished" })))
}

async fn delete_app(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(app_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let a = app::find_by_app_id(&state.db, &app_id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    if a.owner_id != auth.user_id && auth.role != "admin" {
        return Err(AppError::Forbidden);
    }

    // Delete all submissions and their reviews
    let submissions = submission::list_by_app(&state.db, a.id).await?;
    for sub in &submissions {
        let reviews = review::list_by_submission(&state.db, sub.id).await?;
        for rev in &reviews {
            review::delete(&state.db, sub.id, rev.id).await?;
        }
        checks::delete_results(&state.db, sub.id).await?;
        submission::delete(&state.db, sub.id).await?;
    }

    // Delete the app record
    app::delete(&state.db, a.id).await?;

    // Delete the GitHub repo (best-effort, don't fail the whole operation)
    if let Err(e) = state.github.delete_repo(&a.app_id).await {
        tracing::warn!("Failed to delete GitHub repo {}: {e}", a.app_id);
    }

    // Purge OSTree refs (best-effort)
    if let Err(e) = state.flat_manager.purge_app(&a.app_id).await {
        tracing::warn!("Failed to purge OSTree refs for {}: {e}", a.app_id);
    }

    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

async fn get_flatpakref(
    State(state): State<AppState>,
    Path(app_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    // Verify the app exists and is published
    let a = app::find_by_app_id(&state.db, &app_id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;
    if !a.is_published {
        return Err(AppError::NotFound("App not found".into()));
    }

    // Load GPG key: prefer config, fall back to reading .flatpakrepo from S3
    let gpg_key = if !state.config.repo_gpg_key.is_empty() {
        Some(state.config.repo_gpg_key.clone())
    } else {
        load_gpg_key_from_s3(&state.s3_client, &state.config.repo_s3_bucket).await
    };

    let repo_url = format!("{}/repo/", state.config.repo_cdn_url.trim_end_matches('/'));
    let mut lines = vec![
        "[Flatpak Ref]".to_string(),
        format!("Title={} from friendlyhub", app_id),
        format!("Name={}", app_id),
        "Branch=stable".to_string(),
        format!("Url={}", repo_url),
        "IsRuntime=false".to_string(),
        "SuggestRemoteName=friendlyhub".to_string(),
        "RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo".to_string(),
    ];
    if let Some(key) = gpg_key {
        lines.push(format!("GPGKey={}", key));
    }
    lines.push(String::new()); // trailing newline
    let body = lines.join("\n");

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/vnd.flatpak.ref"),
            (header::CONTENT_DISPOSITION, "inline"),
        ],
        body,
    ))
}

async fn load_gpg_key_from_s3(
    s3_client: &aws_sdk_s3::Client,
    bucket: &str,
) -> Option<String> {
    let resp = s3_client
        .get_object()
        .bucket(bucket)
        .key("repo/friendlyhub.flatpakrepo")
        .send()
        .await
        .ok()?;
    let body = resp.body.collect().await.ok()?;
    let bytes = body.into_bytes();
    let text = String::from_utf8_lossy(&bytes);
    for line in text.lines() {
        if let Some(val) = line.strip_prefix("GPGKey=") {
            return Some(val.to_string());
        }
    }
    None
}
