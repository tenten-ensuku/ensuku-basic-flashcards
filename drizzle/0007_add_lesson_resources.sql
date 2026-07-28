CREATE TABLE IF NOT EXISTS lesson_resources (
  resource_id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'link')),
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS lesson_resources_lesson_order_idx
  ON lesson_resources (lesson_id, sort_order);
