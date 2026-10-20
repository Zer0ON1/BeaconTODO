use beacon_core::state::AppState;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub app_version: String,
    pub db_ok: bool,
    pub schema_version: i64,
}

#[tauri::command]
pub fn health_check(state: tauri::State<'_, AppState>) -> Result<HealthStatus, beacon_core::error::AppError> {
    let app_version = env!("CARGO_PKG_VERSION").to_string();
    let db_ok = state
        .db
        .with(|conn| {
            conn.query_row("SELECT 1", [], |_| Ok(()))
                .map_err(beacon_core::error::AppError::from)
        })
        .is_ok();
    let schema_version = state
        .db
        .with(|conn| {
            conn.query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(beacon_core::error::AppError::from)
        })
        .unwrap_or(0);
    Ok(HealthStatus {
        app_version,
        db_ok,
        schema_version,
    })
}
