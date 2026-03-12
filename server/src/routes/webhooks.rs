use axum::{
    extract::State,
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::{app::{self, CreateApp}, submission, user, verified_domain};
use crate::router::AppState;
use crate::services::{checks, manifest, metainfo, notifications, verification};

use super::submissions::ensure_repo_and_build;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/webhooks/build-complete", post(build_complete))
        .route("/webhooks/submit", post(webhook_submit))
        .route("/webhooks/pr-submit", post(pr_submit))
        .route("/webhooks/validate-metainfo", post(validate_metainfo))
        .route("/manifests/validate", post(validate_manifest))
        .route("/webhooks/check-verification", post(check_verification))
}

#[derive(Debug, Deserialize)]
struct BuildCompletePayload {
    submission_id: Uuid,
    result: String,
    fm_build_id: Option<i32>,
    build_log_url: Option<String>,
    download_size: Option<i64>,
    installed_size: Option<i64>,
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
struct ValidateMetainfoPayload {
    metainfo: String,
}

/// Validate AppStream metainfo XML (webhook-authed, used by submissions repo PR CI).
async fn validate_metainfo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ValidateMetainfoPayload>,
) -> Result<Json<Value>, AppError> {
    verify_webhook_secret(&headers, &state)?;

    let result = metainfo::parse_and_validate(&payload.metainfo);
    let version = metainfo::latest_version(&result.data).map(String::from);

    Ok(Json(serde_json::json!({
        "valid": result.valid,
        "errors": result.errors,
        "warnings": result.warnings,
        "version": version,
        "app_id": result.data.id,
    })))
}

#[derive(Debug, Deserialize)]
struct CheckVerificationPayload {
    app_id: String,
    github_username: String,
}

/// Check domain verification status for a PR submission.
/// Returns verification info so the CI workflow can comment on the PR.
async fn check_verification(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CheckVerificationPayload>,
) -> Result<Json<Value>, AppError> {
    verify_webhook_secret(&headers, &state)?;

    // Check forge-based ID first (e.g. io.github.username.AppName)
    if let Some((_forge_domain, forge_user)) = verification::parse_forge_id(&payload.app_id) {
        let verified = forge_user.to_lowercase() == payload.github_username.to_lowercase();
        return Ok(Json(serde_json::json!({
            "verified": verified,
            "type": "forge",
            "message": if verified {
                format!("GitHub username '{}' matches app ID", payload.github_username)
            } else {
                format!(
                    "App ID implies GitHub user/org '{}' but PR author is '{}'. \
                     If '{}' is a GitHub organization, the PR author must be an org owner.",
                    forge_user, payload.github_username, forge_user
                )
            },
        })));
    }

    // Custom domain: resolve user and create/get verification token
    let domain = verification::extract_domain(&payload.app_id)
        .ok_or_else(|| AppError::BadRequest("Could not extract domain from app ID".into()))?;

    let gh_user = state.github.get_user_by_login(&payload.github_username).await?;
    let db_user = user::upsert_from_github(
        &state.db,
        gh_user.id,
        &gh_user.login,
        gh_user.name.as_deref().unwrap_or(&gh_user.login),
        gh_user.email.as_deref(),
        gh_user.avatar_url.as_deref(),
        None,
    )
    .await?;

    let record = verified_domain::create_or_get(&state.db, &domain, db_user.id).await?;

    if record.verified {
        return Ok(Json(serde_json::json!({
            "verified": true,
            "type": "domain",
            "domain": domain,
        })));
    }

    // Check well-known URL in case they already placed the token
    let is_valid = verification::verify_domain_token(&domain, &record.token).await?;
    if is_valid {
        verified_domain::mark_verified(&state.db, &domain, db_user.id).await?;
        return Ok(Json(serde_json::json!({
            "verified": true,
            "type": "domain",
            "domain": domain,
        })));
    }

    let well_known_url = format!("https://{domain}/.well-known/org.friendlyhub.VerifiedApps.txt");
    Ok(Json(serde_json::json!({
        "verified": false,
        "type": "domain",
        "domain": domain,
        "token": record.token,
        "well_known_url": well_known_url,
    })))
}

#[derive(Debug, Deserialize)]
struct WebhookSubmitPayload {
    app_id: String,
    version: String,
    manifest: Value,
    source_ref: Option<String>,
    metainfo: Option<String>,
}

/// Create a submission from CI (webhook-authed, called on PR merge in per-app repos).
async fn webhook_submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WebhookSubmitPayload>,
) -> Result<Json<Value>, AppError> {
    verify_webhook_secret(&headers, &state)?;

    let found_app = app::find_by_app_id(&state.db, &payload.app_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("App '{}' not found", payload.app_id)))?;

    let validation = manifest::validate(&payload.manifest);
    if !validation.valid {
        return Err(AppError::BadRequest(format!(
            "Invalid manifest: {}",
            validation.errors.join("; ")
        )));
    }

    // Extract version from metainfo if provided, otherwise use payload version
    let version = if let Some(ref metainfo_xml) = payload.metainfo {
        let mi = metainfo::parse_and_validate(metainfo_xml);
        metainfo::latest_version(&mi.data)
            .map(String::from)
            .unwrap_or_else(|| payload.version.clone())
    } else {
        payload.version.clone()
    };

    let sub = submission::create(
        &state.db,
        found_app.id,
        found_app.owner_id,
        &version,
        &payload.manifest,
        payload.metainfo.as_deref(),
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
        version = %version,
        "Submission created via webhook, build triggered"
    );

    Ok(Json(serde_json::json!({
        "id": sub.id,
        "status": "building",
        "version": sub.version,
    })))
}

#[derive(Debug, Deserialize)]
struct PrSubmitPayload {
    app_id: String,
    manifest: Value,
    metainfo: String,
    github_username: String,
    #[serde(default)]
    source_files: HashMap<String, String>,
}

