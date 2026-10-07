/// <reference types="node" />
/**
 * @jest-environment node
 *
 * The real kv.ts and wipe.ts ("Tüm verileri sil") against an in-memory stand-in for
 * expo-sqlite/kv-store and Node's SQLite behind expo-sqlite (the real `db.ts` runs too). What is
 * checked: values read back as stored, damaged values fall back to defaults, and the wipe clears
 * every key, compacts both files on their own connection and leaves the K-17 age record alone.
 */

import { DEFAULT_POMODORO } from '../../domain/pomodoro';
import { DEFAULT_REMINDER_PREFS } from '../../domain/reminders';
import { startSession } from '../../domain/timer';
import { loadYoungestDeclaredBirthYear, storeYoungestDeclaredBirthYear } from '../age-guard';
import { getDb } from '../db';
import * as kv from '../kv';
import { wipeAllData } from '../wipe';

interface Opened {
  name: string;
  options: unknown;
  exec: string[];
  closed: boolean;
}

const mockOpened: Opened[] = [];
const mockFail: { open: boolean; exec: boolean } = { open: false, exec: false };
jest.mock('expo-sqlite/kv-store', () => {
  // Every kv-store "file" by database name (expo-sqlite/kv-store keeps one per name).
  const mockKvFiles = new Map<string, Map<string, string>>();
  class SQLiteStorage {
    private readonly rows: Map<string, string>;
    constructor(name = 'ExpoSQLiteStorage') {
      let rows = mockKvFiles.get(name);
      if (rows === undefined) {
        rows = new Map();
        mockKvFiles.set(name, rows);
      }
      this.rows = rows;
    }
    getItemSync(key: string) {
      return this.rows.get(key) ?? null;
    }
    setItemSync(key: string, value: string) {
      this.rows.set(key, value);
    }
    removeItemSync(key: string) {
      this.rows.delete(key);
    }
    clearSync() {
      this.rows.clear();
    }
  }
  return { __esModule: true, default: new SQLiteStorage(), SQLiteStorage, mockKvFiles };
});

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const files = new Map();
  const args = (p: unknown[]) => p.map((v) => (v === undefined ? null : v));
  return {
    openDatabaseSync: (name: string, options?: unknown) => {
      if (mockFail.open && name === 'ExpoSQLiteStorage') throw new Error('cannot open');
      if (!files.has(name)) files.set(name, new DatabaseSync(':memory:'));
      const db = files.get(name);
      const opened: Opened = { name, options, exec: [], closed: false };
      mockOpened.push(opened);
      return {
        getAllSync: (sql: string, ...p: unknown[]) => db.prepare(sql).all(...args(p)),
        getFirstSync: (sql: string, ...p: unknown[]) => db.prepare(sql).get(...args(p)) ?? null,
        runSync: (sql: string, ...p: unknown[]) => db.prepare(sql).run(...args(p)),
        execSync: (sql: string) => {
          opened.exec.push(sql);
          if (mockFail.exec && /VACUUM/.test(sql)) throw new Error('database is locked');
          db.exec(sql);
        },
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
        closeSync: () => {
          opened.closed = true;
        },
      };
    },
  };
});

const { mockKvFiles } = jest.requireMock('expo-sqlite/kv-store') as { mockKvFiles: Map<string, Map<string, string>> };
const mainKv = () => mockKvFiles.get('ExpoSQLiteStorage') ?? new Map<string, string>();
const PROFILE = { birthYear: 2010, examType: 'YKS', yksArea: 'sayisal', soloOnly: true, createdAt: 1 } as const;

beforeEach(() => {
  mainKv().clear();
  mockKvFiles.get('EtutAgeGuard')?.clear();
  mockOpened.length = 0;
  mockFail.open = false;
  mockFail.exec = false;
});

