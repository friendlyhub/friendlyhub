use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::errors::AppError;
use crate::models::{app::{self, AppResponse, CreateApp, UpdateApp}, review, submission, user, verified_domain};
use crate::router::AppState;
use crate::services::{checks, verification};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/apps", get(list_apps).post(create_app))
        .route("/apps/mine", get(my_apps))
        .route("/apps/by-owner/{owner_id}", get(apps_by_owner))
        .route("/apps/{app_id}", get(get_app).put(update_app).delete(delete_app))
        .route("/apps/{app_id}/unpublish", axum::routing::post(unpublish_app))
        .route("/apps/{app_id}/flatpakref", get(get_flatpakref))
        .route("/apps/{app_id}/verify", axum::routing::post(verify_domain))
        .route("/apps/verification/check-domain", axum::routing::post(check_domain_status))
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

#[derive(Debug, Serialize)]
struct CreateAppResponse {
    #[serde(flatten)]
    app: AppResponse,
    verification: Option<VerificationInfo>,
}

#[derive(Debug, Serialize)]
struct VerificationInfo {
    status: String,
    domain: Option<String>,
    token: Option<String>,
    well_known_url: Option<String>,
}

async fn create_app(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateApp>,
) -> Result<Json<CreateAppResponse>, AppError> {
    // Validate app ID format
    verification::validate_app_id(&input.app_id)
        .map_err(|e| AppError::BadRequest(e))?;

    // Validate developer_type
    if input.developer_type != "original" && input.developer_type != "third_party" {
        return Err(AppError::BadRequest("developer_type must be 'original' or 'third_party'".into()));
    }

    // Check app_id doesn't already exist
    if app::find_by_app_id(&state.db, &input.app_id).await?.is_some() {
        return Err(AppError::BadRequest(format!("App '{}' already exists", input.app_id)));
    }

    // Third-party specific checks
    if input.developer_type == "third_party" {
        let original_app_id = input.original_app_id.as_deref()
            .ok_or_else(|| AppError::BadRequest("original_app_id is required for third-party packages".into()))?;

        verification::validate_app_id(original_app_id)
            .map_err(|e| AppError::BadRequest(format!("Invalid original app ID: {e}")))?;

        // Check no existing app with this app_id matches the original_app_id
        if app::find_by_app_id(&state.db, original_app_id).await?.is_some() {
            return Err(AppError::BadRequest(
                "This app already exists on the platform. You cannot create a third-party package for it.".into()
            ));
        }

        // Check no other third-party package exists for this original_app_id
        if app::find_by_original_app_id(&state.db, original_app_id).await?.is_some() {
            return Err(AppError::BadRequest(
                "A third-party package for this app already exists on the platform.".into()
            ));
        }

        // Also check the new app_id isn't someone else's original_app_id
        if app::find_by_original_app_id(&state.db, &input.app_id).await?.is_some() {
            return Err(AppError::BadRequest(format!("App ID '{}' conflicts with an existing package", input.app_id)));
        }
    }

    // Original developer specific checks — determine verification status
    let mut is_verified = false;
    let mut verification_info: Option<VerificationInfo> = None;

    if input.developer_type == "original" {
        let db_user = user::find_by_id(&state.db, auth.user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".into()))?;

        if let Some((_forge_domain, forge_user)) = verification::parse_forge_id(&input.app_id) {
            // Forge-based ID: check username match or org ownership
            if forge_user.to_lowercase() == db_user.github_login.to_lowercase() {
                is_verified = true;
                verification_info = Some(VerificationInfo {
                    status: "verified".into(),
                    domain: None,
                    token: None,
                    well_known_url: None,
                });
            } else {
                // Check org ownership
                let access_token = db_user.github_access_token.as_deref()
                    .ok_or_else(|| AppError::BadRequest(
                        "GitHub access token not available. Please log out and log in again.".into()
                    ))?;

                let is_owner = verification::check_github_org_ownership(access_token, &forge_user).await?;
                if is_owner {
                    is_verified = true;
                    verification_info = Some(VerificationInfo {
                        status: "verified".into(),
                        domain: None,
                        token: None,
                        well_known_url: None,
                    });
                } else {
                    return Err(AppError::BadRequest(format!(
                        "You are not an owner of the '{}' GitHub organization",
                        forge_user
                    )));
                }
            }
        } else {
            // Custom domain: generate/retrieve verification token
            let domain = verification::extract_domain(&input.app_id)
                .ok_or_else(|| AppError::BadRequest("Could not extract domain from app ID".into()))?;

            let record = verified_domain::create_or_get(&state.db, &domain, auth.user_id).await?;

            if record.verified {
                is_verified = true;
                verification_info = Some(VerificationInfo {
                    status: "verified".into(),
                    domain: Some(domain),
                    token: None,
                    well_known_url: None,
                });
            } else {
                verification_info = Some(VerificationInfo {
                    status: "pending".into(),
                    domain: Some(domain.clone()),
                    token: Some(record.token),
                    well_known_url: Some(format!("https://{domain}/.well-known/org.friendlyhub.VerifiedApps.txt")),
                });
            }
        }
    }

    let a = app::create(&state.db, auth.user_id, &input, is_verified).await?;
    Ok(Json(CreateAppResponse {
        app: AppResponse::from(a),
        verification: verification_info,
    }))
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
) -> Result<Json<serde_json::Value>, AppError> {
    let apps = app::list_by_owner(&state.db, auth.user_id).await?;
    let mut results = Vec::new();
    for a in apps {
        let app_uuid = a.id;
        let mut val = serde_json::to_value(AppResponse::from(a))
            .map_err(|e| AppError::Internal(format!("Serialization failed: {e}")))?;
        // Enrich with latest submission info
        let subs = submission::list_by_app(&state.db, app_uuid).await?;
        if let Some(latest) = subs.first() {
            val["latest_submission_id"] = serde_json::json!(latest.id);
            val["latest_submission_version"] = serde_json::json!(latest.version);
            val["latest_submission_status"] = serde_json::json!(latest.status);
        }
        results.push(val);
    }
    Ok(Json(serde_json::Value::Array(results)))
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

async fn verify_domain(
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

    if a.is_verified {
        return Ok(Json(serde_json::json!({ "status": "already_verified" })));
    }

    let domain = verification::extract_domain(&app_id)
        .ok_or_else(|| AppError::BadRequest("Could not extract domain from app ID".into()))?;

    let record = verified_domain::find_by_domain_and_user(&state.db, &domain, auth.user_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("No verification record found. Re-register the app.".into()))?;

    if record.verified {
        // Domain was verified (maybe for another app), just update this app
        app::set_verified(&state.db, a.id, true).await?;
        return Ok(Json(serde_json::json!({ "status": "verified" })));
    }

    // Check the well-known URL
    let is_valid = verification::verify_domain_token(&domain, &record.token).await?;

    if is_valid {
        verified_domain::mark_verified(&state.db, &domain, auth.user_id).await?;
        app::set_verified(&state.db, a.id, true).await?;
        Ok(Json(serde_json::json!({ "status": "verified" })))
    } else {
        Ok(Json(serde_json::json!({
            "status": "failed",
            "message": format!("Token not found at https://{}/.well-known/org.friendlyhub.VerifiedApps.txt", domain),
            "token": record.token,
        })))
    }
}

#[derive(Deserialize)]
struct CheckDomainRequest {
    domain: String,
}

async fn check_domain_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CheckDomainRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let record = verified_domain::find_by_domain_and_user(&state.db, &input.domain, auth.user_id).await?;

    match record {
        Some(r) => Ok(Json(serde_json::json!({
            "domain": r.domain,
            "verified": r.verified,
            "token": r.token,
            "well_known_url": format!("https://{}/.well-known/org.friendlyhub.VerifiedApps.txt", r.domain),
        }))),
        None => Ok(Json(serde_json::json!({
            "domain": input.domain,
            "verified": false,
            "token": null,
        }))),
    }
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
