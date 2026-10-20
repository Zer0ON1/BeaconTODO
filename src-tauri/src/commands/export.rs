use beacon_core::models::ExportData;
use beacon_core::state::AppState;

#[tauri::command]
pub fn export_json(
    state: tauri::State<'_, AppState>,
) -> Result<ExportData, beacon_core::error::AppError> {
    beacon_core::services::export::export(&state)
}

#[tauri::command]
pub fn import_json(
    state: tauri::State<'_, AppState>,
    data: ExportData,
) -> Result<beacon_core::services::export::ImportSummary, beacon_core::error::AppError> {
    beacon_core::services::export::import(&state, data)
}

/// Local-first app: the frontend picks the path via the dialog plugin, this
/// command performs the write. No network, user-chosen location only.
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), beacon_core::error::AppError> {
    std::fs::write(&path, contents)?;
    Ok(())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, beacon_core::error::AppError> {
    Ok(std::fs::read_to_string(&path)?)
}