describe('values read back as stored; damaged values fall back to the defaults', () => {
  it('profile and running session', () => {
    expect(kv.loadProfile()).toBeNull();
    kv.storeProfile(PROFILE);
    expect(kv.loadProfile()).toEqual(PROFILE);
    mainKv().set('etut.profile.v1', '{not json');
    expect(kv.loadProfile()).toBeNull();
    mainKv().set('etut.profile.v1', JSON.stringify({ birthYear: 'x' }));
    expect(kv.loadProfile()).toBeNull();

    const session = startSession('s1', 'fizik', 1000);
    kv.storeActiveSession(session);
    expect(kv.loadActiveSession()).toEqual(session);
    kv.storeActiveSession(null);
    expect(mainKv().has('etut.activeSession.v1')).toBe(false);
    expect(kv.loadActiveSession()).toBeNull();
  });

  it('last subject, daily goal (clamped), timer mode and pomodoro lengths', () => {
    kv.storeLastSubject('kimya');
    expect(kv.loadLastSubject()).toBe('kimya');
    kv.clearLastSubject();
    expect(kv.loadLastSubject()).toBeNull();

    kv.storeDailyGoal(5);
    expect(kv.loadDailyGoal()).toBe(15);
    kv.storeDailyGoal(120);
    expect(kv.loadDailyGoal()).toBe(120);
    mainKv().set('etut.dailyGoalMinutes.v1', '"lots"');
    expect(kv.loadDailyGoal()).toBeNull();
    kv.storeDailyGoal(null);
    expect(kv.loadDailyGoal()).toBeNull();

    expect(kv.loadTimerMode()).toBe('stopwatch');
    expect(kv.loadStoredTimerMode()).toBeNull();
    kv.storeTimerMode('pomodoro');
    expect(kv.loadTimerMode()).toBe('pomodoro');
    expect(kv.loadStoredTimerMode()).toBe('pomodoro');

    expect(kv.loadPomodoroConfig()).toEqual(DEFAULT_POMODORO);
    expect(kv.loadStoredPomodoroConfig()).toBeNull();
    kv.storePomodoroConfig({ ...DEFAULT_POMODORO, workMin: 50 });
    expect(kv.loadPomodoroConfig().workMin).toBe(50);
    expect(kv.loadStoredPomodoroConfig()?.workMin).toBe(50);

    kv.restoreTimerSettings(null, null);
    expect(kv.loadStoredTimerMode()).toBeNull();
    expect(kv.loadStoredPomodoroConfig()).toBeNull();
    kv.restoreTimerSettings('stopwatch', { ...DEFAULT_POMODORO, shortBreakMin: 10 });
    expect(kv.loadStoredTimerMode()).toBe('stopwatch');
    expect(kv.loadStoredPomodoroConfig()?.shortBreakMin).toBe(10);
  });

  it('exam dates per exam type; a malformed day is ignored', () => {
    expect(kv.loadCustomExamDate('YKS')).toBeNull();
    kv.storeCustomExamDate('YKS', '2027-06-19');
    kv.storeCustomExamDate('LGS', '2027-06-12');
    expect(kv.loadCustomExamDate('YKS')).toBe('2027-06-19');
    kv.storeCustomExamDate('YKS', null);
    expect(kv.loadCustomExamDate('YKS')).toBeNull();
    expect(kv.loadCustomExamDate('LGS')).toBe('2027-06-12');
    mainKv().set('etut.examDate.v1', JSON.stringify({ YKS: '19.06.2027' }));
    expect(kv.loadCustomExamDate('YKS')).toBeNull();
    mainKv().set('etut.examDate.v1', '"x"');
    expect(kv.loadCustomExamDate('YKS')).toBeNull();
    kv.storeCustomExamDate('KPSS', '2027-07-01');
    expect(kv.loadCustomExamDate('KPSS')).toBe('2027-07-01');
  });

  it('net targets keep numbers only', () => {
    expect(kv.loadNetTargets()).toEqual({});
    kv.storeNetTarget('TYT:matematik', 30);
    kv.storeNetTarget('TYT:fizik', 8);
    kv.storeNetTarget('TYT:fizik', null);
    expect(kv.loadNetTargets()).toEqual({ 'TYT:matematik': 30 });
    kv.storeNetTargets({ 'AYT_SAY:fizik': 10 });
    expect(kv.loadNetTargets()).toEqual({ 'AYT_SAY:fizik': 10 });
    mainKv().set('etut.netTargets.v1', JSON.stringify({ a: 1, b: 'x', c: null }));
    expect(kv.loadNetTargets()).toEqual({ a: 1 });
    mainKv().set('etut.netTargets.v1', 'null');
    expect(kv.loadNetTargets()).toEqual({});
  });

  it('tips, reminders and their confirmation', () => {
    expect(kv.loadTipsSeen()).toBe(false);
    kv.storeTipsSeen();
    expect(kv.loadTipsSeen()).toBe(true);

    expect(kv.loadReminderPrefs()).toEqual(DEFAULT_REMINDER_PREFS);
    kv.storeReminderPrefs({ ...DEFAULT_REMINDER_PREFS, daily: { enabled: true, hour: 21, minute: 30 } });
    expect(kv.loadReminderPrefs().daily).toEqual({ enabled: true, hour: 21, minute: 30 });

    expect(kv.loadRemindersConfirmed()).toBe(false);
    kv.storeRemindersConfirmed();
    expect(kv.loadRemindersConfirmed()).toBe(true);
  });

  it('Live Activity record: flags only when set, a damaged record is no record', () => {
    expect(kv.loadLiveActivityRecord()).toBeNull();
    kv.storeLiveActivityRecord({ sessionId: 's', startedAt: 5 });
    expect(kv.loadLiveActivityRecord()).toEqual({ sessionId: 's', startedAt: 5 });
    kv.storeLiveActivityRecord({ sessionId: 's', startedAt: 5, dismissed: true, retried: true });
    expect(kv.loadLiveActivityRecord()).toEqual({ sessionId: 's', startedAt: 5, dismissed: true, retried: true });
    mainKv().set('etut.liveActivity.v1', JSON.stringify({ sessionId: 's', startedAt: '5', dismissed: 'yes' }));
    expect(kv.loadLiveActivityRecord()).toBeNull();
    mainKv().set('etut.liveActivity.v1', JSON.stringify({ sessionId: 's', startedAt: 5, dismissed: 'yes' }));
    expect(kv.loadLiveActivityRecord()).toEqual({ sessionId: 's', startedAt: 5 });
    mainKv().set('etut.liveActivity.v1', '7');
    expect(kv.loadLiveActivityRecord()).toBeNull();
    kv.storeLiveActivityRecord(null);
    expect(mainKv().has('etut.liveActivity.v1')).toBe(false);
  });

  it('keep awake defaults to on, the away rule to "ask"', () => {
    expect(kv.loadKeepAwake()).toBe(true);
    kv.storeKeepAwake(false);
    expect(kv.loadKeepAwake()).toBe(false);
    kv.storeKeepAwake(true);
    expect(kv.loadKeepAwake()).toBe(true);

    expect(kv.loadAwayRule()).toBe('ask');
    kv.storeAwayRule('count');
    expect(kv.loadAwayRule()).toBe('count');
    mainKv().set('etut.awayRule.v1', 'something');
    expect(kv.loadAwayRule()).toBe('ask');
  });

  it('the copy kept for "Geri al" after Değiştir', () => {
    expect(kv.loadReplaceUndo()).toBeNull();
    kv.storeReplaceUndo({ createdAt: 9, text: '{"format":"etut-yedek"}' });
    expect(kv.loadReplaceUndo()).toEqual({ createdAt: 9, text: '{"format":"etut-yedek"}' });
    mainKv().set('etut.replaceUndo.v1', JSON.stringify({ createdAt: 9 }));
    expect(kv.loadReplaceUndo()).toBeNull();
    mainKv().set('etut.replaceUndo.v1', 'null');
    expect(kv.loadReplaceUndo()).toBeNull();
    kv.storeReplaceUndo(null);
    expect(mainKv().has('etut.replaceUndo.v1')).toBe(false);
  });
});

