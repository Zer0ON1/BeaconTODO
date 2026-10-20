use beacon_core::error::AppError;
use beacon_core::models::PinWindow;
use tauri::{Manager, WebviewWindowBuilder};

pub fn window_label(id: &str) -> String {
    format!("pin-{}", &id[..8.min(id.len())])
}

pub fn create(app: &tauri::AppHandle, window: &PinWindow) -> Result<(), AppError> {
    let label = window_label(&window.id);
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }
    let builder = WebviewWindowBuilder::new(
        app,
        &label,
        tauri::WebviewUrl::App("pin.html".into()),
    )
    .title("BeaconTODO")
    .inner_size(window.width as f64, window.height as f64)
    .position(window.x as f64, window.y as f64)
    .always_on_top(window.always_on_top)
    .decorations(false)
    .transparent(true)
    // Windows 11 draws a heavy DWM shadow around decoration-less windows;
    // the pin window should look flat/light instead.
    .shadow(false)
    .skip_taskbar(true)
    .resizable(true)
    .focused(true);
    builder
        .build()
        .map_err(|e| AppError::Window(format!("create pin window failed: {e}")))?;
    log::info!("pin window {label} created");
    Ok(())
}

pub fn close(app: &tauri::AppHandle, id: &str) -> Result<(), AppError> {
    let label = window_label(id);
    if let Some(window) = app.get_webview_window(&label) {
        window
            .close()
            .map_err(|e| AppError::Window(format!("close pin window failed: {e}")))?;
    }
    Ok(())
}

pub fn set_always_on_top(
    app: &tauri::AppHandle,
    id: &str,
    value: bool,
) -> Result<(), AppError> {
    let label = window_label(id);
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_always_on_top(value)
            .map_err(|e| AppError::Window(format!("set always on top failed: {e}")))?;
    }
    Ok(())
}
