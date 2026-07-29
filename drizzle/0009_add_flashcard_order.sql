CREATE TABLE IF NOT EXISTS flashcard_order (
  lesson_id TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, card_id)
);
