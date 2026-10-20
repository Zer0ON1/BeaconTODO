use crate::error::AppError;
use crate::models::ExportData;
use crate::repositories;
use crate::state::AppState;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub groups: usize,
    pub todos: usize,
    pub nodes: usize,
}

pub fn export(state: &AppState) -> Result<ExportData, AppError> {
    state.db.with(|conn| {
        Ok(ExportData {
            version: 1,
            exported_at: crate::models::now(),
            groups: repositories::groups::list(conn, true)?,
            todos: repositories::todos::list_everything(conn)?,
            nodes: repositories::nodes::list_all(conn)?,
        })
    })
}

pub fn import(state: &AppState, data: ExportData) -> Result<ImportSummary, AppError> {
    state.db.with(|conn| {
        let tx = conn.transaction()?;
        for group in &data.groups {
            tx.execute(
                "INSERT OR REPLACE INTO groups (id, name, color, icon, sort_order, archived, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    group.id,
                    group.name,
                    group.color,
                    group.icon,
                    group.sort_order,
                    i64::from(group.archived),
                    group.created_at,
                    group.updated_at
                ],
            )?;
        }
        for todo in &data.todos {
            tx.execute(
                "INSERT OR REPLACE INTO todos (id, group_id, title, description, priority, status, start_date, end_date, sort_order, completed_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    todo.id,
                    todo.group_id,
                    todo.title,
                    todo.description,
                    todo.priority,
                    todo.status,
                    todo.start_date,
                    todo.end_date,
                    todo.sort_order,
                    todo.completed_at,
                    todo.created_at,
                    todo.updated_at
                ],
            )?;
        }
        for node in &data.nodes {
            tx.execute(
                "INSERT OR REPLACE INTO nodes (id, todo_id, title, note, is_milestone, start_date, end_date, status, sort_order, completed_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    node.id,
                    node.todo_id,
                    node.title,
                    node.note,
                    i64::from(node.is_milestone),
                    node.start_date,
                    node.end_date,
                    node.status,
                    node.sort_order,
                    node.completed_at,
                    node.created_at,
                    node.updated_at
                ],
            )?;
        }
        tx.commit()?;
        Ok(ImportSummary {
            groups: data.groups.len(),
            todos: data.todos.len(),
            nodes: data.nodes.len(),
        })
    })
}
