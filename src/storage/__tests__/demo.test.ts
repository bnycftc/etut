/// <reference types="node" />
/**
 * @jest-environment node
 *
 * Demo mode (storage/demo.ts) on the real storage layer: db.ts, kv.ts, kv-store.ts, backup.ts and
 * wipe.ts run unchanged over Node's SQLite behind expo-sqlite and an in-memory kv-store per file
 * name. What is checked: the student's own database file and data keys are the same before and
 * after enter → use → exit; the demo files are deleted on exit; a running timer blocks entering;
 * the flag survives a restart (fresh modules over the same "disk") and reopens the demo files.
 */

import { buildBackupFile, parseBackup, serializeBackup } from '../../domain/backup';
import { type CsvLabels, examRows, sessionRows, toCsv } from '../../domain/csv';
import { startSession } from '../../domain/timer';

interface MockDisk {
  sql: Map<string, unknown>;
  kv: Map<string, Map<string, string>>;
  open: Map<string, number>;
}

// The "disk" outlives the module registry, so a fresh set of modules (a restart) sees it.
jest.mock('expo-sqlite/kv-store', () => {
  const g = globalThis as unknown as { mockDisk?: MockDisk };
  g.mockDisk ??= { sql: new Map(), kv: new Map(), open: new Map() };
  const disk = g.mockDisk;
  class SQLiteStorage {
    constructor(private readonly name = 'ExpoSQLiteStorage') {}
    private rows(): Map<string, string> {
      let rows = disk.kv.get(this.name);
      if (rows === undefined) {
        rows = new Map();
        disk.kv.set(this.name, rows);
      }
      return rows;
    }
    getItemSync(key: string) {
      return this.rows().get(key) ?? null;
    }
    setItemSync(key: string, value: string) {
      this.rows().set(key, value);
    }
    removeItemSync(key: string) {
      this.rows().delete(key);
    }
    clearSync() {
      this.rows().clear();
    }
    closeSync() {}
  }
  return { __esModule: true, default: new SQLiteStorage(), SQLiteStorage };
});

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const g = globalThis as unknown as { mockDisk?: MockDisk };
  g.mockDisk ??= { sql: new Map(), kv: new Map(), open: new Map() };
  const disk = g.mockDisk;
  const args = (p: unknown[]) => p.map((v) => (v === undefined ? null : v));
  return {
    openDatabaseSync: (name: string) => {
      if (!disk.sql.has(name)) disk.sql.set(name, new DatabaseSync(':memory:'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = disk.sql.get(name) as any;
      disk.open.set(name, (disk.open.get(name) ?? 0) + 1);
      let closed = false;
      return {
        getAllSync: (sql: string, ...p: unknown[]) => db.prepare(sql).all(...args(p)),
        getFirstSync: (sql: string, ...p: unknown[]) => db.prepare(sql).get(...args(p)) ?? null,
        runSync: (sql: string, ...p: unknown[]) => db.prepare(sql).run(...args(p)),
        execSync: (sql: string) => db.exec(sql),
        withTransactionSync: (fn: () => void) => {
          db.exec('BEGIN');
          try {
            fn();
            db.exec('COMMIT');
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
        },
        prepareSync: (sql: string) => {
          const statement = db.prepare(sql);
          return { executeSync: (...p: unknown[]) => statement.run(...args(p)), finalizeSync: () => {} };
        },
        closeSync: () => {
          if (!closed) disk.open.set(name, (disk.open.get(name) ?? 1) - 1);
          closed = true;
        },
      };
    },
    // Like iOS: an open file cannot be deleted, a missing one is an error.
    deleteDatabaseSync: (name: string) => {
      if ((disk.open.get(name) ?? 0) > 0) throw new Error(`${name} is open`);
      if (!disk.sql.has(name) && !disk.kv.has(name)) throw new Error(`${name} not found`);
      disk.sql.delete(name);
      disk.kv.delete(name);
    },
  };
});

type Modules = {
  demo: typeof import('../demo');
  db: typeof import('../db');
  kv: typeof import('../kv');
  backup: typeof import('../backup');
  sessions: typeof import('../sessions');
  subjectTargets: typeof import('../subject-targets');
  wipe: typeof import('../wipe');
};

/** A fresh set of modules over the same disk: what the app sees after a restart. */
function load(): Modules {
  let m: Modules | undefined;
  jest.isolateModules(() => {
    m = {
      demo: require('../demo'),
      db: require('../db'),
      kv: require('../kv'),
      backup: require('../backup'),
      sessions: require('../sessions'),
      subjectTargets: require('../subject-targets'),
      wipe: require('../wipe'),
    };
  });
  return m!;
}

const disk = (): MockDisk => {
  const g = globalThis as unknown as { mockDisk?: MockDisk };
  g.mockDisk ??= { sql: new Map(), kv: new Map(), open: new Map() };
  return g.mockDisk;
};
const NOW = Date.UTC(2026, 9, 12, 9, 0);
const PROFILE = { birthYear: 2008, examType: 'YKS', yksArea: 'esit_agirlik', soloOnly: false, createdAt: 1 } as const;
const REAL_SESSION = {
  id: 'real-1',
  subjectId: 'tarih',
  topicId: null,
  startedAt: NOW - 3 * 3_600_000,
  endedAt: NOW - 2 * 3_600_000,
  pauses: [],
  durationMs: 3_600_000,
  source: 'timer' as const,
};

/** Rows of the student's own database file, read directly. */
function realRows(): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = disk().sql.get('etut.db') as any;
  return ['sessions', 'mock_exams', 'mock_exam_scores', 'mock_exam_marks', 'topic_progress', 'sync_outbox'].map((t) =>
    db.prepare(`SELECT * FROM ${t}`).all(),
  );
}

