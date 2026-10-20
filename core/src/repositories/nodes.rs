use super::super::error::AppError;
use super::super::models::{now, CreateNodeInput, Node, UpdateNodeInput};
use rusqlite::{params, Connection};

const COLUMNS: &str = "id, todo_id, title, note, is_milestone, start_date, end_date, status, sort_order, completed_at, created_at, updated_at";

fn row_to_node(row: &rusqlite::Row<'_>) -> rusqlite::Result<Node> {
    Ok(Node {
        id: row.get(0)?,
        todo_id: row.get(1)?,
        title: row.get(2)?,
        note: row.get(3)?,
        is_milestone: row.get::<_, i64>(4)? != 0,
        start_date: row.get(5)?,
        end_date: row.get(6)?,
        status: row.get(7)?,
        sort_order: row.get(8)?,
        completed_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn list_by_todo(conn: &Connection, todo_id: &str) -> Result<Vec<Node>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM nodes WHERE todo_id = ?1 ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([todo_id], row_to_node)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn list_all(conn: &Connection) -> Result<Vec<Node>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM nodes ORDER BY todo_id, sort_order"
    ))?;
    let rows = stmt.query_map([], row_to_node)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Node>, AppError> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM nodes WHERE id = ?1"))?;
    let node = stmt.query_map([id], row_to_node)?.next().transpose()?;
    Ok(node)
}

pub fn insert(conn: &Connection, input: &CreateNodeInput) -> Result<Node, AppError> {
    let id = super::super::models::new_id();
    let timestamp = now();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1000 FROM nodes WHERE todo_id = ?1",
        [input.todo_id.as_str()],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO nodes (id, todo_id, title, note, is_milestone, start_date, end_date, status, sort_order, completed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'notStarted', ?8, NULL, ?9, ?9)",
        params![
            id,
            input.todo_id,
            input.title,
            input.note.clone().unwrap_or_default(),
            i64::from(input.is_milestone.unwrap_or(false)),
            input.start_date.clone(),
            input.end_date.clone(),
            sort_order,
            timestamp
        ],
    )?;
    get(conn, &id)?.ok_or_else(|| AppError::Internal("node vanished after insert".to_string()))
}

/// Partial update. Never touches sort_order — reordering goes exclusively
/// through `reorder` so a plain edit can never disturb manual order.
pub fn update(conn: &Connection, input: &UpdateNodeInput) -> Result<Node, AppError> {
    let existing = get(conn, &input.id)?
        .ok_or_else(|| AppError::NotFound(format!("node {} not found", input.id)))?;
    let status = input.status.clone().unwrap_or(existing.status.clone());
    let completed_at = if status == "completed" && existing.completed_at.is_none() {
        Some(now())
    } else if status != "completed" {
        None
    } else {
        existing.completed_at.clone()
    };
    conn.execute(
        "UPDATE nodes SET title = ?1, note = ?2, is_milestone = ?3, start_date = ?4, end_date = ?5,
         status = ?6, completed_at = ?7, updated_at = ?8 WHERE id = ?9",
        params![
            input.title.clone().unwrap_or(existing.title),
            input.note.clone().unwrap_or(existing.note),
            i64::from(input.is_milestone.unwrap_or(existing.is_milestone)),
            input.start_date.clone().or(existing.start_date),
            input.end_date.clone().or(existing.end_date),
            status,
            completed_at,
            now(),
            input.id
        ],
    )?;
    get(conn, &input.id)?.ok_or_else(|| AppError::Internal("node vanished after update".to_string()))
}

pub fn set_completed(conn: &Connection, id: &str, completed: bool) -> Result<Node, AppError> {
    let status = if completed { "completed" } else { "notStarted" };
    let completed_at = if completed { Some(now()) } else { None };
    let affected = conn.execute(
        "UPDATE nodes SET status = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
        params![status, completed_at, now(), id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("node {id} not found")));
    }
    get(conn, id)?.ok_or_else(|| AppError::Internal("node vanished after completion".to_string()))
}

pub fn set_is_milestone(conn: &Connection, id: &str, is_milestone: bool) -> Result<Node, AppError> {
    let affected = conn.execute(
        "UPDATE nodes SET is_milestone = ?1, updated_at = ?2 WHERE id = ?3",
        params![i64::from(is_milestone), now(), id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("node {id} not found")));
    }
    get(conn, id)?.ok_or_else(|| AppError::Internal("node vanished after milestone change".to_string()))
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM nodes WHERE id = ?1", [id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("node {id} not found")));
    }
    Ok(())
}

/// Drag-to-reorder: the ONLY write that changes sort_order, and it changes
/// nothing else. Whole list is renumbered inside one transaction (bounded by
/// the todo's node count) to keep manual order authoritative and gap-free.
pub fn reorder(conn: &mut Connection, todo_id: &str, ordered_ids: &[String]) -> Result<(), AppError> {
    let existing = list_by_todo(conn, todo_id)?;
    let existing_ids: Vec<&str> = existing.iter().map(|n| n.id.as_str()).collect();
    if ordered_ids.len() != existing_ids.len()
        || !ordered_ids.iter().all(|id| existing_ids.contains(&id.as_str()))
    {
        return Err(AppError::Validation(
            "reorder payload does not match todo nodes".to_string(),
        ));
    }
    let tx = conn.transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE nodes SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![((idx as i64) + 1) * 1000, now(), id],
        )?;
    }
    tx.commit()?;
    Ok(())
}
