use super::super::error::AppError;
use super::super::models::{now, CreateTodoInput, Todo, UpdateTodoInput};
use rusqlite::{params, Connection};

const COLUMNS: &str = "id, group_id, title, description, priority, status, start_date, end_date, sort_order, completed_at, created_at, updated_at";

fn row_to_todo(row: &rusqlite::Row<'_>) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        group_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        priority: row.get(4)?,
        status: row.get(5)?,
        start_date: row.get(6)?,
        end_date: row.get(7)?,
        sort_order: row.get(8)?,
        completed_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn list_all(conn: &Connection) -> Result<Vec<Todo>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM todos WHERE status != 'archived' ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([], row_to_todo)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn list_everything(conn: &Connection) -> Result<Vec<Todo>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM todos ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([], row_to_todo)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn reassign_group(conn: &Connection, from_group: &str, to_group: &str) -> Result<usize, AppError> {
    let affected = conn.execute(
        "UPDATE todos SET group_id = ?1, updated_at = ?2 WHERE group_id = ?3",
        params![to_group, now(), from_group],
    )?;
    Ok(affected)
}

pub fn list_by_group(conn: &Connection, group_id: &str) -> Result<Vec<Todo>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM todos WHERE group_id = ?1 AND status != 'archived' ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([group_id], row_to_todo)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Todo>, AppError> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM todos WHERE id = ?1"))?;
    let todo = stmt.query_map([id], row_to_todo)?.next().transpose()?;
    Ok(todo)
}

pub fn insert(conn: &Connection, input: &CreateTodoInput) -> Result<Todo, AppError> {
    let id = super::super::models::new_id();
    let timestamp = now();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1000 FROM todos WHERE group_id = ?1",
        [input.group_id.as_str()],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO todos (id, group_id, title, description, priority, status, start_date, end_date, sort_order, completed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'notStarted', ?6, ?7, ?8, NULL, ?9, ?9)",
        params![
            id,
            input.group_id,
            input.title,
            input.description.clone().unwrap_or_default(),
            input.priority.unwrap_or(2),
            input.start_date.clone(),
            input.end_date.clone(),
            sort_order,
            timestamp
        ],
    )?;
    get(conn, &id)?.ok_or_else(|| AppError::Internal("todo vanished after insert".to_string()))
}

pub fn update(conn: &Connection, input: &UpdateTodoInput) -> Result<Todo, AppError> {
    let existing = get(conn, &input.id)?
        .ok_or_else(|| AppError::NotFound(format!("todo {} not found", input.id)))?;
    let status = input.status.clone().unwrap_or(existing.status.clone());
    let completed_at = if status == "completed" && existing.completed_at.is_none() {
        Some(now())
    } else if status != "completed" {
        None
    } else {
        existing.completed_at.clone()
    };
    conn.execute(
        "UPDATE todos SET group_id = ?1, title = ?2, description = ?3, priority = ?4, status = ?5,
         start_date = ?6, end_date = ?7, sort_order = ?8, completed_at = ?9, updated_at = ?10 WHERE id = ?11",
        params![
            input.group_id.clone().unwrap_or(existing.group_id),
            input.title.clone().unwrap_or(existing.title),
            input.description.clone().unwrap_or(existing.description),
            input.priority.unwrap_or(existing.priority),
            status,
            input.start_date.clone().or(existing.start_date),
            input.end_date.clone().or(existing.end_date),
            input.sort_order.unwrap_or(existing.sort_order),
            completed_at,
            now(),
            input.id
        ],
    )?;
    get(conn, &input.id)?.ok_or_else(|| AppError::Internal("todo vanished after update".to_string()))
}

pub fn set_status(conn: &Connection, id: &str, status: &str) -> Result<Todo, AppError> {
    let existing = get(conn, id)?
        .ok_or_else(|| AppError::NotFound(format!("todo {id} not found")))?;
    let completed_at = if status == "completed" {
        Some(existing.completed_at.clone().unwrap_or_else(now))
    } else {
        None
    };
    conn.execute(
        "UPDATE todos SET status = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
        params![status, completed_at, now(), id],
    )?;
    get(conn, id)?.ok_or_else(|| AppError::Internal("todo vanished after status change".to_string()))
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM todos WHERE id = ?1", [id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("todo {id} not found")));
    }
    Ok(())
}

pub fn reorder(conn: &mut Connection, ids: &[String]) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    for (idx, id) in ids.iter().enumerate() {
        let affected = tx.execute(
            "UPDATE todos SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![((idx as i64) + 1) * 1000, now(), id],
        )?;
        if affected == 0 {
            return Err(AppError::Validation(format!("todo {id} not found")));
        }
    }
    tx.commit()?;
    Ok(())
}