describe('"Tüm verileri sil" (wipeAllData)', () => {
  function fill() {
    kv.storeProfile(PROFILE);
    kv.storeActiveSession(startSession('s1', 'fizik', 1000));
    kv.storeDailyGoal(60);
    kv.storeLiveActivityRecord({ sessionId: 's1', startedAt: 1000 });
    kv.storeReplaceUndo({ createdAt: 1, text: 'copy' });
    kv.storeRemindersConfirmed();
    storeYoungestDeclaredBirthYear(2010);
    getDb().runSync(
      `INSERT INTO sessions (id, subject_id, topic_id, started_at, ended_at, pauses, duration_ms, source, created_at)
       VALUES ('x', 'fizik', NULL, 1, 2, '[]', 1, 'timer', 2)`,
    );
  }

  it('clears every key and every table, compacts both files on their own connection', () => {
    fill();
    wipeAllData();

    expect([...mainKv().keys()]).toEqual([]);
    expect(kv.loadProfile()).toBeNull();
    expect(kv.loadActiveSession()).toBeNull();
    expect(kv.loadRemindersConfirmed()).toBe(false);
    expect(getDb().getFirstSync('SELECT COUNT(*) AS n FROM sessions')).toEqual({ n: 0 });

    const kvOpen = mockOpened.filter((o) => o.name === 'ExpoSQLiteStorage');
    expect(kvOpen).toHaveLength(1);
    expect(kvOpen[0].options).toEqual({ useNewConnection: true });
    expect(kvOpen[0].exec).toEqual(['PRAGMA wal_checkpoint(TRUNCATE); VACUUM;']);
    expect(kvOpen[0].closed).toBe(true);
    const dbOpen = mockOpened.filter((o) => o.name === 'etut.db');
    expect(dbOpen[0].exec).toContain('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
    // The app's own database connection stays open.
    expect(dbOpen[0].closed).toBe(false);
  });

  it('K-17: the separate age record is not touched', () => {
    fill();
    wipeAllData();
    expect(loadYoungestDeclaredBirthYear()).toBe(2010);
    storeYoungestDeclaredBirthYear(null);
    expect(loadYoungestDeclaredBirthYear()).toBeNull();
  });

  it('a locked kv file: the keys are still gone, the connection is closed, nothing is thrown', () => {
    fill();
    mockFail.exec = true;
    expect(() => wipeAllData()).not.toThrow();
    expect([...mainKv().keys()]).toEqual([]);
    expect(mockOpened.find((o) => o.name === 'ExpoSQLiteStorage')?.closed).toBe(true);
    expect(getDb().getFirstSync('SELECT COUNT(*) AS n FROM sessions')).toEqual({ n: 0 });
  });

  it('a kv file that cannot be opened: the keys are still gone', () => {
    fill();
    mockFail.open = true;
    expect(() => kv.wipeKeyValueStore()).not.toThrow();
    expect([...mainKv().keys()]).toEqual([]);
  });
});
