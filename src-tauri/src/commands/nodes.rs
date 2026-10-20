use beacon_core::models::{Node, ReorderInput, UpdateNodeInput};
use beacon_core::state::AppState;

#[tauri::command]
pub fn nodes_list(
    state: tauri::State<'_, AppState>,
    todo_id: String,
) -> Result<Vec<Node>, beacon_core::error::AppError> {
    beacon_core::services::nodes::list(&state, todo_id)
}

#[tauri::command]
pub fn nodes_list_all(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Node>, beacon_core::error::AppError> {
    beacon_core::services::nodes::list_all(&state)
}

#[tauri::command]
pub fn nodes_create(
    state: tauri::State<'_, AppState>,
    todo_id: String,
    title: String,
    note: Option<String>,
    is_milestone: Option<bool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Node, beacon_core::error::AppError> {
    beacon_core::services::nodes::create(&state, todo_id, title, note, is_milestone, start_date, end_date)
}

#[tauri::command]
pub fn nodes_update(
    state: tauri::State<'_, AppState>,
    input: UpdateNodeInput,
) -> Result<Node, beacon_core::error::AppError> {
    beacon_core::services::nodes::update(&state, input)
}

#[tauri::command]
pub fn nodes_delete(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), beacon_core::error::AppError> {
    beacon_core::services::nodes::delete(&state, id)
}

#[tauri::command]
pub fn nodes_reorder(
    state: tauri::State<'_, AppState>,
    todo_id: String,
    input: ReorderInput,
) -> Result<(), beacon_core::error::AppError> {
    beacon_core::services::nodes::reorder(&state, todo_id, input.ids)
}

#[tauri::command]
pub fn nodes_set_is_milestone(
    state: tauri::State<'_, AppState>,
    id: String,
    is_milestone: bool,
) -> Result<Node, beacon_core::error::AppError> {
    beacon_core::services::nodes::set_is_milestone(&state, id, is_milestone)
}

#[tauri::command]
pub fn nodes_set_completed(
    state: tauri::State<'_, AppState>,
    id: String,
    completed: bool,
) -> Result<Node, beacon_core::error::AppError> {
    beacon_core::services::nodes::set_completed(&state, id, completed)
}
