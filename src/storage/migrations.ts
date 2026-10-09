/**
 * Schema migrations of the on-device database, one entry per PRAGMA user_version step.
 * Pure data (no imports) so that they can be run against an in-memory SQLite in tests.
 * Append only: never change an entry that has shipped.
 */

export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    subject_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    pauses TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_started_at ON sessions (started_at);
  CREATE INDEX IF NOT EXISTS sessions_ended_at ON sessions (ended_at);

  CREATE TABLE IF NOT EXISTS mock_exams (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    scope TEXT NOT NULL,
    brans_section_id TEXT,
    taken_on TEXT NOT NULL,
    total_net REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mock_exams_taken_on ON mock_exams (taken_on);

  CREATE TABLE IF NOT EXISTS mock_exam_scores (
    exam_id TEXT NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    questions INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    wrong INTEGER NOT NULL,
    net REAL NOT NULL,
    PRIMARY KEY (exam_id, section_id)
  );
  `,
  // 2: topic of a session and where it came from ('timer' or 'manual' = added afterwards).
  `
  ALTER TABLE sessions ADD COLUMN topic_id TEXT;
  ALTER TABLE sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'timer';
  CREATE INDEX IF NOT EXISTS sessions_topic_id ON sessions (topic_id);
  `,
  // 3: topic progress ("bitti" / "tekrar lazım").
  `
  CREATE TABLE IF NOT EXISTS topic_progress (
    topic_id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
  // 4: mock exam analysis: wrong/blank questions per topic, and when the analysis was finished.
  // Exams saved before this version count as analysed, so no reminder appears for them.
  `
  ALTER TABLE mock_exams ADD COLUMN analysis_done_at INTEGER;
  UPDATE mock_exams SET analysis_done_at = created_at;
  CREATE TABLE IF NOT EXISTS mock_exam_marks (
    exam_id TEXT NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    wrong INTEGER NOT NULL,
    blank INTEGER NOT NULL,
    PRIMARY KEY (exam_id, section_id, topic_id)
  );
  CREATE INDEX IF NOT EXISTS mock_exam_marks_topic_id ON mock_exam_marks (topic_id);
  `,
  // 5: outgoing queue of finished sessions for the (optional) group server. Used only when the
  // group module is on and the student has a group account; empty otherwise.
  `
  CREATE TABLE IF NOT EXISTS sync_outbox (
    local_id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL,
    last_error TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sync_outbox_next_attempt_at ON sync_outbox (next_attempt_at);
  `,
  // 6: optional solved question count of a session (domain/questions.ts); NULL = not given.
  `
  ALTER TABLE sessions ADD COLUMN questions INTEGER;
  `,
];
