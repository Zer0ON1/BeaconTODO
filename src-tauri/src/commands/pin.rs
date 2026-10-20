use beacon_core::models::PinWindow;
use beacon_core::state::AppState;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn pin_windows_list(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<PinWindow>, beacon_core::error::AppError> {
    beacon_core::services::pin_windows::list(&state)
}

#[tauri::command]
pub fn pin_get(
    state: tauri::State<'_, AppState>,
    window_id: String,
) -> Result<PinWindow, beacon_core::error::AppError> {
    beacon_core::services::pin_windows::get(&state, window_id)
}

/// Create a pin window row + its webview window.
///
/// The webview MUST be built on the main thread: building it from an IPC
/// thread deadlocks the event loop (white, unresponsive window). So the DB row
/// is created here and the window is queued onto the main thread.
#[tauri::command]
pub async fn pin_open(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    todo_ids: Vec<String>,
) -> Result<PinWindow, beacon_core::error::AppError> {
    // Already pinned? Focus the existing window instead of creating a duplicate.
    if let Some(existing) = beacon_core::services::pin_windows::find_by_members(&state, &todo_ids)? {
        if let Some(window) = app.get_webview_window(&crate::pin::window_label(&existing.id)) {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        } else {
            let handle = app.clone();
            let payload = existing.clone();
            let _ = app.run_on_main_thread(move || {
                if let Err(e) = crate::pin::create(&handle, &payload) {
                    log::error!("pin window recreate failed: {e}");
                }
            });
        }
        return Ok(existing);
    }

    let window = beacon_core::services::pin_windows::create(&state, todo_ids)?;
    create_window_on_main_thread(&app, window.clone());
    Ok(window)
}

/// Create the webview on the main thread; if it fails, drop the DB row so we
/// never keep an orphan "pinned" record without a window.
fn create_window_on_main_thread(app: &AppHandle, window: PinWindow) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Err(e) = crate::pin::create(&handle, &window) {
            log::error!("pin window create failed: {e}");
            let state = handle.state::<AppState>();
            let _ = beacon_core::services::pin_windows::delete(&state, window.id.clone());
        }
    });
}

#[tauri::command]
pub async fn pin_add_member(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    todo_id: String,
) -> Result<PinWindow, beacon_core::error::AppError> {
    let window = beacon_core::services::pin_windows::add_member(&state, id, todo_id)?;
    if app.get_webview_window(&crate::pin::window_label(&window.id)).is_none() {
        create_window_on_main_thread(&app, window.clone());
    }
    Ok(window)
}

#[tauri::command]
pub fn pin_remove_member(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    todo_id: String,
) -> Result<PinWindow, beacon_core::error::AppError> {
    match beacon_core::services::pin_windows::remove_member(&state, id.clone(), todo_id)? {
        Some(window) => Ok(window),
        None => {
            // Last member removed: close the window and drop the row.
            crate::pin::close(&app, &id)?;
            beacon_core::services::pin_windows::delete(&state, id)?;
            Err(beacon_core::error::AppError::NotFound(
                "pin window closed: last member removed".to_string(),
            ))
        }
    }
}

#[tauri::command]
pub fn pin_reorder_members(
    state: tauri::State<'_, AppState>,
    id: String,
    ids: Vec<String>,
) -> Result<PinWindow, beacon_core::error::AppError> {
    beacon_core::services::pin_windows::reorder_members(&state, id, ids)
}

#[tauri::command]
pub fn pin_set_active(
    state: tauri::State<'_, AppState>,
    id: String,
    todo_id: String,
) -> Result<PinWindow, beacon_core::error::AppError> {
    beacon_core::services::pin_windows::set_active(&state, id, todo_id)
}

#[tauri::command]
pub fn pin_save_position(
    state: tauri::State<'_, AppState>,
    id: String,
    x: i64,
    y: i64,
    width: i64,
    height: i64,
) -> Result<PinWindow, beacon_core::error::AppError> {
    beacon_core::services::pin_windows::save_position(&state, id, x, y, width, height)
}

#[tauri::command]
pub fn pin_set_always_on_top(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    value: bool,
) -> Result<PinWindow, beacon_core::error::AppError> {
    let window = beacon_core::services::pin_windows::set_always_on_top(&state, id.clone(), value)?;
    crate::pin::set_always_on_top(&app, &id, value)?;
    Ok(window)
}

#[tauri::command]
pub fn pin_close(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), beacon_core::error::AppError> {
    crate::pin::close(&app, &id)?;
    beacon_core::services::pin_windows::delete(&state, id)
}
