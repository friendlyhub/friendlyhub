use reqwest::Client;
use serde::Deserialize;

use crate::errors::AppError;

#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub id: i64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: String,
}

/// Exchange an OAuth code for a GitHub access token.
pub async fn exchange_code(
    client_id: &str,
    client_secret: &str,
    code: &str,
) -> Result<String, AppError> {
    let client = Client::new();
    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("GitHub OAuth request failed: {e}")))?;

    let token_resp: AccessTokenResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse GitHub token response: {e}")))?;

    Ok(token_resp.access_token)
}

/// Fetch the authenticated GitHub user's profile.
pub async fn get_user(access_token: &str) -> Result<GitHubUser, AppError> {
    let client = Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("User-Agent", "FriendlyHub")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("GitHub API request failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "GitHub API returned {}",
            resp.status()
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse GitHub user: {e}")))
}
