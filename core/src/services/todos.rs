use crate::error::AppError;
use crate::models::{CreateTodoInput, Todo, UpdateTodoInput};
use crate::repositories::{groups as group_repo, pin_windows as pin_repo, todos as repo};
use crate::state::AppState;

const VALID_STATUSES: [&str; 5] = ["notStarted", "inProgress", "completed", "blocked", "archived"];

pub fn validate_dates(start: &Option<String>, end: &Option<String>) -> Result<(), AppError> {
    if let (Some(s), Some(e)) = (start, end) {
        if !s.is_empty() && !e.is_empty() && e < s {
            return Err(AppError::Validation(
                "end date must not be before start date".to_string(),
            ));
        }
    }
    Ok(())
}

pub fn validate_priority(priority: i64) -> Result<(), AppError> {
    if !(0..=3).contains(&priority) {
        return Err(AppError::Validation(format!("priority must be 0..3, got {priority}")));
    }
    Ok(())
}

pub fn validate_status(status: &str) -> Result<(), AppError> {
    if !VALID_STATUSES.contains(&status) {
        return Err(AppError::Validation(format!("unknown status: {status}")));
    }
    Ok(())
}

pub fn list(state: &AppState, group_id: Option<String>) -> Result<Vec<Todo>, AppError> {
    state.db.with(|conn| match group_id {
        Some(id) => repo::list_by_group(conn, &id),
        None => repo::list_all(conn),
    })
}

pub fn create(
    state: &AppState,
    group_id: String,
    title: String,
    description: Option<String>,
    priority: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Todo, AppError> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::Validation("todo title must not be empty".to_string()));
    }
    validate_dates(&start_date, &end_date)?;
    let priority = priority.unwrap_or(2);
    validate_priority(priority)?;
    state.db.with(|conn| {
        if group_repo::get(conn, &group_id)?.is_none() {
            return Err(AppError::NotFound(format!("group {group_id} not found")));
        }
        repo::insert(
            conn,
            &CreateTodoInput {
                group_id,
                title,
                description,
                priority: Some(priority),
                start_date,
                end_date,
            },
        )
    })
}

pub fn update(state: &AppState, input: UpdateTodoInput) -> Result<Todo, AppError> {
    if let Some(title) = &input.title {
        if title.trim().is_empty() {
            return Err(AppError::Validation("todo title must not be empty".to_string()));
        }
    }
    if let Some(priority) = input.priority {
        validate_priority(priority)?;
    }
    if let Some(status) = &input.status {
        validate_status(status)?;
    }
    validate_dates(&input.start_date, &input.end_date)?;
    state.db.with(|conn| {
        if let Some(group_id) = &input.group_id {
            if group_repo::get(conn, group_id)?.is_none() {
                return Err(AppError::NotFound(format!("group {group_id} not found")));
            }
        }
        repo::update(conn, &input)
    })
}

pub fn set_status(state: &AppState, id: String, status: String) -> Result<Todo, AppError> {
    validate_status(&status)?;
    state.db.with(|conn| repo::set_status(conn, &id, &status))
}

/// Deletes a todo together with its nodes and pin-window membership.
///
/// Idempotent by design: deleting an already-deleted todo succeeds silently
/// (double clicks / retries must not surface "todo not found").
/// Returns the pin windows that became empty and should be closed by the shell.
pub fn delete(state: &AppState, id: String) -> Result<Vec<String>, AppError> {
    state.db.with(|conn| {
        if repo::get(conn, &id)?.is_none() {
            return Ok(Vec::new());
        }
        let closed = pin_repo::detach_todo(conn, &id)?;
        repo::delete(conn, &id)?;
        Ok(closed)
    })
}

pub fn reorder(state: &AppState, ids: Vec<String>) -> Result<(), AppError> {
    state.db.with(|conn| repo::reorder(conn, &ids))
}
