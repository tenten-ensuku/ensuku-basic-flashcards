CREATE TABLE IF NOT EXISTS lesson_titles (
  lesson_id TEXT PRIMARY KEY,
  lesson_date TEXT NOT NULL,
  teacher TEXT NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