/// Create an app + submission from a PR merge in the submissions repo.
/// Auto-creates user and app records if they don't exist.
async fn pr_submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<PrSubmitPayload>,
) -> Result<Json<Value>, AppError> {
    verify_webhook_secret(&headers, &state)?;

    // Validate manifest
    let manifest_validation = manifest::validate(&payload.manifest);
    if !manifest_validation.valid {
        return Err(AppError::BadRequest(format!(
            "Invalid manifest: {}",
            manifest_validation.errors.join("; ")
        )));
    }

    // Validate metainfo
    let metainfo_validation = metainfo::parse_and_validate(&payload.metainfo);
    if !metainfo_validation.valid {
        return Err(AppError::BadRequest(format!(
            "Invalid metainfo: {}",
            metainfo_validation.errors.join("; ")
        )));
    }

    // Extract version from metainfo releases
    let version = metainfo::latest_version(&metainfo_validation.data)
        .ok_or_else(|| AppError::BadRequest(
            "Metainfo must contain at least one <release> with a version".into()
        ))?
        .to_string();

    // Verify metainfo <id> matches app_id
    if let Some(ref metainfo_id) = metainfo_validation.data.id {
        if metainfo_id != &payload.app_id {
            return Err(AppError::BadRequest(format!(
                "Metainfo <id> '{}' does not match app_id '{}'",
                metainfo_id, payload.app_id
            )));
        }
    }

    // Resolve GitHub username to a user record
    let gh_user = state.github.get_user_by_login(&payload.github_username).await?;
    let db_user = user::upsert_from_github(
        &state.db,
        gh_user.id,
        &gh_user.login,
        gh_user.name.as_deref().unwrap_or(&gh_user.login),
        gh_user.email.as_deref(),
        gh_user.avatar_url.as_deref(),
        None, // no access token for PR-based users
    )
    .await?;

    // Find or create the app
    let found_app = match app::find_by_app_id(&state.db, &payload.app_id).await? {
        Some(existing) => {
            if existing.owner_id != db_user.id {
                return Err(AppError::BadRequest(format!(
                    "App '{}' is owned by a different user",
                    payload.app_id
                )));
            }
            existing
        }
        None => {
            let input = CreateApp {
                app_id: payload.app_id.clone(),
                developer_type: "original".into(),
                original_app_id: None,
            };
            app::create(&state.db, db_user.id, &input, false).await?
        }
    };

    // Attempt domain verification
    if !found_app.is_verified {
        let mut verified = false;
        if let Some((_forge_domain, forge_user)) = verification::parse_forge_id(&payload.app_id) {
            // Forge-based: auto-verify if username matches
            if forge_user.to_lowercase() == payload.github_username.to_lowercase() {
                verified = true;
            }
            // TODO: could check org ownership via bot token for org-based forge IDs
        } else if let Some(domain) = verification::extract_domain(&payload.app_id) {
            // Custom domain: check if token was placed at well-known URL
            if let Ok(Some(record)) = verified_domain::find_by_domain_and_user(
                &state.db, &domain, db_user.id,
            ).await {
                if record.verified {
                    verified = true;
                } else if let Ok(true) = verification::verify_domain_token(&domain, &record.token).await {
                    let _ = verified_domain::mark_verified(&state.db, &domain, db_user.id).await;
                    verified = true;
                }
            }
        }
        if verified {
            if let Err(e) = app::set_verified(&state.db, found_app.id, true).await {
                tracing::warn!(app_id = %payload.app_id, error = %e, "Failed to set app as verified");
            } else {
                tracing::info!(app_id = %payload.app_id, "App auto-verified during PR submission");
            }
        }
    }

    // Update app metadata from metainfo
    let finish_args: Vec<String> = payload.manifest
        .get("finish-args")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    if let Err(e) = app::update_from_metainfo(
        &state.db, found_app.id, &metainfo_validation.data, finish_args,
    ).await {
        tracing::warn!(app_id = %payload.app_id, error = %e, "Failed to update app from metainfo");
    }

    // Create submission
    let sub = submission::create(
        &state.db,
        found_app.id,
        db_user.id,
        &version,
        &payload.manifest,
        Some(&payload.metainfo),
    )
    .await?;

    // Create repo, push files, add collaborator, trigger build
    ensure_repo_and_build(
        &state,
        &payload.app_id,
        sub.id,
        db_user.id,
        &payload.manifest,
        &payload.metainfo,
        &payload.source_files,
    )
    .await?;

    tracing::info!(
        submission_id = %sub.id,
        app_id = %payload.app_id,
        version = %version,
        github_user = %payload.github_username,
        "PR submission processed: app created/found, build triggered"
    );

    Ok(Json(serde_json::json!({
        "id": sub.id,
        "status": "building",
        "version": version,
        "app_id": payload.app_id,
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

    if sub.status != "building" && sub.status != "pending_build" {
        return Err(AppError::BadRequest(format!(
            "Submission is in '{}' state, cannot process build result",
            sub.status
        )));
    }

    match payload.result.as_str() {
        "success" => {
            if let Some(fm_id) = payload.fm_build_id {
                submission::set_fm_build_id(&state.db, sub.id, fm_id).await?;
            }
            if let Some(ref log_url) = payload.build_log_url {
                submission::set_build_log_url(&state.db, sub.id, log_url).await?;
            }
            if payload.download_size.is_some() || payload.installed_size.is_some() {
                app::update_sizes(
                    &state.db,
                    sub.app_id,
                    payload.download_size,
                    payload.installed_size,
                ).await?;
            }
            let check_results = checks::run_checks(&sub.manifest);
            checks::save_results(&state.db, sub.id, &check_results).await?;

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
