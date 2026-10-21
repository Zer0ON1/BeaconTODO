-- v0.1.7: per-todo "pinned to top" flag.
-- This only affects list ordering; it is unrelated to pin windows.
ALTER TABLE todos ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
