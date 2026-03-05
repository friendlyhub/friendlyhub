use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::errors::AppError;
use crate::router::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/internal/flat-manager-url", get(flat_manager_url))
}

async fn flat_manager_url(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let tasks = state
        .ecs_client
        .list_tasks()
        .cluster(&state.config.ecs_cluster)
        .service_name(&state.config.ecs_service)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ECS ListTasks failed: {e}")))?;

    let task_arn = tasks
        .task_arns()
        .first()
        .ok_or_else(|| AppError::Internal("No running flat-manager tasks".into()))?;

    let described = state
        .ecs_client
        .describe_tasks()
        .cluster(&state.config.ecs_cluster)
        .tasks(task_arn)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ECS DescribeTasks failed: {e}")))?;

    let task = described
        .tasks()
        .first()
        .ok_or_else(|| AppError::Internal("Task not found".into()))?;

    let eni_id = task
        .attachments()
        .iter()
        .flat_map(|a| a.details())
        .find(|d| d.name() == Some("networkInterfaceId"))
        .and_then(|d| d.value())
        .ok_or_else(|| AppError::Internal("No ENI found on task".into()))?;

    let enis = state
        .ec2_client
        .describe_network_interfaces()
        .network_interface_ids(eni_id)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("EC2 DescribeNetworkInterfaces failed: {e}")))?;

    let public_ip = enis
        .network_interfaces()
        .first()
        .and_then(|ni| ni.association())
        .and_then(|a| a.public_ip())
        .ok_or_else(|| AppError::Internal("No public IP on flat-manager task".into()))?;

    Ok(Json(json!({
        "url": format!("http://{}:8080", public_ip)
    })))
}
