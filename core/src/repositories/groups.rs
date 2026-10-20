use super::super::error::AppError;
use super::super::models::{now, CreateGroupInput, Group, UpdateGroupInput};
use rusqlite::{params, Connection};

const COLUMNS: &str = "id, name, color, icon, sort_order, archived, created_at, updated_at";

fn row_to_group(row: &rusqlite::Row<'_>) -> rusqlite::Result<Group> {
    Ok(Group {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        icon: row.get(3)?,
        sort_order: row.get(4)?,
        archived: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub fn list(conn: &Connection, include_archived: bool) -> Result<Vec<Group>, AppError> {
    let sql = if include_archived {
        format!("SELECT {COLUMNS} FROM groups ORDER BY sort_order, created_at")
    } else {
        format!("SELECT {COLUMNS} FROM groups WHERE archived = 0 ORDER BY sort_order, created_at")
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_group)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Group>, AppError> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM groups WHERE id = ?1"))?;
    let group = stmt.query_map([id], row_to_group)?.next().transpose()?;
    Ok(group)
}

pub fn insert(conn: &Connection, input: &CreateGroupInput) -> Result<Group, AppError> {
    let id = super::super::models::new_id();
    let timestamp = now();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1000 FROM groups",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO groups (id, name, color, icon, sort_order, archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)",
        params![
            id,
            input.name,
            input.color.clone().unwrap_or_else(|| "#378ADD".to_string()),
            input.icon.clone(),
            sort_order,
            timestamp
        ],
    )?;
    get(conn, &id)?.ok_or_else(|| AppError::Internal("group vanished after insert".to_string()))
}

pub fn update(conn: &Connection, input: &UpdateGroupInput) -> Result<Group, AppError> {
    let existing = get(conn, &input.id)?
        .ok_or_else(|| AppError::NotFound(format!("group {} not found", input.id)))?;
    conn.execute(
        "UPDATE groups SET name = ?1, color = ?2, icon = ?3, sort_order = ?4, archived = ?5, updated_at = ?6 WHERE id = ?7",
        params![
            input.name.clone().unwrap_or(existing.name),
            input.color.clone().unwrap_or(existing.color),
            input.icon.clone().or(existing.icon),
            input.sort_order.unwrap_or(existing.sort_order),
            i64::from(input.archived.unwrap_or(existing.archived)),
            now(),
            input.id
        ],
    )?;
    get(conn, &input.id)?.ok_or_else(|| AppError::Internal("group vanished after update".to_string()))
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM groups WHERE id = ?1", [id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("group {id} not found")));
    }
    Ok(())
}

pub fn reorder(conn: &mut Connection, ids: &[String]) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    for (idx, id) in ids.iter().enumerate() {
        let affected = tx.execute(
            "UPDATE groups SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![((idx as i64) + 1) * 1000, now(), id],
        )?;
        if affected == 0 {
            return Err(AppError::Validation(format!("group {id} not found")));
        }
    }
    tx.commit()?;
    Ok(())
}
