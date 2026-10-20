use crate::error::AppError;
use std::path::Path;

pub const BACKUP_KEEP: usize = 5;

/// Checkpoint WAL and copy the db file into `<db_dir>/backups/`, then rotate.
pub fn backup_db_file(db_path: &Path) -> Result<(), AppError> {
    if !db_path.exists() {
        return Ok(());
    }
    let dir = db_path
        .parent()
        .ok_or_else(|| AppError::Io("db path has no parent".to_string()))?;
    {
        let conn = rusqlite::Connection::open(db_path)?;
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    }
    let backups = dir.join("backups");
    std::fs::create_dir_all(&backups)?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let target = backups.join(format!("beacon-{stamp}.db"));
    std::fs::copy(db_path, &target)?;
    rotate(&backups, BACKUP_KEEP)?;
    log::info!("backup created: {}", target.display());
    Ok(())
}

/// Keep only the `keep` most recent .db files in `dir`, delete the rest.
pub fn rotate(dir: &Path, keep: usize) -> Result<(), AppError> {
    let mut entries: Vec<std::fs::DirEntry> = std::fs::read_dir(dir)?
        .filter_map(std::result::Result::ok)
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("db"))
                .unwrap_or(false)
        })
        .collect();
    entries.sort_by(|a, b| {
        let ta = a.metadata().and_then(|m| m.modified()).ok();
        let tb = b.metadata().and_then(|m| m.modified()).ok();
        tb.cmp(&ta)
    });
    for entry in entries.into_iter().skip(keep) {
        let _ = std::fs::remove_file(entry.path());
    }
    Ok(())
}
