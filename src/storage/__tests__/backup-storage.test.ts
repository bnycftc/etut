/// <reference types="node" />
/**
 * @jest-environment node
 *
 * The real SQL of storage/backup.ts (and the session/exam readers it uses) against Node's
 * built-in SQLite with the real migrations. `getDb()` is replaced by a thin adapter with the
 * expo-sqlite method names; the kv-store by an in-memory map.
 */

import { buildBackupFile, type BackupData, mergeBackup, parseBackup, serializeBackup } from '../../domain/backup';
import { readBackupData, writeBackupData } from '../backup';

jest.mock('../db', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { MIGRATIONS } = require('../migrations');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const sql of MIGRATIONS) db.exec(sql);
  const args = (p: unknown[]) => p.map((v) => (v === undefined ? null : v));
  const adapter = {
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
  };
  return { getDb: () => adapter, newId: () => 'id', wipeDatabase: () => {} };
});

jest.mock('../kv', () => {
  const store = new Map<string, unknown>();
  return {
    loadCustomExamDate: (t: string) => (store.get(`date:${t}`) as string | undefined) ?? null,
    storeCustomExamDate: (t: string, d: string | null) =>
      d === null ? store.delete(`date:${t}`) : store.set(`date:${t}`, d),
    loadDailyGoal: () => (store.get('goal') as number | undefined) ?? null,
    storeDailyGoal: (m: number | null) => (m === null ? store.delete('goal') : store.set('goal', m)),
    loadLastSubject: () => (store.get('last') as string | undefined) ?? null,
    storeLastSubject: (s: string) => store.set('last', s),
    clearLastSubject: () => store.delete('last'),
    loadNetTargets: () => ({ ...((store.get('targets') as Record<string, number> | undefined) ?? {}) }),
    storeNetTargets: (t: Record<string, number>) => store.set('targets', { ...t }),
    loadStoredPomodoroConfig: () => store.get('pomodoro') ?? null,
    loadStoredTimerMode: () => store.get('mode') ?? null,
    restoreTimerSettings: (mode: string | null, pomodoro: unknown) => {
      if (mode === null) store.delete('mode');
      else store.set('mode', mode);
      if (pomodoro === null) store.delete('pomodoro');
      else store.set('pomodoro', pomodoro);
    },
  };
});

const T0 = Date.parse('2026-10-01T07:00:00Z');

const DATA: BackupData = {
  sessions: [
    {
      id: 's1',
      subjectId: 'fizik',
      topicId: 'tyt.fizik.basinc',
      startedAt: T0,
      endedAt: T0 + 3_600_000,
      pauses: [{ start: T0 + 60_000, end: T0 + 120_000, kind: 'away' }],
      durationMs: 3_540_000,
      source: 'timer',
    },
    {
      id: 's2',
      subjectId: 'kimya',
      topicId: null,
      startedAt: T0 + 7_200_000,
      endedAt: T0 + 9_000_000,
      pauses: [],
      durationMs: 1_800_000,
      source: 'manual',
    },
  ],
  exams: [
    {
      id: 'e1',
      kind: 'TYT',
      scope: 'brans',
      bransSectionId: 'matematik',
      takenOn: '2026-10-01',
      createdAt: 5,
      analysisDoneAt: 9,
      scores: [{ sectionId: 'matematik', questions: 40, correct: 30, wrong: 6 }],
      marks: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 2, blank: 1 }],
    },
    {
      id: 'e2',
      kind: 'YDT',
      scope: 'genel',
      bransSectionId: null,
      takenOn: '2026-10-03',
      createdAt: 6,
      analysisDoneAt: null,
      scores: [{ sectionId: 'yabanci_dil', questions: 80, correct: 60, wrong: 8 }],
      marks: [],
    },
  ],
  topicProgress: [
    { topicId: 'tyt.fizik.basinc', status: 'done', updatedAt: 11 },
    { topicId: 'tyt.kimya.mol', status: 'review', updatedAt: 12 },
  ],
  settings: {
    dailyGoalMinutes: 90,
    pomodoro: { workMin: 40, shortBreakMin: 10, longBreakMin: 20, longEvery: 3 },
    timerMode: 'pomodoro',
    examDates: { YKS: '2027-06-26' },
    netTargets: { 'TYT:matematik': 32.5 },
    lastSubject: 'kimya',
  },
};

