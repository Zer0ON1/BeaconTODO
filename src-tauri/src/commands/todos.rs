use beacon_core::models::{ReorderInput, Todo, UpdateTodoInput};
use beacon_core::state::AppState;

#[tauri::command]
pub fn todos_list(
    state: tauri::State<'_, AppState>,
    group_id: Option<String>,
) -> Result<Vec<Todo>, beacon_core::error::AppError> {
    beacon_core::services::todos::list(&state, group_id)
}

#[tauri::command]
pub fn todos_create(
    state: tauri::State<'_, AppState>,
    group_id: String,
    title: String,
    description: Option<String>,
    priority: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Todo, beacon_core::error::AppError> {
    beacon_core::services::todos::create(&state, group_id, title, description, priority, start_date, end_date)
}

#[tauri::command]
pub fn todos_update(
    state: tauri::State<'_, AppState>,
    input: UpdateTodoInput,
) -> Result<Todo, beacon_core::error::AppError> {
    beacon_core::services::todos::update(&state, input)
}

#[tauri::command]
pub fn todos_set_status(
    state: tauri::State<'_, AppState>,
    id: String,
    status: String,
) -> Result<Todo, beacon_core::error::AppError> {
    beacon_core::services::todos::set_status(&state, id, status)
}

/// Delete a todo. Idempotent — deleting an already-removed todo returns Ok.
/// Returns the pin windows that lost their last member so their webviews can
/// be closed here.
#[tauri::command]
pub fn todos_delete(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Vec<String>, beacon_core::error::AppError> {
    let closed = beacon_core::services::todos::delete(&state, id)?;
    for window_id in &closed {
        if let Err(e) = crate::pin::close(&app, window_id) {
            log::warn!("close emptied pin window {window_id} failed: {e}");
        }
    }
    Ok(closed)
}

#[tauri::command]
pub fn todos_reorder(
    state: tauri::State<'_, AppState>,
    input: ReorderInput,
) -> Result<(), beacon_core::error::AppError> {
    beacon_core::services::todos::reorder(&state, input.ids)
}
