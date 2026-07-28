export const FLASHCARD_OVERRIDES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS flashcard_overrides_v2 (
  lesson_id TEXT NOT NULL,
  card_id INTEGER NOT NULL CHECK (card_id BETWEEN 1 AND 50),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, card_id)
)
`;

export const FLASHCARD_OVERRIDES_LEGACY_COPY_SQL = `
INSERT OR IGNORE INTO flashcard_overrides_v2 (lesson_id, card_id, question, answer, updated_at)
SELECT lesson_id, card_id, question, answer, updated_at FROM flashcard_overrides
`;

export const FLASHCARD_ADDITIONS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS flashcard_additions (
  lesson_id TEXT NOT NULL,
  card_id INTEGER NOT NULL CHECK (card_id BETWEEN 51 AND 10000),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, card_id)
)
`;

export const LESSON_TITLES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lesson_titles (
  lesson_id TEXT PRIMARY KEY,
  lesson_date TEXT NOT NULL,
  teacher TEXT NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const QUIZ_OVERRIDES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS quiz_overrides (
  quiz_id TEXT NOT NULL CHECK (quiz_id = 'basic-order-2026-07-16'),
  question_id INTEGER NOT NULL CHECK (question_id BETWEEN 1 AND 30),
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quiz_id, question_id)
)
`;
