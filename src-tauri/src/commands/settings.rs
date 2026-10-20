use beacon_core::state::AppState;

#[tauri::command]
pub fn settings_get(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<Option<String>, beacon_core::error::AppError> {
    state
        .db
        .with(|conn| beacon_core::repositories::settings::get(conn, &key))
}

#[tauri::command]
pub fn settings_set(
    state: tauri::State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), beacon_core::error::AppError> {
    state
        .db
        .with(|conn| beacon_core::repositories::settings::set(conn, &key, &value))
}