let m: Modules;
let realKvBefore: [string, string][];
let realRowsBefore: unknown[];

beforeEach(() => {
  const d = disk();
  d.sql.clear();
  d.kv.clear();
  d.open.clear();
  m = load();
  // The student's own data.
  m.kv.storeProfile(PROFILE);
  m.sessions.saveSession(REAL_SESSION, NOW);
  m.kv.storeDailyGoal(60, '2026-10-12');
  m.kv.storeNetTarget('TYT:turkce', 30);
  m.kv.storeLastSubject('tarih');
  m.kv.storeReminderPrefs({ ...m.kv.loadReminderPrefs() });
  m.subjectTargets.storeSubjectTarget('tarih', 120);
  realKvBefore = [...d.kv.get('ExpoSQLiteStorage')!.entries()];
  realRowsBefore = realRows();
});

it('keeps the real data the same through enter → use → exit and deletes the demo files', () => {
  const realBackup = m.backup.readBackupData();
  expect(m.demo.isDemo()).toBe(false);

  expect(m.demo.enterDemo(PROFILE, NOW)).toBe('ok');
  expect(m.demo.isDemo()).toBe(true);
  expect(m.db.databaseFile()).toBe('etut-demo.db');
  const demo = m.backup.readBackupData();
  expect(demo.sessions.length).toBeGreaterThan(60);
  expect(demo.sessions.some((s) => s.id === 'real-1')).toBe(false);
  expect(demo.settings.dailyGoalMinutes).toBe(150);
  expect(demo.exams.map((e) => e.kind)).toContain('AYT_EA');
  // The profile stays the student's own.
  expect(m.kv.loadProfile()).toEqual(PROFILE);

  // Using the app in demo mode.
  m.sessions.saveSession({ ...REAL_SESSION, id: 'demo-new' }, NOW);
  m.kv.storeDailyGoal(30, '2026-10-12');
  m.kv.storeNetTarget('TYT:turkce', 38);
  m.kv.storeActiveSession(startSession('demo-run', 'matematik', NOW));
  m.subjectTargets.storeSubjectTarget('matematik', 600);
  expect(m.kv.loadDailyGoal()).toBe(30);

  // Nothing of the student's own changed meanwhile (only the flag was added).
  expect(realRows()).toEqual(realRowsBefore);
  const realKv = new Map(disk().kv.get('ExpoSQLiteStorage'));
  expect(realKv.get('etut.demoMode.v1')).toBe('1');
  realKv.delete('etut.demoMode.v1');
  expect([...realKv.entries()]).toEqual(realKvBefore);

  m.demo.exitDemo();
  expect(m.demo.isDemo()).toBe(false);
  expect(m.db.databaseFile()).toBe('etut.db');
  expect(m.backup.readBackupData()).toEqual(realBackup);
  expect(m.kv.loadActiveSession()).toBeNull();
  expect([...disk().kv.get('ExpoSQLiteStorage')!.entries()]).toEqual(realKvBefore);
  expect(disk().sql.has('etut-demo.db')).toBe(false);
  expect(disk().kv.has('etut-demo-kv')).toBe(false);
});

it('refuses to start while the real timer runs', () => {
  const running = startSession('real-run', 'tarih', NOW);
  m.kv.storeActiveSession(running);
  expect(m.demo.enterDemo(PROFILE, NOW)).toBe('timer_running');
  expect(m.demo.isDemo()).toBe(false);
  expect(m.kv.loadActiveSession()).toEqual(running);
  expect(disk().sql.has('etut-demo.db')).toBe(false);
});

it('reopens the demo files after a restart, and the real ones after leaving', () => {
  m.demo.enterDemo(PROFILE, NOW);
  m.kv.storeDailyGoal(45, '2026-10-12');
  const demoSessions = m.sessions.allSessions().length;

  const restarted = load();
  expect(restarted.demo.isDemo()).toBe(true);
  expect(restarted.sessions.allSessions()).toHaveLength(demoSessions);
  expect(restarted.kv.loadDailyGoal()).toBe(45);
  expect(restarted.db.databaseFile()).toBe('etut-demo.db');

  restarted.demo.exitDemo();
  const again = load();
  expect(again.demo.isDemo()).toBe(false);
  expect(again.sessions.allSessions()).toEqual([REAL_SESSION]);
  expect(again.kv.loadDailyGoal()).toBe(60);
  expect(realRows()).toEqual(realRowsBefore);
});

