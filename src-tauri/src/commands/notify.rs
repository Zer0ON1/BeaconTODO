//! Cross-window data-change broadcast.

/// Called by the frontend after every write so other windows refresh.
#[tauri::command]
pub fn notify_changed(app: tauri::AppHandle) {
    crate::broadcast_changed(&app);
}
