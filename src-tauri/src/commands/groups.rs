use beacon_core::models::{DeleteGroupInput, Group, ReorderInput, UpdateGroupInput};
use beacon_core::state::AppState;

#[tauri::command]
pub fn groups_list(
    state: tauri::State<'_, AppState>,
    include_archived: Option<bool>,
) -> Result<Vec<Group>, beacon_core::error::AppError> {
    beacon_core::services::groups::list(&state, include_archived.unwrap_or(false))
}

#[tauri::command]
pub fn groups_create(
    state: tauri::State<'_, AppState>,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Group, beacon_core::error::AppError> {
    beacon_core::services::groups::create(&state, name, color, icon)
}

#[tauri::command]
pub fn groups_update(
    state: tauri::State<'_, AppState>,
    input: UpdateGroupInput,
) -> Result<Group, beacon_core::error::AppError> {
    beacon_core::services::groups::update(&state, input)
}

#[tauri::command]
pub fn groups_delete(
    state: tauri::State<'_, AppState>,
    input: DeleteGroupInput,
) -> Result<(), beacon_core::error::AppError> {
    beacon_core::services::groups::delete(&state, input)
}

#[tauri::command]
pub fn groups_reorder(
    state: tauri::State<'_, AppState>,
    input: ReorderInput,
) -> Result<(), beacon_core::error::AppError> {
    beacon_core::services::groups::reorder(&state, input.ids)
}
