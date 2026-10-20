CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#378ADD',
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 1000,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY NOT NULL,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 2,
    status TEXT NOT NULL DEFAULT 'notStarted',
    start_date TEXT,
    end_date TEXT,
    sort_order INTEGER NOT NULL DEFAULT 1000,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_group ON todos(group_id);

CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY NOT NULL,
    todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_date TEXT,
    color TEXT NOT NULL DEFAULT '#EF9F27',
    status TEXT NOT NULL DEFAULT 'pending',
    sort_order INTEGER NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_milestones_todo ON milestones(todo_id);

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY NOT NULL,
    todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'notStarted',
    sort_order INTEGER NOT NULL DEFAULT 1000,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_todo ON nodes(todo_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_nodes_milestone ON nodes(milestone_id);

CREATE TABLE IF NOT EXISTS pin_windows (
    id TEXT PRIMARY KEY NOT NULL,
    members TEXT NOT NULL DEFAULT '[]',
    active_todo_id TEXT,
    x INTEGER NOT NULL DEFAULT 120,
    y INTEGER NOT NULL DEFAULT 120,
    width INTEGER NOT NULL DEFAULT 320,
    height INTEGER NOT NULL DEFAULT 420,
    always_on_top INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO groups (id, name, color, icon, sort_order, archived, created_at, updated_at)
VALUES ('inbox', '默认分组', '#378ADD', NULL, 0, 0, datetime('now'), datetime('now'));
