use crate::error::AppError;
use crate::models::PinWindow;
use crate::repositories::{pin_windows as repo, todos as todo_repo};
use crate::state::AppState;

/// Pure DB-side pin window operations. Window (webview) orchestration lives in
/// the app shell crate so the domain core stays free of UI dependencies.
pub fn list(state: &AppState) -> Result<Vec<PinWindow>, AppError> {
    state.db.with(|conn| repo::list(conn))
}

pub fn get(state: &AppState, id: String) -> Result<PinWindow, AppError> {
    state.db.with(|conn| {
        repo::get(conn, &id)?
            .ok_or_else(|| AppError::NotFound(format!("pin window {id} not found")))
    })
}

/// Finds an existing window that already contains any of the given todos.
/// Used to avoid creating duplicate pin windows for the same todo (#4).
pub fn find_by_members(
    state: &AppState,
    todo_ids: &[String],
) -> Result<Option<PinWindow>, AppError> {
    state.db.with(|conn| {
        let windows = repo::list(conn)?;
        Ok(windows
            .into_iter()
            .find(|w| todo_ids.iter().any(|id| w.members.contains(id))))
    })
}

/// Creates a pin window row. `todo_ids` with one entry is the "single pin"
/// mode; multiple entries is the "merged pin" mode.
pub fn create(state: &AppState, todo_ids: Vec<String>) -> Result<PinWindow, AppError> {
    if todo_ids.is_empty() {
        return Err(AppError::Validation("at least one todo is required".to_string()));
    }
    state.db.with(|conn| {
        let mut members: Vec<String> = Vec::new();
        for id in &todo_ids {
            if todo_repo::get(conn, id)?.is_none() {
                return Err(AppError::NotFound(format!("todo {id} not found")));
            }
            if !members.contains(id) {
                members.push(id.clone());
            }
        }
        repo::insert(conn, &members)
    })
}

pub fn add_member(state: &AppState, id: String, todo_id: String) -> Result<PinWindow, AppError> {
    state.db.with(|conn| {
        let current = repo::get(conn, &id)?
            .ok_or_else(|| AppError::NotFound(format!("pin window {id} not found")))?;
        if todo_repo::get(conn, &todo_id)?.is_none() {
            return Err(AppError::NotFound(format!("todo {todo_id} not found")));
        }
        if current.members.contains(&todo_id) {
            return Ok(current);
        }
        let mut members = current.members.clone();
        members.push(todo_id);
        repo::update_members(conn, &id, &members)
    })
}

/// Returns `None` when the last member was removed — the caller is expected to
/// close the window and delete the row.
pub fn remove_member(
    state: &AppState,
    id: String,
    todo_id: String,
) -> Result<Option<PinWindow>, AppError> {
    state.db.with(|conn| {
        let current = repo::get(conn, &id)?
            .ok_or_else(|| AppError::NotFound(format!("pin window {id} not found")))?;
        let members: Vec<String> =
            current.members.iter().filter(|m| *m != &todo_id).cloned().collect();
        if members.is_empty() {
            return Ok(None);
        }
        Ok(Some(repo::update_members(conn, &id, &members)?))
    })
}

pub fn delete(state: &AppState, id: String) -> Result<(), AppError> {
    state.db.with(|conn| repo::delete(conn, &id))
}

pub fn reorder_members(state: &AppState, id: String, ids: Vec<String>) -> Result<PinWindow, AppError> {
    state.db.with(|conn| {
        let current = repo::get(conn, &id)?
            .ok_or_else(|| AppError::NotFound(format!("pin window {id} not found")))?;
        if ids.len() != current.members.len()
            || !ids.iter().all(|id| current.members.contains(id))
        {
            return Err(AppError::Validation(
                "reorder payload does not match window members".to_string(),
            ));
        }
        repo::update_members(conn, &id, &ids)
    })
}

pub fn set_active(state: &AppState, id: String, todo_id: String) -> Result<PinWindow, AppError> {
    state.db.with(|conn| {
        let current = repo::get(conn, &id)?
            .ok_or_else(|| AppError::NotFound(format!("pin window {id} not found")))?;
        if !current.members.contains(&todo_id) {
            return Err(AppError::Validation(
                "todo is not a member of this window".to_string(),
            ));
        }
        repo::set_active(conn, &id, &todo_id)
    })
}

pub fn save_position(
    state: &AppState,
    id: String,
    x: i64,
    y: i64,
    width: i64,
    height: i64,
) -> Result<PinWindow, AppError> {
    state.db.with(|conn| repo::save_position(conn, &id, x, y, width, height))
}

pub fn set_always_on_top(state: &AppState, id: String, value: bool) -> Result<PinWindow, AppError> {
    state.db.with(|conn| repo::set_always_on_top(conn, &id, value))
}
