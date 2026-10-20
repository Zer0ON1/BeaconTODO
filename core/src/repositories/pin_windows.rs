use super::super::error::AppError;
use super::super::models::{now, PinWindow};
use rusqlite::{params, Connection};

const COLUMNS: &str = "id, members, active_todo_id, x, y, width, height, always_on_top, created_at, updated_at";

fn row_to_pin_window(row: &rusqlite::Row<'_>) -> rusqlite::Result<PinWindow> {
    let members_json: String = row.get(1)?;
    let members: Vec<String> = serde_json::from_str(&members_json).unwrap_or_default();
    Ok(PinWindow {
        id: row.get(0)?,
        members,
        active_todo_id: row.get(2)?,
        x: row.get(3)?,
        y: row.get(4)?,
        width: row.get(5)?,
        height: row.get(6)?,
        always_on_top: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<PinWindow>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM pin_windows ORDER BY created_at"
    ))?;
    let rows = stmt.query_map([], row_to_pin_window)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<PinWindow>, AppError> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM pin_windows WHERE id = ?1"))?;
    let window = stmt.query_map([id], row_to_pin_window)?.next().transpose()?;
    Ok(window)
}

pub fn insert(conn: &Connection, members: &[String]) -> Result<PinWindow, AppError> {
    let id = super::super::models::new_id();
    let timestamp = now();
    let members_json = serde_json::to_string(members)?;
    let active = members.first().cloned();
    conn.execute(
        "INSERT INTO pin_windows (id, members, active_todo_id, x, y, width, height, always_on_top, created_at, updated_at)
         VALUES (?1, ?2, ?3, 120, 120, 320, 420, 1, ?4, ?4)",
        params![id, members_json, active, timestamp],
    )?;
    get(conn, &id)?.ok_or_else(|| AppError::Internal("pin window vanished after insert".to_string()))
}

pub fn update_members(conn: &Connection, id: &str, members: &[String]) -> Result<PinWindow, AppError> {
    let existing = get(conn, id)?
        .ok_or_else(|| AppError::NotFound(format!("pin window {id} not found")))?;
    let members_json = serde_json::to_string(members)?;
    let active = if members.contains(&existing.active_todo_id.clone().unwrap_or_default()) {
        existing.active_todo_id.clone()
    } else {
        members.first().cloned()
    };
    conn.execute(
        "UPDATE pin_windows SET members = ?1, active_todo_id = ?2, updated_at = ?3 WHERE id = ?4",
        params![members_json, active, now(), id],
    )?;
    get(conn, id)?.ok_or_else(|| AppError::Internal("pin window vanished after update".to_string()))
}

pub fn set_active(conn: &Connection, id: &str, todo_id: &str) -> Result<PinWindow, AppError> {
    let affected = conn.execute(
        "UPDATE pin_windows SET active_todo_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![todo_id, now(), id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("pin window {id} not found")));
    }
    get(conn, id)?.ok_or_else(|| AppError::Internal("pin window vanished".to_string()))
}

pub fn save_position(
    conn: &Connection,
    id: &str,
    x: i64,
    y: i64,
    width: i64,
    height: i64,
) -> Result<PinWindow, AppError> {
    let affected = conn.execute(
        "UPDATE pin_windows SET x = ?1, y = ?2, width = ?3, height = ?4, updated_at = ?5 WHERE id = ?6",
        params![x, y, width, height, now(), id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("pin window {id} not found")));
    }
    get(conn, id)?.ok_or_else(|| AppError::Internal("pin window vanished".to_string()))
}

pub fn set_always_on_top(conn: &Connection, id: &str, value: bool) -> Result<PinWindow, AppError> {
    let affected = conn.execute(
        "UPDATE pin_windows SET always_on_top = ?1, updated_at = ?2 WHERE id = ?3",
        params![i64::from(value), now(), id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("pin window {id} not found")));
    }
    get(conn, id)?.ok_or_else(|| AppError::Internal("pin window vanished".to_string()))
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM pin_windows WHERE id = ?1", [id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("pin window {id} not found")));
    }
    Ok(())
}

/// Remove a todo from every pin window after it is deleted.
/// Windows that end up with no members are removed; their ids are returned so
/// the shell can close the corresponding webviews.
pub fn detach_todo(conn: &Connection, todo_id: &str) -> Result<Vec<String>, AppError> {
    let mut closed = Vec::new();
    for window in list(conn)? {
        if !window.members.iter().any(|m| m == todo_id) {
            continue;
        }
        let remaining: Vec<String> = window
            .members
            .iter()
            .filter(|m| *m != todo_id)
            .cloned()
            .collect();
        if remaining.is_empty() {
            delete(conn, &window.id)?;
            closed.push(window.id);
        } else {
            update_members(conn, &window.id, &remaining)?;
        }
    }
    Ok(closed)
}
