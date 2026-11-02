/**
 * On-device SQLite database (expo-sqlite). Holds finished study sessions and mock exams.
 * Nothing here ever leaves the device.
 */

import * as SQLite from 'expo-sqlite';

import { isDemo } from './kv-store';
import { MIGRATIONS } from './migrations';

/** The student's own database file. Demo mode never opens, changes or deletes it. */
export const REAL_DB_FILE = 'etut.db';
/** Database file of demo mode (example data, deleted when demo mode ends). */
export const DEMO_DB_FILE = 'etut-demo.db';

/** File `getDb` opens; `null` = not chosen yet (the demo flag decides on first open). */
let fileName: string | null = null;
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

/** Name of the database file in use (the demo flag decides until a file is chosen). */
export function databaseFile(): string {
  if (fileName === null) fileName = isDemo() ? DEMO_DB_FILE : REAL_DB_FILE;
  return fileName;
}

/** Switches to another database file; the current one is closed, the new one opens on next use. */
export function selectDatabaseFile(name: string): void {
  if (fileName === name) return;
  closeDb();
  fileName = name;
}

/** Closes the open database file (it reopens on the next `getDb`). */
export function closeDb(): void {
  if (db === null) return;
  const open = db;
  db = null;
  open.closeSync();
}

/** Deletes a database file (closed first if it is the one in use). A missing file is fine. */
export function deleteDatabaseFile(name: string): void {
  if (fileName === name) closeDb();
  try {
    SQLite.deleteDatabaseSync(name);
  } catch {
    // Not there (never opened): nothing to delete.
  }
}

export function getDb(): SQLite.SQLiteDatabase {
  if (db === null) {
    const opened = SQLite.openDatabaseSync(databaseFile());
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
    database.execSync(
      'DELETE FROM mock_exam_marks; DELETE FROM mock_exam_scores; DELETE FROM mock_exams; ' +
        'DELETE FROM sessions; DELETE FROM topic_progress; DELETE FROM sync_outbox;',
    );
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
