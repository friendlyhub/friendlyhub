use reqwest::Client;
use serde::Deserialize;

use crate::errors::AppError;

/// Simple base64 encoding (standard alphabet, with padding).
fn base64_encode(input: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[(triple >> 18 & 0x3F) as usize] as char);
        result.push(CHARS[(triple >> 12 & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[(triple >> 6 & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

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

    pub fn org(&self) -> &str {
        &self.org
    }

    /// Create a new repo in the org for a Flatpak app.
    pub async fn create_repo(&self, repo: &str, description: &str) -> Result<(), AppError> {
        let url = format!("https://api.github.com/orgs/{}/repos", self.org);

        let body = serde_json::json!({
            "name": repo,
            "description": description,
            "private": false,
            "auto_init": true,
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
                "GitHub create repo returned {status}: {body}"
            )));
        }

        Ok(())
    }

    /// Create or update a file in a repo (used to push workflow + manifest).
    pub async fn put_file(
        &self,
        repo: &str,
        path: &str,
        content: &str,
        message: &str,
    ) -> Result<(), AppError> {
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/contents/{path}",
            self.org
        );

        // Check if file already exists to get its SHA (required for updates)
        let existing_sha = self.get_file_sha(repo, path).await?;

        let encoded = base64_encode(content.as_bytes());
        let mut body = serde_json::json!({
            "message": message,
            "content": encoded,
        });
        if let Some(sha) = existing_sha {
            body["sha"] = serde_json::Value::String(sha);
        }

        let resp = self
            .client
            .put(&url)
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
                "GitHub put file returned {status}: {body}"
            )));
        }

        Ok(())
    }

    /// Get the SHA of a file in a repo (None if it doesn't exist).
    async fn get_file_sha(&self, repo: &str, path: &str) -> Result<Option<String>, AppError> {
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/contents/{path}",
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

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub get file returned {status}: {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitHub response: {e}")))?;

        Ok(body["sha"].as_str().map(String::from))
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
