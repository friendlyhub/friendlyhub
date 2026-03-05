use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::errors::AppError;
use crate::models::{app, submission};
use crate::router::AppState;
use crate::services::manifest;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/apps/{app_id}/submit", post(submit))
        .route("/submissions", get(my_submissions))
        .route("/submissions/{id}", get(get_submission))
        .route("/submissions/{id}/validate", get(validate_submission))
}

#[derive(Deserialize)]
struct SubmitRequest {
    version: String,
    manifest: Value,
}

async fn submit(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(app_id_str): Path<String>,
    Json(input): Json<SubmitRequest>,
) -> Result<Json<Value>, AppError> {
    // Find the app
    let app = app::find_by_app_id(&state.db, &app_id_str)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    // Only the owner (or admin) can submit
    if app.owner_id != auth.user_id && auth.role != "admin" {
        return Err(AppError::Forbidden);
    }

    // Validate the manifest
    let validation = manifest::validate(&input.manifest);
    if !validation.valid {
        return Err(AppError::BadRequest(format!(
            "Invalid manifest: {}",
            validation.errors.join("; ")
        )));
    }

    // Check the manifest app-id matches
    if let Some(ref manifest_app_id) = validation.parsed_app_id {
        if manifest_app_id != &app.app_id {
            return Err(AppError::BadRequest(format!(
                "Manifest app-id '{}' does not match app '{}'",
                manifest_app_id, app.app_id
            )));
        }
    }

    // Create the submission
    let sub = submission::create(
        &state.db,
        app.id,
        auth.user_id,
        &input.version,
        &input.manifest,
    )
    .await?;

    // TODO: Phase 2 continuation — trigger GHA build here
    // For now, submission stays in pending_build until we wire up GHA triggers

    Ok(Json(serde_json::json!({
        "id": sub.id,
        "status": sub.status,
        "version": sub.version,
        "warnings": validation.warnings,
    })))
}

async fn my_submissions(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<submission::Submission>>, AppError> {
    let subs = submission::list_by_submitter(&state.db, auth.user_id).await?;
    Ok(Json(subs))
}

async fn get_submission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<submission::Submission>, AppError> {
    let sub = submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    // Only the submitter, reviewer, or admin can see a submission
    if sub.submitter_id != auth.user_id
        && auth.role != "reviewer"
        && auth.role != "admin"
    {
        return Err(AppError::Forbidden);
    }

    Ok(Json(sub))
}

async fn validate_submission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<manifest::ValidationResult>, AppError> {
    let sub = submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if sub.submitter_id != auth.user_id
        && auth.role != "reviewer"
        && auth.role != "admin"
    {
        return Err(AppError::Forbidden);
    }

    let result = manifest::validate(&sub.manifest);
    Ok(Json(result))
}
