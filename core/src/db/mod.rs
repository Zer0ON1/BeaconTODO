use crate::error::AppError;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn open_at(path: &std::path::Path) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;
        Self::from_connection(conn)
    }

    /// In-memory database for tests.
    pub fn in_memory() -> Result<Self, AppError> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    fn from_connection(conn: Connection) -> Result<Self, AppError> {
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        )?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn with<T>(
        &self,
        f: impl FnOnce(&mut Connection) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut guard = self
            .conn
            .lock()
            .map_err(|_| AppError::Internal("db lock poisoned".to_string()))?;
        f(&mut guard)
    }

    pub fn migrate(&self) -> Result<(), AppError> {
        self.with(|conn| {
            let mut current = current_version(conn)?;
            if current < 1 {
                conn.execute_batch(include_str!("migrations/0001_init.sql"))?;
                conn.execute(
                    "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
                    [chrono::Utc::now().to_rfc3339()],
                )?;
                current = 1;
            }
            if current < 2 {
                conn.execute_batch(include_str!("migrations/0002_node_milestone_flag.sql"))?;
                conn.execute(
                    "INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?1)",
                    [chrono::Utc::now().to_rfc3339()],
                )?;
            }
            Ok(())
        })
    }
}

fn current_version(conn: &Connection) -> Result<i64, AppError> {
    let table_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
        [],
        |row| row.get(0),
    )?;
    if table_exists == 0 {
        return Ok(0);
    }
    let version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;
    Ok(version)
}
