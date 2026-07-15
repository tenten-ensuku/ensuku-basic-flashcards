export const FLASHCARD_OVERRIDES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS flashcard_overrides (
  lesson_id TEXT NOT NULL CHECK (lesson_id IN ('tenten', 'nejimaki')),
  card_id INTEGER NOT NULL CHECK (card_id BETWEEN 1 AND 50),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, card_id)
)
`;
