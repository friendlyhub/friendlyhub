use axum::{
    extract::{Query, State},
    response::Redirect,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::{github_oauth, jwt, middleware::AuthUser};
use crate::errors::AppError;
use crate::models::user;
use crate::router::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/github", get(github_login))
        .route("/auth/github/callback", get(github_callback))
        .route("/auth/me", get(me))
}

/// Redirects the user to GitHub's OAuth authorization page.
async fn github_login(State(state): State<AppState>) -> Redirect {
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&scope=read:user,user:email,read:org",
        state.config.github_client_id
    );
    Redirect::temporary(&url)
}

#[derive(Deserialize)]
struct CallbackParams {
    code: String,
}

/// GitHub redirects here after the user authorizes. We exchange the code for a token,
/// fetch the user profile, upsert into our DB, and redirect to the frontend with a JWT.
async fn github_callback(
    State(state): State<AppState>,
    Query(params): Query<CallbackParams>,
) -> Result<Redirect, AppError> {
    let access_token = github_oauth::exchange_code(
        &state.config.github_client_id,
        &state.config.github_client_secret,
        &params.code,
    )
    .await?;

    let gh_user = github_oauth::get_user(&access_token).await?;

    let display_name = gh_user.name.unwrap_or_else(|| gh_user.login.clone());
    let db_user = user::upsert_from_github(
        &state.db,
        gh_user.id,
        &gh_user.login,
        &display_name,
        gh_user.email.as_deref(),
        gh_user.avatar_url.as_deref(),
        Some(&access_token),
    )
    .await?;

    let token = jwt::create_token(db_user.id, &db_user.role, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Failed to create JWT: {e}")))?;

    let redirect_url = format!("{}/auth/callback?token={token}", state.config.frontend_url);
    Ok(Redirect::temporary(&redirect_url))
}

/// Returns the currently authenticated user's profile.
async fn me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, AppError> {
    let db_user = user::find_by_id(&state.db, auth.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(json!(user::UserResponse::from(db_user))))
}
