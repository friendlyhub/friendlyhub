use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::errors::AppError;
use crate::models::app::{self, AppResponse, CreateApp, UpdateApp};
use crate::router::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/apps", get(list_apps).post(create_app))
        .route("/apps/{app_id}", get(get_app).put(update_app))
        .route("/apps/mine", get(my_apps))
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

async fn my_apps(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<AppResponse>>, AppError> {
    let apps = app::list_by_owner(&state.db, auth.user_id).await?;
    let responses: Vec<AppResponse> = apps.into_iter().map(AppResponse::from).collect();
    Ok(Json(responses))
}
