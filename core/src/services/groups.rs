use crate::error::AppError;
use crate::models::{DeleteGroupInput, Group};
use crate::repositories::{groups as repo, todos as todo_repo};
use crate::state::AppState;

pub fn create(
    state: &AppState,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Group, AppError> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Validation("group name must not be empty".to_string()));
    }
    state.db.with(|conn| {
        repo::insert(
            conn,
            &crate::models::CreateGroupInput { name, color, icon },
        )
    })
}

pub fn list(state: &AppState, include_archived: bool) -> Result<Vec<Group>, AppError> {
    state.db.with(|conn| repo::list(conn, include_archived))
}

pub fn update(state: &AppState, input: crate::models::UpdateGroupInput) -> Result<Group, AppError> {
    if let Some(name) = &input.name {
        if name.trim().is_empty() {
            return Err(AppError::Validation("group name must not be empty".to_string()));
        }
    }
    state.db.with(|conn| repo::update(conn, &input))
}

pub fn delete(state: &AppState, input: DeleteGroupInput) -> Result<(), AppError> {
    match input.mode.as_str() {
        "migrate" => {
            let target = input
                .target_group_id
                .clone()
                .ok_or_else(|| AppError::Validation("target_group_id required for migrate".to_string()))?;
            if target == input.id {
                return Err(AppError::Validation("cannot migrate into the group being deleted".to_string()));
            }
            state.db.with(|conn| {
                if repo::get(conn, &input.id)?.is_none() {
                    return Err(AppError::NotFound(format!("group {} not found", input.id)));
                }
                if repo::get(conn, &target)?.is_none() {
                    return Err(AppError::NotFound(format!("target group {target} not found")));
                }
                todo_repo::reassign_group(conn, &input.id, &target)?;
                repo::delete(conn, &input.id)
            })
        }
        "cascade" => state.db.with(|conn| repo::delete(conn, &input.id)),
        other => Err(AppError::Validation(format!("unknown delete mode: {other}"))),
    }
}

pub fn reorder(state: &AppState, ids: Vec<String>) -> Result<(), AppError> {
    state.db.with(|conn| repo::reorder(conn, &ids))
}
