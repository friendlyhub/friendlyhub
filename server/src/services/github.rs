use std::sync::Arc;

use chrono::Utc;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

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

struct CachedToken {
    token: String,
    expires_at: chrono::DateTime<Utc>,
}

#[derive(Serialize)]
struct AppJwtClaims {
    iat: i64,
    exp: i64,
    iss: String,
}

#[derive(Deserialize)]
struct InstallationTokenResponse {
    token: String,
    expires_at: String,
}

/// GitHub API client using GitHub App authentication.
#[derive(Clone)]
pub struct GitHubService {
    client: Client,
    org: String,
    app_id: String,
    installation_id: String,
    private_key_pem: String,
    token_cache: Arc<RwLock<Option<CachedToken>>>,
}

impl GitHubService {
    pub fn new(org: &str, app_id: &str, installation_id: &str, private_key_pem: &str) -> Self {
        Self {
            client: Client::new(),
            org: org.to_string(),
            app_id: app_id.to_string(),
            installation_id: installation_id.to_string(),
            private_key_pem: private_key_pem.to_string(),
            token_cache: Arc::new(RwLock::new(None)),
        }
    }

    fn generate_app_jwt(&self) -> Result<String, AppError> {
        let now = Utc::now().timestamp();
        let claims = AppJwtClaims {
            iat: now - 60,
            exp: now + 540,
            iss: self.app_id.clone(),
        };
        let header = Header::new(Algorithm::RS256);
        let key = EncodingKey::from_rsa_pem(self.private_key_pem.as_bytes())
            .map_err(|e| AppError::Internal(format!("Invalid GitHub App private key: {e}")))?;
        encode(&header, &claims, &key)
            .map_err(|e| AppError::Internal(format!("Failed to generate GitHub App JWT: {e}")))
    }

