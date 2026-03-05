use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

/// HTTP client for the flat-manager API.
/// See: https://github.com/flatpak/flat-manager
#[derive(Clone)]
pub struct FlatManagerClient {
    client: Client,
    base_url: String,
    token: String,
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
    pub fn new(base_url: &str, token: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
        }
    }

    /// Create a new build in flat-manager. Returns the build ID and repo path.
    pub async fn create_build(&self, repo: &str) -> Result<Build, AppError> {
        let resp = self
            .client
            .post(format!("{}/api/v1/build", self.base_url))
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
        let resp = self
            .client
            .get(format!("{}/api/v1/build/{build_id}", self.base_url))
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
        let resp = self
            .client
            .post(format!("{}/api/v1/build/{build_id}/commit", self.base_url))
            .bearer_auth(&self.token)
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
        let resp = self
            .client
            .post(format!("{}/api/v1/build/{build_id}/publish", self.base_url))
            .bearer_auth(&self.token)
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
