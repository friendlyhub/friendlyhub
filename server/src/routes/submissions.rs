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
use crate::models::{app, review, submission, user};
use crate::router::AppState;
use crate::services::{checks, manifest, metainfo};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/apps/{app_id}/submit", post(submit))
        .route("/submissions", get(my_submissions))
        .route("/submissions/{id}", get(get_submission))
        .route("/submissions/{id}/validate", get(validate_submission))
        .route("/submissions/{id}/source-files", get(source_files))
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
    /// Target CPU architectures to build for.
    /// Empty = default to all supported arches.
    #[serde(default)]
    target_arches: Vec<String>,
}

#[derive(Deserialize)]
struct FriendlyHubConfig {
    #[serde(rename = "only-arches")]
    only_arches: Option<Vec<String>>,
    #[serde(rename = "skip-arches")]
    skip_arches: Option<Vec<String>>,
}

pub fn resolve_arches(target_arches: &[String], source_files: &HashMap<String, String>) -> Vec<String> {
    if !target_arches.is_empty() {
        return target_arches.to_vec();
    }

    if let Some(config) = source_files.get("friendlyhub.json") {
        if let Ok(parsed) = serde_json::from_str::<FriendlyHubConfig>(config) {
            if let Some(only) = parsed.only_arches {
                return only;
            }
            if let Some(skip) = parsed.skip_arches {
                let all = vec!["x86_64".into(), "aarch64".into()];
                return all.into_iter().filter(|a| !skip.contains(a)).collect();
            }
        }
    }

    vec!["x86_64".into(), "aarch64".into()]
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

    // Update app metadata from metainfo immediately so the app detail page
    // shows the correct info even before the submission is reviewed.
    let finish_args: Vec<String> = input.manifest
        .get("finish-args")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    if let Err(e) = app::update_from_metainfo(&state.db, app.id, &metainfo_validation.data, finish_args).await {
        tracing::warn!(app_id = %app.app_id, error = %e, "Failed to update app from metainfo on submit");
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
    let arches = resolve_arches(&input.target_arches, &input.source_files);
    ensure_repo_and_build(&state, &app.app_id, sub.id, app.owner_id, &input.manifest, &input.metainfo, &input.source_files, &arches).await?;

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
) -> Result<Json<Value>, AppError> {
    let subs = submission::list_by_submitter(&state.db, auth.user_id).await?;

    // Enrich each submission with the string app_id
    let mut results = Vec::new();
    for sub in &subs {
        let mut val = serde_json::to_value(sub)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {e}")))?;
        if let Some(found_app) = app::find_by_id(&state.db, sub.app_id).await? {
            val["app_name"] = serde_json::json!(found_app.name);
            val["string_app_id"] = serde_json::json!(found_app.app_id);
        }
        results.push(val);
    }

    Ok(Json(Value::Array(results)))
}

async fn get_submission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
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

    if sub.status == "building" || sub.status == "pending_build" {
        let arch_summary: Vec<String> = sub.builds.as_ref()
            .map(|b| b.iter().map(|(arch, ab)| {
                format!("{}:status={},gha_run_id={:?}", arch, ab.status, ab.gha_run_id)
            }).collect())
            .unwrap_or_default();
        tracing::info!(
            submission_id = %id,
            status = %sub.status,
            builds = ?arch_summary,
            "Submission polled during build"
        );
    }

    // Fetch reviews with reviewer names
    let reviews = review::list_by_submission(&state.db, id).await?;
    let mut enriched_reviews = Vec::new();
    for rev in &reviews {
        let mut val = serde_json::to_value(rev)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {e}")))?;
        if let Some(reviewer) = user::find_by_id(&state.db, rev.reviewer_id).await? {
            val["reviewer_name"] = serde_json::json!(reviewer.display_name);
            val["reviewer_avatar_url"] = serde_json::json!(reviewer.avatar_url);
        }
        enriched_reviews.push(val);
    }

    // Fetch checks
    let check_results = checks::get_results(&state.db, id).await?;

    // Fetch app info
    let found_app = app::find_by_id(&state.db, sub.app_id).await?;
    let app_info = found_app.map(|a| serde_json::json!({
        "app_id": a.app_id,
        "name": a.name,
    }));

    Ok(Json(serde_json::json!({
        "submission": sub,
        "reviews": enriched_reviews,
        "checks": check_results,
        "app": app_info,
    })))
}

