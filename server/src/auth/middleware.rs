use axum::{
    extract::FromRequestParts,
    http::request::Parts,
};
use uuid::Uuid;

use crate::errors::AppError;
use crate::router::AppState;

use super::jwt;

/// Extractor that validates JWT from Authorization header and provides the authenticated user.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub role: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let claims = jwt::verify_token(token, &state.config.jwt_secret)
            .map_err(|_| AppError::Unauthorized)?;

        Ok(AuthUser {
            user_id: claims.sub,
            role: claims.role,
        })
    }
}

/// Extractor that requires the user to be a reviewer or admin.
#[derive(Debug, Clone)]
pub struct ReviewerUser(pub AuthUser);

impl FromRequestParts<AppState> for ReviewerUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        match user.role.as_str() {
            "reviewer" | "admin" => Ok(ReviewerUser(user)),
            _ => Err(AppError::Forbidden),
        }
    }
}

/// Extractor that requires admin role.
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl FromRequestParts<AppState> for AdminUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if user.role == "admin" {
            Ok(AdminUser(user))
        } else {
            Err(AppError::Forbidden)
        }
    }
}
