/// <reference types="node" />
/**
 * @jest-environment node
 *
 * The real migration runner and wipe of `db.ts` (not a copy of them): `expo-sqlite` is replaced
 * by Node's built-in SQLite behind the expo-sqlite method names, so `getDb()` opens, migrates and
 * caches exactly as on the device. Each test loads `db.ts` afresh (`jest.isolateModules`) against
 * a database file prepared at some older `user_version`, with data in it.
 */

import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../migrations';

interface Opened {
  name: string;
  options: unknown;
  exec: string[];
  closed: boolean;
}

/** Database "files" by name (what openDatabaseSync opens) and every open/exec seen. */
const mockFiles = new Map<string, DatabaseSync>();
const mockOpened: Opened[] = [];
/** SQL that makes the adapter's execSync throw (to simulate a locked file). */
const mockFail: { exec: RegExp | null } = { exec: null };

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: Sqlite } = require('node:sqlite');
  const args = (p: unknown[]) => p.map((v) => (v === undefined ? null : v));
  return {
    openDatabaseSync: (name: string, options?: unknown) => {
      let db = mockFiles.get(name);
      if (db === undefined) {
        db = new Sqlite(':memory:') as DatabaseSync;
        mockFiles.set(name, db);
      }
      const file = db;
      const opened: Opened = { name, options, exec: [], closed: false };
      mockOpened.push(opened);
      return {
        getAllSync: (sql: string, ...p: unknown[]) => file.prepare(sql).all(...(args(p) as never[])),
        getFirstSync: (sql: string, ...p: unknown[]) => file.prepare(sql).get(...(args(p) as never[])) ?? null,
        runSync: (sql: string, ...p: unknown[]) => file.prepare(sql).run(...(args(p) as never[])),
        execSync: (sql: string) => {
          opened.exec.push(sql);
          if (mockFail.exec !== null && mockFail.exec.test(sql)) throw new Error('database is locked');
          file.exec(sql);
        },
        withTransactionSync: (fn: () => void) => {
          file.exec('BEGIN');
          try {
            fn();
            file.exec('COMMIT');
          } catch (error) {
            file.exec('ROLLBACK');
            throw error;
          }
        },
        closeSync: () => {
          opened.closed = true;
        },
      };
    },
  };
});

type DbModule = typeof import('../db');

/** A fresh copy of db.ts (its connection cache starts empty), optionally with other migrations. */
function loadDb(migrations?: readonly string[]): DbModule {
  let mod: DbModule | undefined;
  jest.isolateModules(() => {
    if (migrations !== undefined) jest.doMock('../migrations', () => ({ MIGRATIONS: migrations }));
    mod = require('../db') as DbModule;
  });
  jest.dontMock('../migrations');
  return mod!;
}

