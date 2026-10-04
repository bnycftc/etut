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
    db.exec(
      'DELETE FROM mock_exam_marks; DELETE FROM mock_exam_scores; DELETE FROM mock_exams; ' +
        'DELETE FROM sessions; DELETE FROM topic_progress;',
    );
    expect(db.prepare('SELECT COUNT(*) AS n FROM mock_exams').get()).toEqual({ n: 0 });
    db.close();
  });

  it('a fresh install runs every step', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.length);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]).map((t) => t.name);
    expect(tables).toEqual(['mock_exam_marks', 'mock_exam_scores', 'mock_exams', 'sessions', 'topic_progress']);
    db.close();
  });
});
