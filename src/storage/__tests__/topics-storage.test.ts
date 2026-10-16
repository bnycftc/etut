/// <reference types="node" />
/**
 * @jest-environment node
 *
 * The real SQL of storage/topics.ts against Node's built-in SQLite with the real migrations
 * (same adapter as sessions-storage.test.ts).
 */

import { loadTopicMark, loadTopicStatuses, setTopicStatus } from '../topics';

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
  return { getDb: () => adapter, rawExec: (sql: string) => db.exec(sql) };
});

const { rawExec } = jest.requireMock('../db') as { rawExec: (sql: string) => void };

beforeEach(() => rawExec('DELETE FROM topic_progress;'));

describe('topic marks', () => {
  it('one mark reads back with the time it was set; none is null', () => {
    expect(loadTopicMark('tyt.fizik.basinc')).toBeNull();
    setTopicStatus('tyt.fizik.basinc', 'review', 7);
    expect(loadTopicMark('tyt.fizik.basinc')).toEqual({ status: 'review', updatedAt: 7 });
    setTopicStatus('tyt.fizik.basinc', 'done', 9);
    expect(loadTopicMark('tyt.fizik.basinc')).toEqual({ status: 'done', updatedAt: 9 });
    expect(loadTopicStatuses()).toEqual({ 'tyt.fizik.basinc': 'done' });
    setTopicStatus('tyt.fizik.basinc', null, 11);
    expect(loadTopicMark('tyt.fizik.basinc')).toBeNull();
  });

  it('an unknown stored status is no mark', () => {
    rawExec(`INSERT INTO topic_progress (topic_id, status, updated_at) VALUES ('tyt.fizik.basinc', 'later', 3);`);
    expect(loadTopicMark('tyt.fizik.basinc')).toBeNull();
  });
});
