CREATE TABLE IF NOT EXISTS quiz_overrides (
  quiz_id TEXT NOT NULL CHECK (quiz_id = 'basic-order-2026-07-16'),
  question_id INTEGER NOT NULL CHECK (question_id BETWEEN 1 AND 30),
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quiz_id, question_id)
);
