pub mod commands;
pub mod pin;
pub mod tray;
pub mod window_ops;

use beacon_core::error::AppError;
use beacon_core::state::AppState;
use tauri::{Emitter, Manager};

pub fn run() {    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Resolve the data dir (shell concern), then hand a plain path to
            // the domain core.
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| AppError::Io(format!("resolve app data dir failed: {e}")))?;
            std::fs::create_dir_all(&data_dir)?;
            let db = beacon_core::db::Database::open_at(&data_dir.join("beacon.db"))?;
            db.migrate()?;
            let state = AppState { db };
            app.manage(state);

            beacon_core::services::backup::backup_db_file(&data_dir.join("beacon.db"))?;

            let state = app.state::<AppState>();
            restore_pin_windows(app.handle(), &state);

            let tray = tray::build(app.handle())?;
            app.manage(tray::TrayState(tray));

            register_global_shortcut(app.handle())?;
            log::info!("BeaconTODO setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health::health_check,
            commands::groups::groups_list,
            commands::groups::groups_create,
            commands::groups::groups_update,
            commands::groups::groups_delete,
            commands::groups::groups_reorder,
            commands::todos::todos_list,
            commands::todos::todos_create,
            commands::todos::todos_update,
            commands::todos::todos_delete,
            commands::todos::todos_reorder,
            commands::todos::todos_set_status,
            commands::nodes::nodes_list,
            commands::nodes::nodes_list_all,
            commands::nodes::nodes_create,
            commands::nodes::nodes_update,
            commands::nodes::nodes_delete,
            commands::nodes::nodes_reorder,
            commands::nodes::nodes_set_is_milestone,
            commands::nodes::nodes_set_completed,
            commands::pin::pin_windows_list,
            commands::pin::pin_get,
            commands::pin::pin_open,
            commands::pin::pin_add_member,
            commands::pin::pin_remove_member,
            commands::pin::pin_reorder_members,
            commands::pin::pin_set_active,
            commands::pin::pin_save_position,
            commands::pin::pin_set_always_on_top,
            commands::pin::pin_close,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::export::export_json,
            commands::export::import_json,
            commands::export::write_text_file,
            commands::export::read_text_file,
            tray::refresh_tray,
            window_ops::set_window_opacity,
            window_ops::get_window_opacity,
            commands::notify::notify_changed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BeaconTODO");
}

/// Broadcast a data-change to every window.
///
/// Each WebView is its own JS context: a todo created inside a pin window would
/// otherwise stay invisible to the main window until it reloads (#7).
pub fn broadcast_changed(app: &tauri::AppHandle) {
    if let Err(e) = app.emit("data-changed", ()) {
        log::warn!("broadcast data-changed failed: {e}");
    }
}

fn restore_pin_windows(app: &tauri::AppHandle, state: &AppState) {
    match beacon_core::services::pin_windows::list(state) {
        Ok(windows) => {
            for window in &windows {
                if let Err(e) = pin::create(app, window) {
                    log::warn!("restore pin window {} failed: {e}", window.id);
                }
            }
        }
        Err(e) => log::warn!("load pin windows failed: {e}"),
    }
}

fn register_global_shortcut(app: &tauri::AppHandle) -> Result<(), AppError> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyP);
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.emit("pin-shortcut", ());
                }
            }
        })
        .map_err(|e| AppError::Window(format!("register shortcut failed: {e}")))?;
    Ok(())
}
