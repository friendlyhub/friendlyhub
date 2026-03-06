use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::errors::AppError;
use crate::models::app;
use crate::router::AppState;
use crate::services::{appstream, flat_manager};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/internal/flat-manager-url", get(flat_manager_url))
        .route("/internal/refresh-appstream", post(refresh_appstream))
}

async fn flat_manager_url(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let url = flat_manager::discover_url(
        &state.ecs_client,
        &state.ec2_client,
        &state.config.ecs_cluster,
        &state.config.ecs_service,
    )
    .await?;

    Ok(Json(json!({ "url": url })))
}

/// Called by the s3-sync sidecar after syncing the OSTree repo to S3.
/// Reads appstream.xml.gz and updates all published apps with categories, keywords, and icon URLs.
async fn refresh_appstream(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let apps = app::list_published(&state.db, None, 1000, 0).await?;
    let mut updated = 0;
    let mut errors = 0;

    for a in &apps {
        match appstream::fetch_app_metadata(
            &state.s3_client,
            &state.config.repo_s3_bucket,
            &a.app_id,
        )
        .await
        {
            Ok(Some(data)) => {
                let icon_url = data.icon_filename.map(|_| {
                    format!(
                        "{}/repo/appstream/x86_64/icons/128x128/{}.png",
                        state.config.repo_cdn_url, a.app_id
                    )
                });
                if let Err(e) = app::update_from_appstream(
                    &state.db,
                    a.id,
                    data.categories,
                    data.keywords,
                    icon_url,
                )
                .await
                {
                    tracing::warn!(app_id = %a.app_id, error = %e, "Failed to update app from appstream");
                    errors += 1;
                } else {
                    updated += 1;
                }
            }
            Ok(None) => {
                tracing::debug!(app_id = %a.app_id, "App not found in appstream.xml.gz");
            }
            Err(e) => {
                tracing::warn!(app_id = %a.app_id, error = %e, "Failed to fetch appstream data");
                errors += 1;
            }
        }
    }

    Ok(Json(json!({
        "total_published": apps.len(),
        "updated": updated,
        "errors": errors,
    })))
}
