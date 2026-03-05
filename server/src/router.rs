use axum::{routing::get, Json, Router};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::db::Db;
use crate::routes;
use crate::services::flat_manager::FlatManagerClient;
use crate::services::github::GitHubService;

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub config: Config,
    pub flat_manager: FlatManagerClient,
    pub github: GitHubService,
    pub ecs_client: aws_sdk_ecs::Client,
    pub ec2_client: aws_sdk_ec2::Client,
}

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/v1/health", get(health_check))
        .nest("/api/v1", routes::auth::routes())
        .nest("/api/v1", routes::apps::routes())
        .nest("/api/v1", routes::submissions::routes())
        .nest("/api/v1", routes::webhooks::routes())
        .nest("/api/v1", routes::review::routes())
        .nest("/api/v1", routes::internal::routes())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn health_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<Value> {
    let db_ok = state
        .db
        .client
        .describe_table()
        .table_name(&state.db.table)
        .send()
        .await
        .is_ok();

    Json(json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "service": "friendlyhub-api",
        "database": if db_ok { "connected" } else { "disconnected" },
    }))
}
