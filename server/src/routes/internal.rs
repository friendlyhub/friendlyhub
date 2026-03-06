use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::errors::AppError;
use crate::router::AppState;
use crate::services::flat_manager;

pub fn routes() -> Router<AppState> {
    Router::new().route("/internal/flat-manager-url", get(flat_manager_url))
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