    async fn fetch_installation_token(&self) -> Result<CachedToken, AppError> {
        let jwt = self.generate_app_jwt()?;
        let url = format!(
            "https://api.github.com/app/installations/{}/access_tokens",
            self.installation_id
        );

        let resp = self
            .client
            .post(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&jwt)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch installation token: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub installation token request returned {status}: {body}"
            )));
        }

        let body: InstallationTokenResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse installation token response: {e}")))?;

        let expires_at = chrono::DateTime::parse_from_rfc3339(&body.expires_at)
            .map_err(|e| AppError::Internal(format!("Failed to parse token expiry: {e}")))?
            .with_timezone(&Utc);

        tracing::debug!("Fetched new GitHub App installation token, expires at {expires_at}");

        Ok(CachedToken {
            token: body.token,
            expires_at,
        })
    }

    async fn invalidate_token(&self) {
        let mut cache = self.token_cache.write().await;
        *cache = None;
    }

    async fn get_token(&self) -> Result<String, AppError> {
        {
            let cache = self.token_cache.read().await;
            if let Some(ref cached) = *cache {
                if cached.expires_at > Utc::now() + chrono::Duration::minutes(5) {
                    return Ok(cached.token.clone());
                }
            }
        }

        let mut cache = self.token_cache.write().await;
        if let Some(ref cached) = *cache {
            if cached.expires_at > Utc::now() + chrono::Duration::minutes(5) {
                return Ok(cached.token.clone());
            }
        }

        let new_token = self.fetch_installation_token().await?;
        let token = new_token.token.clone();
        *cache = Some(new_token);
        Ok(token)
    }

    /// Create a new repo in the org for a Flatpak app.
    pub async fn create_repo(&self, repo: &str, description: &str) -> Result<(), AppError> {
        let token = self.get_token().await?;
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
            .bearer_auth(&token)
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

        // Invalidate cached token and wait until we can actually access the new repo
        self.invalidate_token().await;
        for attempt in 1..=10 {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let token = self.get_token().await?;
            let check_url = format!("https://api.github.com/repos/{}/{repo}/contents/", self.org);
            let check = self
                .client
                .get(&check_url)
                .header("User-Agent", "friendlyhub-api")
                .header("Accept", "application/vnd.github+json")
                .bearer_auth(&token)
                .send()
                .await;
            match check {
                Ok(r) if r.status().is_success() => {
                    tracing::info!(repo = repo, attempt = attempt, "Repo is accessible");
                    break;
                }
                Ok(r) => {
                    tracing::warn!(repo = repo, attempt = attempt, status = %r.status(), "Repo not yet accessible");
                    // Invalidate again in case the token needs refreshing
                    self.invalidate_token().await;
                }
                Err(e) => {
                    tracing::warn!(repo = repo, attempt = attempt, error = %e, "Repo check failed");
                }
            }
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

        let encoded = base64_encode(content.as_bytes());

        let mut attempts = 0;
        loop {
            attempts += 1;
            let token = self.get_token().await?;

            // Check if file already exists to get its SHA (required for updates)
            let existing_sha = self.get_file_sha(repo, path).await?;

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
                .bearer_auth(&token)
                .json(&body)
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

            if resp.status().is_success() {
                return Ok(());
            }

            let status = resp.status();
            let resp_body = resp.text().await.unwrap_or_default();

            if status.as_u16() == 403 && attempts < 4 {
                tracing::warn!(
                    repo = repo,
                    path = path,
                    attempt = attempts,
                    "put_file got 403, invalidating token and retrying"
                );
                self.invalidate_token().await;
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                continue;
            }

            return Err(AppError::Internal(format!(
                "GitHub put file returned {status}: {resp_body}"
            )));
        }
    }

    /// Get the SHA of a file in a repo (None if it doesn't exist).
    async fn get_file_sha(&self, repo: &str, path: &str) -> Result<Option<String>, AppError> {
        let token = self.get_token().await?;
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/contents/{path}",
            self.org
        );

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
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

        // Retry on 404 — GitHub may not have indexed a newly-pushed workflow yet
        let mut attempts = 0;
        loop {
            attempts += 1;
            let token = self.get_token().await?;
            let resp = self
                .client
                .post(&url)
                .header("User-Agent", "friendlyhub-api")
                .header("Accept", "application/vnd.github+json")
                .bearer_auth(&token)
                .json(&body)
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

            if resp.status().is_success() {
                return Ok(());
            }

            let status = resp.status();
            let resp_body = resp.text().await.unwrap_or_default();

            if status.as_u16() == 404 && attempts < 4 {
                tracing::warn!(
                    repo = repo,
                    workflow = workflow_file,
                    attempt = attempts,
                    "Workflow dispatch got 404, retrying after delay"
                );
                tokio::time::sleep(std::time::Duration::from_secs(5 * attempts as u64)).await;
                continue;
            }

            return Err(AppError::Internal(format!(
                "GitHub workflow dispatch returned {status}: {resp_body}"
            )));
        }
    }

    /// Delete a repository from the org.
    pub async fn delete_repo(&self, repo: &str) -> Result<(), AppError> {
        let token = self.get_token().await?;
        let url = format!("https://api.github.com/repos/{}/{repo}", self.org);

        let resp = self
            .client
            .delete(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            // Repo already gone, that's fine
            return Ok(());
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub delete repo returned {status}: {body}"
            )));
        }

        Ok(())
    }

    /// List files in the root of a repo, returning name + download_url for each.
    pub async fn list_repo_files(&self, repo: &str) -> Result<Vec<RepoFile>, AppError> {
        let token = self.get_token().await?;
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/contents/",
            self.org
        );

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(vec![]);
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub list contents returned {status}: {body}"
            )));
        }

        let items: Vec<GitHubContentItem> = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitHub response: {e}")))?;

        Ok(items
            .into_iter()
            .filter(|item| item.item_type == "file")
            .map(|item| RepoFile {
                name: item.name,
                download_url: item.download_url.unwrap_or_default(),
            })
            .collect())
    }

    /// Get workflow run jobs (for build progress proxying).
    pub async fn get_run_jobs(&self, repo: &str, run_id: i64) -> Result<serde_json::Value, AppError> {
        let token = self.get_token().await?;
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/actions/runs/{run_id}/jobs",
            self.org
        );

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub get run jobs returned {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitHub response: {e}")))
    }

    /// Look up a GitHub user by login name. Returns their numeric ID and profile info.
    pub async fn get_user_by_login(&self, username: &str) -> Result<GitHubUser, AppError> {
        let token = self.get_token().await?;
        let url = format!("https://api.github.com/users/{username}");

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::NotFound(format!("GitHub user '{username}' not found")));
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub get user returned {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitHub response: {e}")))
    }

    /// Add a user as a collaborator on an org repo.
    pub async fn add_collaborator(
        &self,
        repo: &str,
        username: &str,
        permission: &str,
    ) -> Result<(), AppError> {
        let token = self.get_token().await?;
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/collaborators/{username}",
            self.org
        );

        let body = serde_json::json!({
            "permission": permission,
        });

        let resp = self
            .client
            .put(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub add collaborator returned {status}: {body}"
            )));
        }

        Ok(())
    }

    /// Get a file's raw content from a repo.
    pub async fn get_file_content(&self, repo: &str, path: &str) -> Result<String, AppError> {
        let token = self.get_token().await?;
        let url = format!(
            "https://api.github.com/repos/{}/{repo}/contents/{path}",
            self.org
        );

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github.raw+json")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub get file returned {status}: {body}"
            )));
        }

        resp.text()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read GitHub response: {e}")))
    }

    /// Check if a repository exists in the org.
    pub async fn repo_exists(&self, repo: &str) -> Result<bool, AppError> {
        let token = self.get_token().await?;
        let url = format!("https://api.github.com/repos/{}/{repo}", self.org);

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        Ok(resp.status().is_success())
    }

    /// Create an issue on a repo in the org.
    pub async fn create_issue(
        &self,
        repo: &str,
        title: &str,
        body: &str,
        labels: &[&str],
    ) -> Result<(), AppError> {
        let token = self.get_token().await?;
        let url = format!("https://api.github.com/repos/{}/{repo}/issues", self.org);

        let payload = serde_json::json!({
            "title": title,
            "body": body,
            "labels": labels,
        });

        let resp = self
            .client
            .post(&url)
            .header("User-Agent", "friendlyhub-api")
            .header("Accept", "application/vnd.github+json")
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub API call failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub create issue returned {status}: {body}"
            )));
        }

        Ok(())
    }
}

#[derive(Debug, Deserialize)]
struct GitHubContentItem {
    name: String,
    #[serde(rename = "type")]
    item_type: String,
    download_url: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RepoFile {
    pub name: String,
    pub download_url: String,
}

#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub id: i64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}
