mod auth;
mod config;
mod db;
mod errors;
mod models;
mod router;
mod routes;
mod services;

use config::Config;
use db::Db;
use router::{build_router, AppState};
use services::flat_manager::FlatManagerClient;
use services::github::GitHubService;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let config = Config::from_env();
    let listen_addr = config.listen_addr();

    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&aws_config);
    let db = Db::new(dynamodb_client, config.dynamodb_table.clone());

    tracing::info!("Using DynamoDB table: {}", config.dynamodb_table);

    let ecs_client = aws_sdk_ecs::Client::new(&aws_config);
    let ec2_client = aws_sdk_ec2::Client::new(&aws_config);
    let s3_client = aws_sdk_s3::Client::new(&aws_config);

    let flat_manager = FlatManagerClient::new(
        &config.flat_manager_token,
        ecs_client.clone(),
        ec2_client.clone(),
        config.ecs_cluster.clone(),
        config.ecs_service.clone(),
    );

    let github = GitHubService::new(
        &config.github_org,
        &config.github_app_id,
        &config.github_app_installation_id,
        &config.github_app_private_key,
    );

    let state = AppState {
        db,
        config,
        flat_manager,
        github,
        ecs_client,
        ec2_client,
        s3_client,
    };

    let app = build_router(state);
    let listener = tokio::net::TcpListener::bind(&listen_addr)
        .await
        .expect("Failed to bind to address");
    tracing::info!("FriendlyHub API listening on {listen_addr}");
    axum::serve(listener, app)
        .await
        .expect("Server failed");
}
