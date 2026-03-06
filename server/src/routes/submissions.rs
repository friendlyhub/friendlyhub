use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::errors::AppError;
use crate::models::{app, submission};
use crate::router::AppState;
use crate::services::{manifest, metainfo};

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
    /// AppStream metainfo XML (required).
    metainfo: String,
    /// Optional companion source files (e.g. cargo-sources.json, node-sources.json).
    /// Keys are filenames, values are file contents as strings.
    #[serde(default)]
    source_files: HashMap<String, String>,
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

    // Validate the metainfo XML
    let metainfo_validation = metainfo::parse_and_validate(&input.metainfo);
    if !metainfo_validation.valid {
        return Err(AppError::BadRequest(format!(
            "Invalid metainfo: {}",
            metainfo_validation.errors.join("; ")
        )));
    }

    // Check metainfo id matches the app
    if let Some(ref metainfo_id) = metainfo_validation.data.id {
        if metainfo_id != &app.app_id {
            return Err(AppError::BadRequest(format!(
                "Metainfo <id> '{}' does not match app '{}'",
                metainfo_id, app.app_id
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
        Some(&input.metainfo),
    )
    .await?;

    // Push manifest to the app's GitHub repo and trigger a build
    trigger_build(&state, &app.app_id, sub.id, &input.manifest, &input.metainfo, &input.source_files).await?;

    Ok(Json(serde_json::json!({
        "id": sub.id,
        "status": "building",
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

/// Push the manifest to the app's GitHub repo and trigger a GHA build.
async fn trigger_build(
    state: &AppState,
    app_id: &str,
    submission_id: Uuid,
    manifest: &Value,
    metainfo: &str,
    source_files: &HashMap<String, String>,
) -> Result<(), AppError> {
    // Ensure the repo exists in the org
    let repo = app_id; // repo name = app_id (e.g. org.example.MyApp)
    if !state.github.repo_exists(repo).await? {
        state
            .github
            .create_repo(repo, &format!("FriendlyHub build repo for {app_id}"))
            .await?;
    }

    // Push the manifest as the main manifest file
    let manifest_str = serde_json::to_string_pretty(manifest)
        .map_err(|e| AppError::Internal(format!("Failed to serialize manifest: {e}")))?;
    state
        .github
        .put_file(
            repo,
            &format!("{app_id}.json"),
            &manifest_str,
            &format!("[friendlyhub-api] Update manifest for submission {submission_id}"),
        )
        .await?;

    // Push the metainfo XML
    state
        .github
        .put_file(
            repo,
            &format!("{app_id}.metainfo.xml"),
            metainfo,
            &format!("[friendlyhub-api] Update metainfo for submission {submission_id}"),
        )
        .await?;

    // Push companion source files (e.g. cargo-sources.json, node-sources.json)
    for (filename, content) in source_files {
        // Only allow JSON files in the repo root — no path traversal
        let safe_name = std::path::Path::new(filename)
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| AppError::BadRequest(format!("Invalid source file name: {filename}")))?;
        state
            .github
            .put_file(
                repo,
                safe_name,
                content,
                &format!("[friendlyhub-api] Update {safe_name} for submission {submission_id}"),
            )
            .await?;
    }

    // Push the GHA workflows if they don't exist yet
    state
        .github
        .put_file(
            repo,
            ".github/workflows/build.yml",
            BUILD_WORKFLOW_YAML,
            "[friendlyhub-api] Add FriendlyHub build workflow",
        )
        .await?;
    state
        .github
        .put_file(
            repo,
            ".github/workflows/pr-check.yml",
            PR_CHECK_WORKFLOW_YAML,
            "[friendlyhub-api] Add FriendlyHub PR check workflow",
        )
        .await?;

    // Trigger the workflow
    let inputs = serde_json::json!({
        "submission_id": submission_id.to_string(),
        "app_id": app_id,
        "manifest_path": format!("{app_id}.json"),
    });
    state
        .github
        .trigger_build(repo, "build.yml", "main", &inputs)
        .await?;

    // Update submission status to building
    submission::update_status(&state.db, submission_id, "building").await?;

    // Try to find the run ID (best-effort, it may not be available immediately)
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    if let Some(run) = state.github.find_latest_run(repo, "build.yml").await? {
        submission::set_build_info(&state.db, submission_id, run.id, &run.html_url).await?;
    }

    Ok(())
}

/// GHA workflows pushed to each app repo. Match build-templates/ in the monorepo.
const BUILD_WORKFLOW_YAML: &str = include_str!("../../../build-templates/build.yml");
const PR_CHECK_WORKFLOW_YAML: &str = include_str!("../../../build-templates/pr-check.yml");

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
