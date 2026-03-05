use reqwest::Client;
use serde::Deserialize;

use crate::errors::AppError;

/// GitHub API client for managing build repos and triggering workflows.
#[derive(Clone)]
pub struct GitHubService {
    client: Client,
    org: String,
    /// Personal access token or GitHub App token with repo + workflow permissions.
    token: String,
}

#[derive(Debug, Deserialize)]
struct WorkflowDispatchResponse {
    // GitHub returns 204 No Content on success, so this is unused
}

impl GitHubService {
    pub fn new(org: &str, token: &str) -> Self {
        Self {
            client: Client::new(),
            org: org.to_string(),
            token: token.to_string(),
        }
    }

    /// Trigger a GitHub Actions workflow_dispatch event on a repo.
    /// Returns the run URL if we can determine it.
    pub async fn trigger_build(
        &self,
        repo: &str,
        workflow_file: &str,
        branch: &str,
        inputs: &serde_json::Value,
    ) -> Result<(), AppError> {
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/actions/workflows/{workflow_file}/dispatches",
            self.org
        );

        let body = serde_json::json!({
            "ref": branch,
            "inputs": inputs,
        });

        let resp = self
            .client
            .post(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&self.token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub workflow dispatch returned {status}: {body}"
            )));
        }

        Ok(())
    }

    /// List recent workflow runs to find the run triggered by our dispatch.
    pub async fn find_latest_run(
        &self,
        repo: &str,
        workflow_file: &str,
    ) -> Result<Option<WorkflowRun>, AppError> {
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/actions/workflows/{workflow_file}/runs?per_page=1",
            self.org
        );

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub list runs returned {status}: {body}"
            )));
        }

        let body: WorkflowRunsResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitHub response: {e}")))?;

        Ok(body.workflow_runs.into_iter().next())
    }

    /// Check if a repository exists in the org.
    pub async fn repo_exists(&self, repo: &str) -> Result<bool, AppError> {
        let url = format!("https://api.github.com/repos/{}/{repo}", self.org);

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        Ok(resp.status().is_success())
    }
}

#[derive(Debug, Deserialize)]
pub struct WorkflowRun {
    pub id: i64,
    pub html_url: String,
    pub status: String,
    pub conclusion: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WorkflowRunsResponse {
    workflow_runs: Vec<WorkflowRun>,
}
