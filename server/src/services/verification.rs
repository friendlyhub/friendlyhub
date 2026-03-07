use reqwest::Client;

use crate::errors::AppError;

/// Known forge prefixes and their domains.
const FORGE_PREFIXES: &[(&str, &str)] = &[
    ("io.github.", "github.com"),
];

/// Extract the forge username/org from an app ID if it uses a known forge prefix.
/// Returns (forge_domain, username) e.g. ("github.com", "bob").
pub fn parse_forge_id(app_id: &str) -> Option<(&str, String)> {
    for &(prefix, domain) in FORGE_PREFIXES {
        if let Some(rest) = app_id.strip_prefix(prefix) {
            // rest is e.g. "bob.MyApp" — take the first component
            if let Some(username) = rest.split('.').next() {
                if !username.is_empty() {
                    return Some((domain, username.to_string()));
                }
            }
        }
    }
    None
}

/// Extract the domain from a reverse-DNS app ID (non-forge).
/// e.g. "com.kahunasoft.DildoRate" -> "kahunasoft.com"
pub fn extract_domain(app_id: &str) -> Option<String> {
    let parts: Vec<&str> = app_id.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    // Reverse the first two components: com.kahunasoft -> kahunasoft.com
    Some(format!("{}.{}", parts[1], parts[0]))
}

/// Validate app ID format: reverse-DNS, at least 3 components, valid chars.
pub fn validate_app_id(app_id: &str) -> Result<(), String> {
    let parts: Vec<&str> = app_id.split('.').collect();
    if parts.len() < 3 {
        return Err("App ID must have at least 3 components (e.g. org.example.MyApp)".into());
    }
    for part in &parts {
        if part.is_empty() {
            return Err("App ID components cannot be empty".into());
        }
        if !part.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err("App ID components can only contain alphanumeric characters, hyphens, and underscores".into());
        }
    }
    Ok(())
}

/// Verify domain ownership by checking the well-known URL for the token.
pub async fn verify_domain_token(domain: &str, expected_token: &str) -> Result<bool, AppError> {
    let url = format!("https://{domain}/.well-known/org.friendlyhub.VerifiedApps.txt");
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {e}")))?;

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return Ok(false),
    };

    if !resp.status().is_success() {
        return Ok(false);
    }

    let body = resp.text().await.unwrap_or_default();
    // Check if any line in the file contains the token
    Ok(body.lines().any(|line| line.trim() == expected_token))
}

/// Check if a GitHub user is the owner of a GitHub org.
/// Uses the user's OAuth access token (requires read:org scope).
pub async fn check_github_org_ownership(
    user_access_token: &str,
    org_name: &str,
) -> Result<bool, AppError> {
    let client = Client::new();
    let url = format!("https://api.github.com/user/memberships/orgs/{org_name}");

    let resp = client
        .get(&url)
        .header("User-Agent", "FriendlyHub")
        .header("Authorization", format!("Bearer {user_access_token}"))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("GitHub API request failed: {e}")))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND
        || resp.status() == reqwest::StatusCode::FORBIDDEN
    {
        return Ok(false);
    }

    if !resp.status().is_success() {
        return Ok(false);
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse GitHub response: {e}")))?;

    // Check if the user's role is "admin" (org owner)
    Ok(body["role"].as_str() == Some("admin"))
}
