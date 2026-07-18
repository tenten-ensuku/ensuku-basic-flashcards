CREATE TABLE IF NOT EXISTS flashcard_overrides_v2 (
  lesson_id TEXT NOT NULL,
  card_id INTEGER NOT NULL CHECK (card_id BETWEEN 1 AND 50),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, card_id)
);

INSERT OR IGNORE INTO flashcard_overrides_v2 (lesson_id, card_id, question, answer, updated_at)
SELECT lesson_id, card_id, question, answer, updated_at FROM flashcard_overrides;