/// List source files in the app's GitHub repo for a submission.
async fn source_files(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let sub = submission::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    // Only the submitter, reviewer, or admin can see source files
    if sub.submitter_id != auth.user_id
        && auth.role != "reviewer"
        && auth.role != "admin"
    {
        return Err(AppError::Forbidden);
    }

    let found_app = app::find_by_id(&state.db, sub.app_id)
        .await?
        .ok_or_else(|| AppError::NotFound("App not found".into()))?;

    let app_id = &found_app.app_id;
    let all_files = state.github.list_repo_files(app_id).await?;

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
                && n != "friendlyhub.json"
                && n != &manifest_json
                && n != &manifest_yaml
                && n != &manifest_yml
                && n != &metainfo_xml
                && !n.starts_with('.')
        })
        .collect();

    Ok(Json(serde_json::json!(filtered)))
}

/// Create/update the app's GitHub repo, push files + workflows, add collaborator,
/// and trigger a GHA build. Used by both web submissions and PR-based submissions.
pub async fn ensure_repo_and_build(
    state: &AppState,
    app_id: &str,
    submission_id: Uuid,
    owner_id: Uuid,
    manifest: &Value,
    metainfo: &str,
    source_files: &HashMap<String, String>,
    arches: &[String],
) -> Result<(), AppError> {
    let repo = app_id;
    if !state.github.repo_exists(repo).await? {
        state
            .github
            .create_repo(repo, &format!("FriendlyHub build repo for {app_id}"))
            .await?;
    }

    // Add the app owner as a triage collaborator (best-effort)
    if let Ok(Some(owner)) = user::find_by_id(&state.db, owner_id).await {
        if let Err(e) = state.github.add_collaborator(repo, &owner.github_login, "triage").await {
            tracing::warn!(repo = repo, user = %owner.github_login, error = %e, "Failed to add collaborator");
        }
    }

    // Inject metainfo as a file source so flatpak-builder can find it
    let mut manifest = manifest.clone();
    let metainfo_filename = format!("{app_id}.metainfo.xml");
    let metainfo_source = serde_json::json!({
        "type": "file",
        "path": metainfo_filename,
    });
    if let Some(modules) = manifest.get_mut("modules").and_then(|m| m.as_array_mut()) {
        for module in modules.iter_mut() {
            if let Some(sources) = module.get_mut("sources").and_then(|s| s.as_array_mut()) {
                let already_has = sources.iter().any(|s| {
                    s.get("path").and_then(|p| p.as_str()) == Some(&metainfo_filename)
                });
                if !already_has {
                    sources.push(metainfo_source.clone());
                }
            }
        }
    }

    let manifest_str = serde_json::to_string_pretty(&manifest)
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

    state
        .github
        .put_file(
            repo,
            &format!("{app_id}.metainfo.xml"),
            metainfo,
            &format!("[friendlyhub-api] Update metainfo for submission {submission_id}"),
        )
        .await?;

    for (filename, content) in source_files {
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

    // Write friendlyhub.json if not building for all arches
    if arches.len() < 2 {
        let config = serde_json::json!({ "only-arches": arches });
        state
            .github
            .put_file(
                repo,
                "friendlyhub.json",
                &serde_json::to_string_pretty(&config)
                    .map_err(|e| AppError::Internal(format!("Failed to serialize friendlyhub.json: {e}")))?,
                &format!("[friendlyhub-api] Update arch config for submission {submission_id}"),
            )
            .await?;
    }

    submission::init_builds(&state.db, submission_id, arches).await?;

    for arch in arches {
        let inputs = serde_json::json!({
            "submission_id": submission_id.to_string(),
            "app_id": app_id,
            "manifest_path": format!("{app_id}.json"),
            "arch": arch,
        });
        state
            .github
            .trigger_build(repo, "build.yml", "main", &inputs)
            .await?;
    }

    submission::update_status(&state.db, submission_id, "building").await?;

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
