use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::auth::middleware::ReviewerUser;
use crate::errors::AppError;
use crate::models::{app, review, submission};
use crate::router::AppState;
use crate::services::{checks, metainfo, notifications};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/review/queue", get(review_queue))
        .route("/review/queue/{id}", get(review_detail))
        .route("/review/queue/{id}/checks", get(submission_checks))
        .route("/review/queue/{id}/source-files", get(source_files))
        .route("/review/queue/{id}/decision", post(review_decision))
}

/// List submissions awaiting review.
async fn review_queue(
    State(state): State<AppState>,
    _reviewer: ReviewerUser,
) -> Result<Json<Vec<submission::Submission>>, AppError> {
    let subs = submission::list_by_status(&state.db, "pending_review").await?;
    Ok(Json(subs))
}

/// Get a single submission's details for review.
async fn review_detail(
    State(state): State<AppState>,
    _reviewer: ReviewerUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let sub = submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let reviews = review::list_by_submission(&state.db, id).await?;
    let check_results = checks::get_results(&state.db, id).await?;

    // Include app info so reviewers can see the app name and ID
    let found_app = app::find_by_id(&state.db, sub.app_id).await?;
    let app_info = found_app.map(|a| serde_json::json!({
        "app_id": a.app_id,
        "name": a.name,
    }));

    Ok(Json(serde_json::json!({
        "submission": sub,
        "reviews": reviews,
        "checks": check_results,
        "app": app_info,
    })))
}

/// Get automated check results for a submission.
async fn submission_checks(
    State(state): State<AppState>,
    _reviewer: ReviewerUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<checks::CheckResultRow>>, AppError> {
    // Verify submission exists
    submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let results = checks::get_results(&state.db, id).await?;
    Ok(Json(results))
}

/// List source files in the app's GitHub repo (excluding infrastructure files).
async fn source_files(
    State(state): State<AppState>,
    _reviewer: ReviewerUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let sub = submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let found_app = app::find_by_id(&state.db, sub.app_id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    let app_id = &found_app.app_id;
    let all_files = state.github.list_repo_files(app_id).await?;

    // Filter out infrastructure files -- keep only source/data files that
    // a reviewer would want to inspect.
    let manifest_json = format!("{app_id}.json");
    let manifest_yaml = format!("{app_id}.yaml");
    let manifest_yml = format!("{app_id}.yml");
    let metainfo_xml = format!("{app_id}.metainfo.xml");

    let filtered: Vec<_> = all_files
        .into_iter()
        .filter(|f| {
            let n = &f.name;
            n != "README.md"
                && n != ".gitignore"
                && n != &manifest_json
                && n != &manifest_yaml
                && n != &manifest_yml
                && n != &metainfo_xml
                && !n.starts_with('.')
        })
        .collect();

    Ok(Json(serde_json::json!(filtered)))
}

#[derive(Debug, Deserialize)]
struct ReviewDecision {
    /// "approved" or "changes_requested"
    decision: String,
    comment: String,
}

/// Submit a review decision on a submission.
/// If approved, triggers publish via flat-manager.
async fn review_decision(
    State(state): State<AppState>,
    reviewer: ReviewerUser,
    Path(id): Path<Uuid>,
    Json(input): Json<ReviewDecision>,
) -> Result<Json<Value>, AppError> {
    // Validate decision
    if input.decision != "approved" && input.decision != "changes_requested" {
        return Err(AppError::BadRequest(
            "Decision must be 'approved' or 'changes_requested'".into(),
        ));
    }

    let sub = submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if sub.status != "pending_review" {
        return Err(AppError::BadRequest(format!(
            "Submission is in '{}' state, not pending_review",
            sub.status
        )));
    }

    // Record the review
    let rev = review::create(
        &state.db,
        id,
        reviewer.0.user_id,
        &input.decision,
        &input.comment,
    )
    .await?;

    // Update submission status
    let new_status = match input.decision.as_str() {
        "approved" => "approved",
        "changes_requested" => "changes_requested",
        _ => unreachable!(),
    };
    submission::update_status(&state.db, id, new_status).await?;
    notifications::notify_review_decision(id, &input.decision, &input.comment).await;

    // If approved, publish via flat-manager and update app from metainfo
    if input.decision == "approved" {
        // Extract finish-args from manifest for permissions display
        let finish_args: Vec<String> = sub.manifest
            .get("finish-args")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        // Update app metadata from metainfo if present
        if let Some(ref metainfo_xml) = sub.metainfo {
            let parsed = metainfo::parse_and_validate(metainfo_xml);
            if parsed.valid {
                if let Err(e) = app::update_from_metainfo(&state.db, sub.app_id, &parsed.data, finish_args).await {
                    tracing::warn!(
                        submission_id = %id,
                        error = %e,
                        "Failed to update app from metainfo"
                    );
                }
            }
        }

        if let Some(fm_build_id) = sub.fm_build_id {
            match state.flat_manager.publish_build(fm_build_id).await {
                Ok(()) => {
                    submission::update_status(&state.db, id, "published").await?;
                    app::set_published(&state.db, sub.app_id, true).await?;
                    tracing::info!(
                        submission_id = %id,
                        fm_build_id = fm_build_id,
                        "Build published via flat-manager"
                    );
                    notifications::notify_published(id, &sub.app_id.to_string()).await;
                }
                Err(e) => {
                    tracing::error!(
                        submission_id = %id,
                        error = %e,
                        "Failed to publish via flat-manager — submission approved but not published"
                    );
                    // Don't fail the review — it's approved, publish can be retried
                }
            }
        } else {
            tracing::warn!(
                submission_id = %id,
                "Submission approved but no flat-manager build ID — cannot auto-publish"
            );
        }
    }

    Ok(Json(serde_json::json!({
        "review": rev,
        "submission_status": new_status,
    })))
}
