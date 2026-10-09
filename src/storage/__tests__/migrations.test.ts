/// <reference types="node" />
/**
 * @jest-environment node
 *
 * (Node types come with @types/jest's dependencies; only this test file uses them.)
 * Runs the real migration SQL against Node's built-in SQLite (in memory), the same way
 * `db.ts` does: each step in a transaction, then PRAGMA user_version.
 */

import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../migrations';

function migrate(db: DatabaseSync, upTo: number): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < upTo; v++) {
    db.exec('BEGIN');
    db.exec(MIGRATIONS[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec('COMMIT');
  }
}

describe('database migrations', () => {
  it('upgrade a v1 database with data to the latest version', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, 1);
    db.exec(`
      INSERT INTO sessions (id, subject_id, started_at, ended_at, pauses, duration_ms, created_at)
        VALUES ('s1', 'fizik', 1000, 61000, '[]', 60000, 61000);
      INSERT INTO mock_exams (id, kind, scope, brans_section_id, taken_on, total_net, created_at)
        VALUES ('e1', 'TYT', 'genel', NULL, '2026-10-01', 70.5, 12345);
      INSERT INTO mock_exam_scores (exam_id, section_id, questions, correct, wrong, net)
        VALUES ('e1', 'matematik', 40, 30, 6, 28.5);
    `);

    migrate(db, MIGRATIONS.length);

    const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    expect(db.prepare('SELECT topic_id, source FROM sessions').get()).toEqual({ topic_id: null, source: 'timer' });
    // Exams from before the analysis feature are treated as analysed (no reminder).
    expect(db.prepare('SELECT analysis_done_at FROM mock_exams').get()).toEqual({ analysis_done_at: 12345 });

    db.exec(`
      INSERT INTO mock_exams (id, kind, scope, brans_section_id, taken_on, total_net, created_at, analysis_done_at)
        VALUES ('e2', 'TYT', 'genel', NULL, '2026-10-02', 50, 2, NULL);
      INSERT INTO mock_exam_marks (exam_id, section_id, topic_id, wrong, blank)
        VALUES ('e1', 'matematik', 'tyt.matematik.mutlak-deger', 3, 1);
      INSERT INTO topic_progress (topic_id, status, updated_at) VALUES ('t', 'done', 1);
    `);
    expect(db.prepare('SELECT analysis_done_at FROM mock_exams WHERE id = ?').get('e2')).toEqual({
      analysis_done_at: null,
    });

    // The wipe order of db.ts works with foreign keys on.
    db.exec(`
      INSERT INTO sync_outbox (local_id, payload, attempts, next_attempt_at, last_error, created_at)
        VALUES ('s1', '{}', 0, 0, NULL, 1);
    `);
    db.exec(
      'DELETE FROM mock_exam_marks; DELETE FROM mock_exam_scores; DELETE FROM mock_exams; ' +
        'DELETE FROM sessions; DELETE FROM topic_progress; DELETE FROM sync_outbox;',
    );
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM mock_exams').get()).toEqual({ n: 0 });
    db.close();
  });

  it('a fresh install runs every step', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.length);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]).map((t) => t.name);
    expect(tables).toEqual([
      'mock_exam_marks',
      'mock_exam_scores',
      'mock_exams',
      'sessions',
      'sync_outbox',
      'topic_progress',
    ]);
    db.close();
  });
});

describe('migration 6: solved question count on sessions', () => {
  it('a v5 database with sessions gets the column; old rows read as "not given", new ones keep a count', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, 5);
    db.exec(`
      INSERT INTO sessions (id, subject_id, topic_id, started_at, ended_at, pauses, duration_ms, created_at, source)
        VALUES ('s1', 'fizik', 'tyt.fizik.basinc', 1000, 61000, '[]', 60000, 61000, 'timer'),
               ('s2', 'kimya', NULL, 70000, 130000, '[]', 60000, 130000, 'manual');
      INSERT INTO sync_outbox (local_id, payload, attempts, next_attempt_at, last_error, created_at)
        VALUES ('s1', '{}', 0, 0, NULL, 1);
    `);

    migrate(db, MIGRATIONS.length);

    expect(MIGRATIONS.length).toBe(6);
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(6);
    // Nothing else changed in the rows that were there.
    expect(db.prepare('SELECT id, subject_id, topic_id, duration_ms, source, questions FROM sessions ORDER BY id').all()).toEqual([
      { id: 's1', subject_id: 'fizik', topic_id: 'tyt.fizik.basinc', duration_ms: 60000, source: 'timer', questions: null },
      { id: 's2', subject_id: 'kimya', topic_id: null, duration_ms: 60000, source: 'manual', questions: null },
    ]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toEqual({ n: 1 });

    // What storage/report.ts and storage/sessions.ts then do.
    db.prepare('UPDATE sessions SET questions = ? WHERE id = ?').run(40, 's1');
    db.exec(`
      INSERT INTO sessions (id, subject_id, topic_id, started_at, ended_at, pauses, duration_ms, source, created_at, questions)
        VALUES ('s3', 'fizik', NULL, 200000, 260000, '[]', 60000, 'timer', 260000, 12);
    `);
    expect(
      db.prepare('SELECT SUM(duration_ms) AS ms, SUM(questions) AS questions FROM sessions WHERE subject_id = ?').get('fizik'),
    ).toEqual({ ms: 120000, questions: 52 });
    // A subject without counts sums to NULL (read as 0).
    expect(db.prepare('SELECT SUM(questions) AS questions FROM sessions WHERE subject_id = ?').get('kimya')).toEqual({
      questions: null,
    });
    db.close();
  });
});