describe('backup storage (real SQL)', () => {
  it('writes a data set and reads exactly the same back', () => {
    writeBackupData(DATA);
    expect(readBackupData()).toEqual(DATA);
  });

  it('writing replaces everything that was there before', () => {
    writeBackupData(DATA);
    const smaller: BackupData = {
      ...DATA,
      sessions: [DATA.sessions[1]],
      exams: [],
      topicProgress: [],
      settings: { ...DATA.settings, dailyGoalMinutes: null, examDates: {}, netTargets: {}, lastSubject: null },
    };
    writeBackupData(smaller);
    expect(readBackupData()).toEqual(smaller);
  });

  it('all or nothing: a failing write leaves the previous data untouched', () => {
    writeBackupData(DATA);
    const broken = { ...DATA, sessions: [DATA.sessions[0], DATA.sessions[0]] };
    expect(() => writeBackupData(broken)).toThrow();
    expect(readBackupData().sessions).toEqual(DATA.sessions);
    expect(readBackupData().exams).toHaveLength(2);
  });

  it('export → file → import (merge) twice gives the same rows (no duplicates)', () => {
    writeBackupData(DATA);
    const text = serializeBackup(buildBackupFile(readBackupData(), null, T0 + 86_400_000, 'test'));
    const result = parseBackup(text);
    if (!result.ok) throw new Error(result.error);
    for (let i = 0; i < 2; i++) writeBackupData(mergeBackup(readBackupData(), result.file, 'merge'));
    expect(readBackupData()).toEqual(DATA);
  });

  it('LGS and KPSS exams go through a backup; an LGS net is restored with wrong / 3', () => {
    const lgs: BackupData['exams'][number] = {
      id: 'l1',
      kind: 'LGS',
      scope: 'genel',
      bransSectionId: null,
      takenOn: '2026-10-04',
      createdAt: 7,
      analysisDoneAt: null,
      scores: [
        { sectionId: 'turkce', questions: 20, correct: 15, wrong: 3 },
        { sectionId: 'inkilap', questions: 10, correct: 8, wrong: 1 },
        { sectionId: 'din', questions: 10, correct: 9, wrong: 0 },
        { sectionId: 'yabanci_dil', questions: 10, correct: 7, wrong: 3 },
        { sectionId: 'matematik', questions: 20, correct: 12, wrong: 6 },
        { sectionId: 'fen', questions: 20, correct: 14, wrong: 3 },
      ],
      marks: [{ sectionId: 'fen', topicId: 'lgs.fen.kalitim', wrong: 2, blank: 1 }],
    };
    const kpss: BackupData['exams'][number] = {
      id: 'k1',
      kind: 'KPSS_GYGK',
      scope: 'brans',
      bransSectionId: 'vatandaslik',
      takenOn: '2026-10-05',
      createdAt: 8,
      analysisDoneAt: 8,
      scores: [{ sectionId: 'vatandaslik', questions: 9, correct: 9, wrong: 0 }],
      marks: [],
    };
    const data: BackupData = { ...DATA, exams: [...DATA.exams, lgs, kpss] };
    const text = serializeBackup(buildBackupFile(data, null, T0, 'test'));
    const result = parseBackup(text);
    if (!result.ok) throw new Error(result.error);
    writeBackupData(result.file);
    expect(readBackupData().exams).toEqual(data.exams);
    const { getMockExam } = jest.requireActual('../mock-exams') as typeof import('../mock-exams');
    expect(getMockExam('l1')?.totalNet).toBeCloseTo(14 + (8 - 1 / 3) + 9 + 6 + 10 + 13, 10);
  });
});
