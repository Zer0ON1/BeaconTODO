-- v0.2 schema changes (2026-10-19):
-- 1. Rename the default group seed for existing databases.
UPDATE groups SET name = '默认分组', updated_at = datetime('now') WHERE id = 'inbox';

-- 2. Milestones become a per-node flag instead of a separate table.
--    The legacy milestones table is kept (harmless) but no longer read or written;
--    nodes.milestone_id is likewise retired and always NULL from now on.
ALTER TABLE nodes ADD COLUMN is_milestone INTEGER NOT NULL DEFAULT 0;
