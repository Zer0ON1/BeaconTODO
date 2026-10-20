use crate::error::AppError;
use crate::models::{CreateNodeInput, Node, UpdateNodeInput};
use crate::repositories::{nodes as repo, todos as todo_repo};
use crate::state::AppState;

const VALID_STATUSES: [&str; 3] = ["notStarted", "inProgress", "completed"];

fn validate_status(status: &str) -> Result<(), AppError> {
    if !VALID_STATUSES.contains(&status) {
        return Err(AppError::Validation(format!("unknown node status: {status}")));
    }
    Ok(())
}

pub fn list(state: &AppState, todo_id: String) -> Result<Vec<Node>, AppError> {
    state.db.with(|conn| {
        if todo_repo::get(conn, &todo_id)?.is_none() {
            return Err(AppError::NotFound(format!("todo {todo_id} not found")));
        }
        repo::list_by_todo(conn, &todo_id)
    })
}

pub fn create(
    state: &AppState,
    todo_id: String,
    title: String,
    note: Option<String>,
    is_milestone: Option<bool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Node, AppError> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::Validation("node title must not be empty".to_string()));
    }
    super::todos::validate_dates(&start_date, &end_date)?;
    state.db.with(|conn| {
        if todo_repo::get(conn, &todo_id)?.is_none() {
            return Err(AppError::NotFound(format!("todo {todo_id} not found")));
        }
        repo::insert(
            conn,
            &CreateNodeInput {
                todo_id,
                title,
                note,
                is_milestone,
                start_date,
                end_date,
            },
        )
    })
}

/// Partial edit. Deliberately has no sort_order path — see FP3.3 in the PRD:
/// ordering changes only through `reorder`.
pub fn update(state: &AppState, input: UpdateNodeInput) -> Result<Node, AppError> {
    if let Some(title) = &input.title {
        if title.trim().is_empty() {
            return Err(AppError::Validation("node title must not be empty".to_string()));
        }
    }
    if let Some(status) = &input.status {
        validate_status(status)?;
    }
    super::todos::validate_dates(&input.start_date, &input.end_date)?;
    state.db.with(|conn| repo::update(conn, &input))
}

pub fn delete(state: &AppState, id: String) -> Result<(), AppError> {
    state.db.with(|conn| repo::delete(conn, &id))
}

pub fn reorder(
    state: &AppState,
    todo_id: String,
    ids: Vec<String>,
) -> Result<(), AppError> {
    state.db.with(|conn| repo::reorder(conn, &todo_id, &ids))
}

pub fn set_is_milestone(state: &AppState, id: String, is_milestone: bool) -> Result<Node, AppError> {
    state.db.with(|conn| repo::set_is_milestone(conn, &id, is_milestone))
}

pub fn set_completed(state: &AppState, id: String, completed: bool) -> Result<Node, AppError> {
    state.db.with(|conn| {
        let node = repo::set_completed(conn, &id, completed)?;
        if completed {
            maybe_auto_complete_todo(conn, &node.todo_id)?;
        } else {
            if let Some(todo) = todo_repo::get(conn, &node.todo_id)? {
                if todo.status == "completed" {
                    todo_repo::set_status(conn, &node.todo_id, "inProgress")?;
                }
            }
        }
        Ok(node)
    })
}

fn maybe_auto_complete_todo(
    conn: &rusqlite::Connection,
    todo_id: &str,
) -> Result<(), AppError> {
    let enabled = crate::repositories::settings::get_json::<bool>(conn, "autoCompleteTodo")?
        .unwrap_or(true);
    if !enabled {
        return Ok(());
    }
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nodes WHERE todo_id = ?1",
        [todo_id],
        |row| row.get(0),
    )?;
    if total == 0 {
        return Ok(());
    }
    let done: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nodes WHERE todo_id = ?1 AND status = 'completed'",
        [todo_id],
        |row| row.get(0),
    )?;
    if done == total {
        if let Some(todo) = todo_repo::get(conn, todo_id)? {
            if todo.status != "completed" {
                todo_repo::set_status(conn, todo_id, "completed")?;
            }
        }
    }
    Ok(())
}

/// All nodes across todos — the list view needs progress for every card
/// without one IPC round-trip per todo.
pub fn list_all(state: &AppState) -> Result<Vec<Node>, AppError> {
    state.db.with(|conn| repo::list_all(conn))
}
