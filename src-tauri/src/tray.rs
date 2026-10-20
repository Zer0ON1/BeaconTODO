//! System tray: show window, recent tasks, close-all-pins, settings, quit.

use beacon_core::error::AppError;
use beacon_core::services::pin_windows as pin_service;
use beacon_core::state::AppState;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, Wry};

pub struct TrayState(pub TrayIcon);

const MENU_SHOW: &str = "tray-show";
const MENU_CLOSE_PINS: &str = "tray-close-pins";
const MENU_SETTINGS: &str = "tray-settings";
const MENU_QUIT: &str = "tray-quit";
const RECENT_PREFIX: &str = "tray-todo-";
const RECENT_LIMIT: usize = 5;

/// Map a Tauri/UI-layer error into the shared error type.
fn win_err<E: std::fmt::Display>(e: E) -> AppError {
    AppError::Window(e.to_string())
}

/// Read the persisted UI language (falls back to zh-CN).
fn current_lang(state: &AppState) -> String {
    state
        .db
        .with(|conn| beacon_core::repositories::settings::get(conn, "language"))
        .ok()
        .flatten()
        .unwrap_or_else(|| "zh-CN".to_string())
}

fn label(zh: &str, en: &str, lang: &str) -> String {
    if lang == "en-US" {
        en.to_string()
    } else {
        zh.to_string()
    }
}

fn truncate(title: &str) -> String {
    if title.chars().count() > 24 {
        format!("{}…", title.chars().take(23).collect::<String>())
    } else {
        title.to_string()
    }
}

fn build_menu(app: &tauri::AppHandle) -> Result<Menu<Wry>, AppError> {
    let state = app.state::<AppState>();
    let lang = current_lang(&state);
    let todos = beacon_core::services::todos::list(&state, None)?;
    let pins = pin_service::list(&state)?;

    let recent: Vec<_> = todos
        .into_iter()
        .filter(|t| t.status != "completed" && t.status != "archived")
        .take(RECENT_LIMIT)
        .collect();

    let show_item = MenuItem::with_id(
        app,
        MENU_SHOW,
        label("显示主窗口", "Show window", &lang),
        true,
        None::<&str>,
    )
    .map_err(win_err)?;

    // Recent tasks submenu — one entry per todo, disabled placeholder when empty.
    let recent_items: Vec<MenuItem<Wry>> = if recent.is_empty() {
        vec![MenuItem::with_id(
            app,
            "tray-recent-empty",
            label("暂无待办", "No todos", &lang),
            false,
            None::<&str>,
        )
        .map_err(win_err)?]
    } else {
        recent
            .iter()
            .map(|todo| {
                MenuItem::with_id(
                    app,
                    format!("{RECENT_PREFIX}{}", todo.id),
                    truncate(&todo.title),
                    true,
                    None::<&str>,
                )
            })
            .collect::<Result<Vec<_>, _>>()
            .map_err(win_err)?
    };
    let recent_refs: Vec<&dyn tauri::menu::IsMenuItem<Wry>> =
        recent_items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<Wry>).collect();
    let recent_submenu = Submenu::with_items(
        app,
        label("最近任务", "Recent tasks", &lang),
        true,
        &recent_refs,
    )
    .map_err(win_err)?;

    let close_pins = MenuItem::with_id(
        app,
        MENU_CLOSE_PINS,
        format!(
            "{} ({})",
            label("关闭所有置顶", "Close all pins", &lang),
            pins.len()
        ),
        !pins.is_empty(),
        None::<&str>,
    )
    .map_err(win_err)?;

    let separator = PredefinedMenuItem::separator(app).map_err(win_err)?;
    let settings_item = MenuItem::with_id(
        app,
        MENU_SETTINGS,
        label("设置", "Settings", &lang),
        true,
        None::<&str>,
    )
    .map_err(win_err)?;
    let quit_item = MenuItem::with_id(
        app,
        MENU_QUIT,
        label("退出", "Quit", &lang),
        true,
        None::<&str>,
    )
    .map_err(win_err)?;

    let items: Vec<&dyn tauri::menu::IsMenuItem<Wry>> = vec![
        &show_item,
        &recent_submenu,
        &close_pins,
        &separator,
        &settings_item,
        &quit_item,
    ];
    Menu::with_items(app, &items).map_err(win_err)
}

pub fn build(app: &tauri::AppHandle) -> Result<TrayIcon, AppError> {
    let menu = build_menu(app)?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| AppError::Window("default window icon missing".to_string()))?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("BeaconTODO")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event: MenuEvent| {
            dispatch_menu(app, event);
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)
        .map_err(win_err)
}

fn dispatch_menu(app: &tauri::AppHandle, event: MenuEvent) {
    let id = event.id().0.as_str();
    if id == MENU_SHOW {
        show_main(app);
    } else if id == MENU_SETTINGS {
        show_main(app);
        let _ = app.emit("open-settings", ());
    } else if id == MENU_CLOSE_PINS {
        close_all_pins(app);
    } else if id == MENU_QUIT {
        app.exit(0);
    } else if let Some(todo_id) = id.strip_prefix(RECENT_PREFIX) {
        show_main(app);
        let _ = app.emit("open-todo", todo_id.to_string());
    }
}

pub fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn close_all_pins(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let windows = match pin_service::list(&state) {
        Ok(windows) => windows,
        Err(e) => {
            log::warn!("close all pins: list failed: {e}");
            return;
        }
    };
    for window in &windows {
        let _ = crate::pin::close(app, &window.id);
        if let Err(e) = pin_service::delete(&state, window.id.clone()) {
            log::warn!("close all pins: delete {} failed: {e}", window.id);
        }
    }
    log::info!("closed {} pin windows", windows.len());
}

/// Rebuild the tray menu (recent tasks + pin count) after data changes.
#[tauri::command]
pub fn refresh_tray(app: tauri::AppHandle) -> Result<(), AppError> {
    if let Some(tray) = app.try_state::<TrayState>() {
        tray.0.set_menu(Some(build_menu(&app)?)).map_err(win_err)?;
    }
    Ok(())
}
