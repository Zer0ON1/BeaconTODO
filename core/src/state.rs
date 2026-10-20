use crate::db::Database;

/// Application state handed to the shell. Constructed by the app shell once
/// the data directory has been resolved.
pub struct AppState {
    pub db: Database,
}
