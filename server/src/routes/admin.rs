use axum::{
    extract::{Path, State},
    routing::{delete, get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::auth::middleware::AdminUser;
use crate::errors::AppError;
use crate::models::user;
use crate::router::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(list_users))
        .route("/admin/users/{id}/role", put(update_role))
        .route("/admin/users/{id}", delete(delete_user))
}

async fn list_users(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<Vec<user::UserResponse>>, AppError> {
    let users = user::list_all(&state.db).await?;
    let responses: Vec<user::UserResponse> = users.into_iter().map(Into::into).collect();
    Ok(Json(responses))
}

#[derive(Debug, Deserialize)]
struct UpdateRole {
    role: String,
}

async fn update_role(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRole>,
) -> Result<Json<Value>, AppError> {
    if !matches!(input.role.as_str(), "developer" | "reviewer" | "admin") {
        return Err(AppError::BadRequest(
            "Role must be 'developer', 'reviewer', or 'admin'".into(),
        ));
    }

    // Prevent admin from demoting themselves
    if admin.0.user_id == id && input.role != "admin" {
        return Err(AppError::BadRequest(
            "Cannot change your own role".into(),
        ));
    }

    user::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    user::update_role(&state.db, id, &input.role).await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn delete_user(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    if admin.0.user_id == id {
        return Err(AppError::BadRequest("Cannot delete yourself".into()));
    }

    user::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    user::delete(&state.db, id).await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}
