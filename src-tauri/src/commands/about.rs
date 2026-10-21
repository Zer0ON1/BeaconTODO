use serde::Serialize;
use tauri::Manager;

/// Environment details shown on the About panel.
///
/// Everything here is derived from the running process, so the values always
/// match the build the user actually launched (no hard-coded version strings).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
    /// `true` when this is a dev build, so the UI can label it.
    pub debug: bool,
    pub data_dir: String,
    pub db_path: String,
    pub log_dir: String,
}

#[tauri::command]
pub fn app_info(app: tauri::AppHandle) -> Result<AppInfo, beacon_core::error::AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| beacon_core::error::AppError::Window(e.to_string()))?;
    let log_dir = app
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| data_dir.clone());

    Ok(AppInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        debug: cfg!(debug_assertions),
        data_dir: data_dir.display().to_string(),
        db_path: data_dir.join("beacon.db").display().to_string(),
        log_dir: log_dir.display().to_string(),
    })
}