/** Writes the file `etut.db` as an older app version left it: steps 1…`version` applied. */
function prepare(version: number): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (let v = 0; v < version; v++) {
    db.exec('BEGIN');
    db.exec(MIGRATIONS[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec('COMMIT');
  }
  mockFiles.set('etut.db', db);
  return db;
}

const userVersion = (db: DatabaseSync) => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
const count = (db: DatabaseSync, table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

/** Data every schema since version 1 can hold. */
function insertV1Data(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO sessions (id, subject_id, started_at, ended_at, pauses, duration_ms, created_at)
      VALUES ('s1', 'fizik', 1000, 61000, '[]', 60000, 61000);
    INSERT INTO mock_exams (id, kind, scope, brans_section_id, taken_on, total_net, created_at)
      VALUES ('e1', 'TYT', 'genel', NULL, '2026-10-01', 28.5, 12345);
    INSERT INTO mock_exam_scores (exam_id, section_id, questions, correct, wrong, net)
      VALUES ('e1', 'matematik', 40, 30, 6, 28.5);
  `);
}

beforeEach(() => {
  mockFiles.clear();
  mockOpened.length = 0;
  mockFail.exec = null;
});

describe('getDb() runs the real migration runner', () => {
  it('a fresh install: every step, WAL and foreign keys, and the connection is opened once', () => {
    const { getDb } = loadDb();
    const db = getDb();
    expect(getDb()).toBe(db);
    expect(mockOpened.filter((o) => o.name === 'etut.db')).toHaveLength(1);
    expect(mockOpened[0].exec[0]).toBe('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const file = mockFiles.get('etut.db')!;
    expect(userVersion(file)).toBe(MIGRATIONS.length);
    expect((file.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys).toBe(1);
  });

  it('from v2 (topic and source on sessions) with data: nothing lost, old exams count as analysed', () => {
    const file = prepare(2);
    insertV1Data(file);
    file.exec(`
      INSERT INTO sessions (id, subject_id, topic_id, source, started_at, ended_at, pauses, duration_ms, created_at)
        VALUES ('m1', 'kimya', 'tyt.kimya.mol', 'manual', 100000, 160000, '[]', 60000, 160000);
    `);

    const { getDb } = loadDb();
    getDb();

    expect(userVersion(file)).toBe(MIGRATIONS.length);
    expect(file.prepare('SELECT id, topic_id, source FROM sessions ORDER BY id').all()).toEqual([
      { id: 'm1', topic_id: 'tyt.kimya.mol', source: 'manual' },
      { id: 's1', topic_id: null, source: 'timer' },
    ]);
    expect(file.prepare('SELECT analysis_done_at FROM mock_exams').get()).toEqual({ analysis_done_at: 12345 });
    expect(count(file, 'topic_progress')).toBe(0);
    expect(count(file, 'sync_outbox')).toBe(0);
  });

  it('from v3 (topic progress) with data: the marks survive, exams count as analysed', () => {
    const file = prepare(3);
    insertV1Data(file);
    file.exec(`INSERT INTO topic_progress (topic_id, status, updated_at) VALUES ('tyt.fizik.basinc', 'done', 7);`);

    loadDb().getDb();

    expect(userVersion(file)).toBe(MIGRATIONS.length);
    expect(file.prepare('SELECT topic_id, status, updated_at FROM topic_progress').all()).toEqual([
      { topic_id: 'tyt.fizik.basinc', status: 'done', updated_at: 7 },
    ]);
    expect(file.prepare('SELECT analysis_done_at FROM mock_exams').get()).toEqual({ analysis_done_at: 12345 });
    expect(count(file, 'mock_exam_marks')).toBe(0);
  });

  it('from v4 (analysis): a pending analysis stays pending (migration 4 is not run again)', () => {
    const file = prepare(4);
    insertV1Data(file);
    file.exec(`
      UPDATE mock_exams SET analysis_done_at = NULL WHERE id = 'e1';
      INSERT INTO mock_exam_marks (exam_id, section_id, topic_id, wrong, blank)
        VALUES ('e1', 'matematik', 'tyt.matematik.mutlak-deger', 3, 1);
    `);

    loadDb().getDb();

    expect(userVersion(file)).toBe(MIGRATIONS.length);
    expect(file.prepare('SELECT analysis_done_at FROM mock_exams').get()).toEqual({ analysis_done_at: null });
    expect(count(file, 'mock_exam_marks')).toBe(1);
    expect(count(file, 'mock_exam_scores')).toBe(1);
    expect(count(file, 'sync_outbox')).toBe(0);
  });

  it('an up-to-date file is left as it is', () => {
    const file = prepare(MIGRATIONS.length);
    insertV1Data(file);
    loadDb().getDb();
    expect(userVersion(file)).toBe(MIGRATIONS.length);
    expect(mockOpened[0].exec).toEqual(['PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;']);
  });

  it('a failing step is rolled back on its own: earlier steps stay, the version stops before it', () => {
    const file = prepare(2);
    insertV1Data(file);
    const broken = [...MIGRATIONS.slice(0, 3), 'CREATE TABLE half_done (x INTEGER); SELECT * FROM no_such_table;'];
    expect(() => loadDb(broken).getDb()).toThrow(/no_such_table/);
    expect(userVersion(file)).toBe(3);
    const tables = (file.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name,
    );
    expect(tables).toContain('topic_progress');
    expect(tables).not.toContain('half_done');
    expect(count(file, 'sessions')).toBe(1);
  });
});

describe('wipeDatabase()', () => {
  function fill(): DatabaseSync {
    const file = prepare(MIGRATIONS.length);
    insertV1Data(file);
    file.exec(`
      INSERT INTO mock_exam_marks (exam_id, section_id, topic_id, wrong, blank)
        VALUES ('e1', 'matematik', 'tyt.matematik.mutlak-deger', 3, 1);
      INSERT INTO topic_progress (topic_id, status, updated_at) VALUES ('t', 'done', 1);
      INSERT INTO sync_outbox (local_id, payload, attempts, next_attempt_at, last_error, created_at)
        VALUES ('s1', '{}', 0, 0, NULL, 1);
    `);
    return file;
  }
  const tables = ['sessions', 'mock_exams', 'mock_exam_scores', 'mock_exam_marks', 'topic_progress', 'sync_outbox'];

  it('deletes every row of every table and compacts the file', () => {
    const file = fill();
    const { wipeDatabase } = loadDb();
    wipeDatabase();
    for (const t of tables) expect([t, count(file, t)]).toEqual([t, 0]);
    expect(mockOpened[0].exec).toContain('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
    // The schema stays: the app keeps working without a restart.
    expect(userVersion(file)).toBe(MIGRATIONS.length);
  });

  it('a compaction that fails (locked file) does not undo or stop the deletion', () => {
    const file = fill();
    mockFail.exec = /VACUUM/;
    const { wipeDatabase } = loadDb();
    expect(() => wipeDatabase()).not.toThrow();
    for (const t of tables) expect([t, count(file, t)]).toEqual([t, 0]);
  });
});

describe('newId()', () => {
  it('time part and an 8 character random part', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T09:00:00Z'));
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { newId } = loadDb();
    expect(newId()).toMatch(/^[0-9a-z]+-[0-9a-z]{8}$/);
    expect(newId().split('-')[0]).toBe(Date.parse('2026-10-07T09:00:00Z').toString(36));
    jest.restoreAllMocks();
  });
});
