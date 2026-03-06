use axum::{
    extract::State,
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::{app, submission};
use crate::router::AppState;
use crate::services::{checks, manifest, notifications};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/webhooks/build-complete", post(build_complete))
        .route("/webhooks/submit", post(webhook_submit))
        .route("/manifests/validate", post(validate_manifest))
}

#[derive(Debug, Deserialize)]
struct BuildCompletePayload {
    /// The FriendlyHub submission ID (passed as input to the GHA workflow)
    submission_id: Uuid,
    /// "success" or "failure"
    result: String,
    /// flat-manager build ID (if build succeeded and was uploaded)
    fm_build_id: Option<i32>,
    /// URL to build logs
    build_log_url: Option<String>,
}

fn verify_webhook_secret(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    let expected = &state.config.flat_manager_webhook_secret;
    let provided = headers
        .get("x-webhook-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != expected {
        return Err(AppError::Unauthorized);
    }
    Ok(())
}

/// Validate a Flatpak manifest (webhook-authed, used by PR CI).
async fn validate_manifest(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(manifest_value): Json<Value>,
) -> Result<Json<manifest::ValidationResult>, AppError> {
    verify_webhook_secret(&headers, &state)?;
    let result = manifest::validate(&manifest_value);
    Ok(Json(result))
}

#[derive(Debug, Deserialize)]
struct WebhookSubmitPayload {
    app_id: String,
    version: String,
    manifest: Value,
    source_ref: Option<String>,
}

/// Create a submission from CI (webhook-authed, called on PR merge).
async fn webhook_submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WebhookSubmitPayload>,
) -> Result<Json<Value>, AppError> {
    verify_webhook_secret(&headers, &state)?;

    // Find the app
    let found_app = app::find_by_app_id(&state.db, &payload.app_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("App '{}' not found", payload.app_id)))?;

    // Validate the manifest
    let validation = manifest::validate(&payload.manifest);
    if !validation.valid {
        return Err(AppError::BadRequest(format!(
            "Invalid manifest: {}",
            validation.errors.join("; ")
        )));
    }

    // Create the submission (owner is the submitter for webhook-created submissions)
    let sub = submission::create(
        &state.db,
        found_app.id,
        found_app.owner_id,
        &payload.version,
        &payload.manifest,
        None, // metainfo is already in the repo from the merged PR
    )
    .await?;

    // Trigger GHA build (manifest is already in repo from the merged PR)
    let inputs = serde_json::json!({
        "submission_id": sub.id.to_string(),
    });
    state
        .github
        .trigger_build(&payload.app_id, "build.yml", "main", &inputs)
        .await?;

    submission::update_status(&state.db, sub.id, "building").await?;

    tracing::info!(
        submission_id = %sub.id,
        app_id = %payload.app_id,
        version = %payload.version,
        "Submission created via webhook, build triggered"
    );

    Ok(Json(serde_json::json!({
        "id": sub.id,
        "status": "building",
        "version": sub.version,
    })))
}

/// Called by the GHA workflow when a build finishes.
async fn build_complete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BuildCompletePayload>,
) -> Result<Json<Value>, AppError> {
    verify_webhook_secret(&headers, &state)?;

    let sub = submission::find_by_id(&state.db, payload.submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    // Only accept webhook for submissions that are currently building
    if sub.status != "building" && sub.status != "pending_build" {
        return Err(AppError::BadRequest(format!(
            "Submission is in '{}' state, cannot process build result",
            sub.status
        )));
    }

    match payload.result.as_str() {
        "success" => {
            // Update with flat-manager build ID if provided
            if let Some(fm_id) = payload.fm_build_id {
                submission::set_fm_build_id(&state.db, sub.id, fm_id).await?;
            }
            if let Some(ref log_url) = payload.build_log_url {
                submission::set_build_log_url(&state.db, sub.id, log_url).await?;
            }
            // Run automated checks on the manifest
            let check_results = checks::run_checks(&sub.manifest);
            checks::save_results(&state.db, sub.id, &check_results).await?;

            // Move to pending_review
            submission::update_status(&state.db, sub.id, "pending_review").await?;

            let checks_passed = checks::all_passed(&check_results);
            tracing::info!(
                submission_id = %sub.id,
                checks_passed = checks_passed,
                "Build succeeded, ran {} checks, moved to pending_review",
                check_results.len()
            );
            notifications::notify_build_complete(sub.id, true).await;
        }
        "failure" => {
            if let Some(ref log_url) = payload.build_log_url {
                submission::set_build_log_url(&state.db, sub.id, log_url).await?;
            }
            submission::update_status(&state.db, sub.id, "build_failed").await?;

            tracing::info!(
                submission_id = %sub.id,
                "Build failed"
            );
            notifications::notify_build_complete(sub.id, false).await;
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "Unknown build result: '{other}'. Expected 'success' or 'failure'"
            )));
        }
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}
