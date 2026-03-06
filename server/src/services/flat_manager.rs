use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

/// Resolve the current flat-manager URL by querying ECS for the running task's public IP.
pub async fn discover_url(
    ecs_client: &aws_sdk_ecs::Client,
    ec2_client: &aws_sdk_ec2::Client,
    cluster: &str,
    service: &str,
) -> Result<String, AppError> {
    let tasks = ecs_client
        .list_tasks()
        .cluster(cluster)
        .service_name(service)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ECS ListTasks failed: {e}")))?;

    let task_arn = tasks
        .task_arns()
        .first()
        .ok_or_else(|| AppError::Internal("No running flat-manager tasks".into()))?;

    let described = ecs_client
        .describe_tasks()
        .cluster(cluster)
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

    let enis = ec2_client
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

    Ok(format!("http://{}:8080", public_ip))
}

/// HTTP client for the flat-manager API.
/// See: https://github.com/flatpak/flat-manager
#[derive(Clone)]
pub struct FlatManagerClient {
    client: Client,
    token: String,
    ecs_client: aws_sdk_ecs::Client,
    ec2_client: aws_sdk_ec2::Client,
    ecs_cluster: String,
    ecs_service: String,
}

#[derive(Debug, Deserialize)]
pub struct Build {
    pub id: i32,
    pub repo: String,
}

#[derive(Debug, Serialize)]
struct CreateBuildRequest<'a> {
    repo: &'a str,
}

#[derive(Debug, Deserialize)]
pub struct BuildStatus {
    pub id: i32,
    pub repo: String,
    #[serde(default)]
    pub status: Option<String>,
}

impl FlatManagerClient {
    pub fn new(
        token: &str,
        ecs_client: aws_sdk_ecs::Client,
        ec2_client: aws_sdk_ec2::Client,
        ecs_cluster: String,
        ecs_service: String,
    ) -> Self {
        Self {
            client: Client::new(),
            token: token.to_string(),
            ecs_client,
            ec2_client,
            ecs_cluster,
            ecs_service,
        }
    }

    /// Discover the current flat-manager URL from ECS.
    async fn base_url(&self) -> Result<String, AppError> {
        discover_url(&self.ecs_client, &self.ec2_client, &self.ecs_cluster, &self.ecs_service).await
    }

    /// Create a new build in flat-manager. Returns the build ID and repo path.
    pub async fn create_build(&self, repo: &str) -> Result<Build, AppError> {
        let base_url = self.base_url().await?;
        let resp = self
            .client
            .post(format!("{base_url}/api/v1/build"))
            .bearer_auth(&self.token)
            .json(&CreateBuildRequest { repo })
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("flat-manager create build failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "flat-manager create build returned {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse flat-manager response: {e}")))
    }

    /// Get the status of a build.
    pub async fn get_build(&self, build_id: i32) -> Result<BuildStatus, AppError> {
        let base_url = self.base_url().await?;
        let resp = self
            .client
            .get(format!("{base_url}/api/v1/build/{build_id}"))
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("flat-manager get build failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "flat-manager get build returned {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse flat-manager response: {e}")))
    }

    /// Commit a build (finalize uploads, mark ready for publish).
    pub async fn commit_build(&self, build_id: i32) -> Result<(), AppError> {
        let base_url = self.base_url().await?;
        let resp = self
            .client
            .post(format!("{base_url}/api/v1/build/{build_id}/commit"))
            .bearer_auth(&self.token)
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("flat-manager commit failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "flat-manager commit returned {status}: {body}"
            )));
        }

        Ok(())
    }

    /// Publish a committed build to the public repository.
    pub async fn publish_build(&self, build_id: i32) -> Result<(), AppError> {
        let base_url = self.base_url().await?;
        let resp = self
            .client
            .post(format!("{base_url}/api/v1/build/{build_id}/publish"))
            .bearer_auth(&self.token)
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("flat-manager publish failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "flat-manager publish returned {status}: {body}"
            )));
        }

        Ok(())
    }
}
