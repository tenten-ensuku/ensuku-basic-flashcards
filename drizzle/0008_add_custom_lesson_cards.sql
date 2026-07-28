CREATE TABLE IF NOT EXISTS custom_lesson_cards (
  lesson_id TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, card_id)
);
