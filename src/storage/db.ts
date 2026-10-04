/**
 * On-device SQLite database (expo-sqlite). Holds finished study sessions and mock exams.
 * Nothing here ever leaves the device.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'etut.db';

/** Each entry upgrades the schema by one version (PRAGMA user_version). Append only. */
const MIGRATIONS: string[] = [
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
];

let db: SQLite.SQLiteDatabase | null = null;

function migrate(database: SQLite.SQLiteDatabase): void {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    database.withTransactionSync(() => {
      database.execSync(sql);
      database.execSync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

export function getDb(): SQLite.SQLiteDatabase {
  if (db === null) {
    const opened = SQLite.openDatabaseSync(DB_NAME);
    opened.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    migrate(opened);
    db = opened;
  }
  return db;
}

/** Deletes every row and compacts the file so deleted data does not linger on disk. */
export function wipeDatabase(): void {
  const database = getDb();
  database.withTransactionSync(() => {
    database.execSync('DELETE FROM mock_exam_scores; DELETE FROM mock_exams; DELETE FROM sessions;');
  });
  // Compaction is best effort: the rows are already deleted at this point.
  try {
    database.execSync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
  } catch {
    // Ignore: free pages are then reused later instead of being removed now.
  }
}

/** Short random id for local rows (no crypto module needed; uniqueness is per device). */
export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${Date.now().toString(36)}-${rand}`;
}
