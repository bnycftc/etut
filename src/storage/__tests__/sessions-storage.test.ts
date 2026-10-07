/// <reference types="node" />
/**
 * @jest-environment node
 *
 * The real SQL of storage/sessions.ts against Node's built-in SQLite with the real migrations
 * (same adapter as mock-exams.test.ts). The screens use an in-memory stand-in for these
 * functions, so the queries themselves are checked here.
 */

import type { CompletedSession } from '../../domain/timer';
import {
  allSessions,
  deleteManualSession,
  deleteSessionForUndo,
  recentManualSessions,
  saveSession,
  sessionsOverlapping,
  topicTotals,
} from '../sessions';

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
  };
  return {
    getDb: () => adapter,
    newId: () => 'id',
    wipeDatabase: () => db.exec('DELETE FROM sessions;'),
    rawExec: (sql: string) => db.exec(sql),
  };
});

const { wipeDatabase, rawExec } = jest.requireMock('../db') as { wipeDatabase: () => void; rawExec: (sql: string) => void };

const MIN = 60_000;
const T0 = Date.parse('2026-10-07T06:00:00Z'); // 09:00 Istanbul

function session(id: string, startMin: number, lengthMin: number, extra: Partial<CompletedSession> = {}): CompletedSession {
  return {
    id,
    subjectId: 'fizik',
    topicId: null,
    startedAt: T0 + startMin * MIN,
    endedAt: T0 + (startMin + lengthMin) * MIN,
    pauses: [],
    durationMs: lengthMin * MIN,
    source: 'timer',
    ...extra,
  };
}

beforeEach(() => wipeDatabase());

it('saving the same session twice keeps one row (the second save wins)', () => {
  saveSession(session('a', 0, 30), 1);
  saveSession(session('a', 0, 40), 2);
  expect(allSessions()).toEqual([session('a', 0, 40)]);
});

it('pauses are stored and read back; a damaged pauses column reads as no pauses', () => {
  const withPause = session('p', 0, 60, {
    pauses: [{ start: T0 + 10 * MIN, end: T0 + 20 * MIN, kind: 'away' }],
    durationMs: 50 * MIN,
  });
  saveSession(withPause, 1);
  saveSession(session('q', 100, 10), 1);
  rawExec(`UPDATE sessions SET pauses = 'not json' WHERE id = 'q'`);
  saveSession(session('r', 200, 10), 1);
  rawExec(`UPDATE sessions SET pauses = '[{"start":1},{"start":1,"end":2,"kind":"manual"}]' WHERE id = 'r'`);
  saveSession(session('s', 300, 10), 1);
  rawExec(`UPDATE sessions SET pauses = '{"start":1}' WHERE id = 's'`);
  const read = allSessions();
  expect(read[0]).toEqual(withPause);
  expect(read[1].pauses).toEqual([]);
  expect(read[2].pauses).toEqual([{ start: 1, end: 2, kind: 'manual' }]);
  expect(read[3].pauses).toEqual([]);
});

it('sessionsOverlapping returns only the sessions that touch the range, oldest first', () => {
  saveSession(session('late', 120, 30), 1);
  saveSession(session('early', 0, 30), 1);
  saveSession(session('cross', 50, 30), 1);
  const ids = (from: number, to: number) => sessionsOverlapping(T0 + from * MIN, T0 + to * MIN).map((s) => s.id);
  expect(ids(0, 200)).toEqual(['early', 'cross', 'late']);
  expect(ids(60, 90)).toEqual(['cross']);
  // Touching the edge is not overlapping.
  expect(ids(30, 50)).toEqual([]);
  expect(ids(150, 151)).toEqual([]);
});

it('manual entries: newest first, limited; only they can be deleted from history', () => {
  saveSession(session('m1', 0, 10, { source: 'manual' }), 1);
  saveSession(session('m2', 20, 10, { source: 'manual' }), 1);
  saveSession(session('t1', 40, 10), 1);
  saveSession(session('m3', 60, 10, { source: 'manual' }), 1);
  expect(recentManualSessions(2).map((s) => s.id)).toEqual(['m3', 'm2']);
  expect(recentManualSessions(10).every((s) => s.source === 'manual')).toBe(true);

  deleteManualSession('t1');
  deleteManualSession('m2');
  expect(allSessions().map((s) => s.id)).toEqual(['m1', 't1', 'm3']);
});

it('"Geri al" after Bitir removes only a timer session', () => {
  saveSession(session('m1', 0, 10, { source: 'manual' }), 1);
  saveSession(session('t1', 40, 10), 1);
  deleteSessionForUndo('m1');
  deleteSessionForUndo('t1');
  expect(allSessions().map((s) => s.id)).toEqual(['m1']);
});

it('topicTotals sums study time per topic and ignores sessions without one', () => {
  saveSession(session('a', 0, 10, { topicId: 'tyt.fizik.basinc' }), 1);
  saveSession(session('b', 20, 15, { topicId: 'tyt.fizik.basinc' }), 1);
  saveSession(session('c', 40, 5, { topicId: 'tyt.fizik.optik' }), 1);
  saveSession(session('d', 60, 50), 1);
  expect(topicTotals()).toEqual({ 'tyt.fizik.basinc': 25 * MIN, 'tyt.fizik.optik': 5 * MIN });
});