it('"Tüm verileri sil" in demo mode deletes the example data only', () => {
  m.demo.enterDemo(PROFILE, NOW);
  m.wipe.wipeAllData();
  expect(m.demo.isDemo()).toBe(false);
  expect(m.sessions.allSessions()).toEqual([REAL_SESSION]);
  expect(m.kv.loadProfile()).toEqual(PROFILE);
  expect(m.kv.loadDailyGoal()).toBe(60);
  expect(disk().sql.has('etut-demo.db')).toBe(false);
  expect(disk().kv.has('etut-demo-kv')).toBe(false);
});

it('builds the example data again when entered twice', () => {
  m.demo.enterDemo(PROFILE, NOW);
  m.sessions.saveSession({ ...REAL_SESSION, id: 'demo-extra' }, NOW);
  m.kv.storeActiveSession(startSession('demo-run', 'matematik', NOW));
  const before = m.sessions.allSessions().length;
  expect(m.demo.enterDemo({ ...PROFILE, examType: 'LGS', yksArea: null }, NOW)).toBe('ok');
  expect(m.sessions.allSessions().some((s) => s.id === 'demo-extra')).toBe(false);
  expect(m.sessions.allSessions().length).toBeLessThanOrEqual(before);
  expect(m.kv.loadActiveSession()).toBeNull();
  expect(m.backup.readBackupData().exams.every((e) => e.kind === 'LGS')).toBe(true);
  m.demo.exitDemo();
  expect(realRows()).toEqual(realRowsBefore);
});

describe('export after a demo visit (backup file and CSV)', () => {
  const labels: CsvLabels = {
    subject: (id) => id,
    topic: (id) => id,
    source: (s) => s,
    examKind: (k) => k,
    scope: (s) => s,
    yesNo: (v) => (v ? 'evet' : 'hayır'),
  };
  /** What "Yedek al" and the CSV buttons of app/yedek.tsx build from the open data files. */
  const exportNow = () => {
    const data = m.backup.readBackupData();
    const json = serializeBackup(buildBackupFile(data, m.kv.loadProfile(), NOW, '0.5.0'));
    return {
      json,
      sessionsCsv: toCsv(['day'], sessionRows(data.sessions, labels)),
      examsCsv: toCsv(['day'], examRows(data.exams, labels)),
    };
  };
  const csvLines = (csv: string) => csv.trimEnd().split('\r\n');

  it('reads the example data while demo mode is on (why the app refuses to export then)', () => {
    m.demo.enterDemo(PROFILE, NOW);
    const { json, sessionsCsv, examsCsv } = exportNow();
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // The open file is the demo one: none of the student's own rows, all of the example ones.
    expect(parsed.file.sessions.some((s) => s.id === 'real-1')).toBe(false);
    expect(parsed.file.sessions.length).toBeGreaterThan(60);
    expect(parsed.file.settings.dailyGoalMinutes).toBe(150);
    expect(csvLines(sessionsCsv).length - 1).toBe(parsed.file.sessions.length);
    expect(csvLines(examsCsv).length).toBeGreaterThan(1);
    m.demo.exitDemo();
  });

  it('exports only the student’s own data after leaving, nothing written in demo mode', () => {
    const before = exportNow();
    m.demo.enterDemo(PROFILE, NOW);
    // Using the app in demo mode adds rows and changes settings in the demo files.
    m.sessions.saveSession({ ...REAL_SESSION, id: 'demo-new', subjectId: 'fizik' }, NOW);
    m.kv.storeDailyGoal(30, '2026-10-12');
    m.subjectTargets.storeSubjectTarget('matematik', 600);
    m.demo.exitDemo();

    const after = exportNow();
    // The same three files as before the visit (the export time is fixed here).
    expect(after).toEqual(before);
    const parsed = parseBackup(after.json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.sessions.map((s) => s.id)).toEqual(['real-1']);
    expect(parsed.file.exams).toEqual([]);
    expect(parsed.file.topicProgress).toEqual([]);
    expect(parsed.file.settings.dailyGoalMinutes).toBe(60);
    expect(parsed.file.settings.subjectWeeklyTargets).toEqual({ tarih: 120 });
    expect(parsed.file.profile).toEqual({ birthYear: 2008, examType: 'YKS', yksArea: 'esit_agirlik' });
    // CSV: the header and the one real session; the exam file has the header only.
    const rows = csvLines(after.sessionsCsv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain(';tarih;');
    expect(after.sessionsCsv).not.toContain('fizik');
    expect(csvLines(after.examsCsv)).toHaveLength(1);
  });
});
