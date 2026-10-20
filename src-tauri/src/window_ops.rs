//! Window opacity settings.
//!
//! Opacity is rendered by the frontend: large surfaces use
//! `rgb(var(--*-rgb) / var(--window-alpha))`, so only the background fades and
//! text stays fully opaque. The shell only persists the chosen value.

use beacon_core::error::AppError;
use beacon_core::state::AppState;
use tauri::{AppHandle, Manager};

pub const MAIN_OPACITY_KEY: &str = "main_opacity";
pub const PIN_OPACITY_KEY: &str = "pin_opacity";
/// Below this the window becomes unusable, so the slider never goes lower.
pub const MIN_OPACITY: f64 = 0.35;
pub const DEFAULT_OPACITY: f64 = 1.0;

pub fn clamp_alpha(alpha: f64) -> f64 {
    if alpha.is_nan() {
        DEFAULT_OPACITY
    } else {
        alpha.clamp(MIN_OPACITY, 1.0)
    }
}

fn key_for(label: &str) -> &'static str {
    if label == "main" {
        MAIN_OPACITY_KEY
    } else {
        PIN_OPACITY_KEY
    }
}

pub fn saved_opacity(app: &AppHandle, label: &str) -> f64 {
    let state = app.state::<AppState>();
    state
        .db
        .with(|conn| beacon_core::repositories::settings::get(conn, key_for(label)))
        .ok()
        .flatten()
        .and_then(|raw| raw.parse::<f64>().ok())
        .map(clamp_alpha)
        .unwrap_or(DEFAULT_OPACITY)
}

#[tauri::command]
pub fn set_window_opacity(app: AppHandle, label: String, alpha: f64) -> Result<f64, AppError> {
    let alpha = clamp_alpha(alpha);
    let state = app.state::<AppState>();
    state.db.with(|conn| {
        beacon_core::repositories::settings::set(conn, key_for(&label), &alpha.to_string())
    })?;
    Ok(alpha)
}

#[tauri::command]
pub fn get_window_opacity(app: AppHandle, label: String) -> Result<f64, AppError> {
    Ok(saved_opacity(&app, &label))
}
