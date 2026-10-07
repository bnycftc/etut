/// <reference types="node" />
/**
 * @jest-environment node
 *
 * The real SQL of storage/mock-exams.ts against Node's built-in SQLite with the real migrations
 * (same adapter as backup-storage.test.ts).
 */

import {
  deleteMockExam,
  getExamMarks,
  getMockExam,
  listAllMarks,
  listExamsNeedingAnalysis,
  listMockExams,
  saveExamAnalysis,
  saveMockExam,
  sectionNetHistory,
  updateMockExam,
} from '../mock-exams';

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
  };
  return { getDb: () => adapter, newId: () => 'id', wipeDatabase: () => db.exec('DELETE FROM mock_exam_marks; DELETE FROM mock_exam_scores; DELETE FROM mock_exams;') };
});

const { wipeDatabase } = jest.requireMock('../db') as { wipeDatabase: () => void };

const tyt = [
  { sectionId: 'turkce', questions: 40, correct: 30, wrong: 4 },
  { sectionId: 'matematik', questions: 40, correct: 20, wrong: 8 },
];

beforeEach(() => wipeDatabase());

function saveTyt(id = 'e1') {
  return saveMockExam(
    { id, kind: 'TYT', scope: 'genel', bransSectionId: null, takenOn: '2026-10-05', createdAt: 10 },
    tyt,
  );
}

describe('saving', () => {
  it('a second save of the same form (double tap) creates no second exam', () => {
    saveTyt();
    saveTyt();
    expect(listMockExams()).toHaveLength(1);
    expect(getMockExam('e1')?.scores).toEqual(tyt);
  });

  it('an LGS exam is netted with wrong / 3', () => {
    const saved = saveMockExam(
      { id: 'l1', kind: 'LGS', scope: 'genel', bransSectionId: null, takenOn: '2026-10-05', createdAt: 1 },
      [{ sectionId: 'turkce', questions: 20, correct: 15, wrong: 3 }],
    );
    expect(saved.totalNet).toBe(14);
    expect(sectionNetHistory('LGS', 'turkce').map((p) => p.net)).toEqual([14]);
  });
});

describe('editing a saved exam', () => {
  it('changes date, paper type and counts in place; the analysis stays linked', () => {
    saveTyt();
    saveExamAnalysis('e1', [{ sectionId: 'turkce', topicId: 'tyt.turkce.paragraf', wrong: 3, blank: 2 }], 50);

    expect(
      updateMockExam(
        'e1',
        { kind: 'TYT', scope: 'genel', bransSectionId: null, takenOn: '2026-10-03' },
        [
          { sectionId: 'turkce', questions: 40, correct: 31, wrong: 3 },
          { sectionId: 'matematik', questions: 40, correct: 24, wrong: 4 },
        ],
        60,
      ),
    ).toBe(true);

    const exam = getMockExam('e1');
    expect(exam).toMatchObject({ takenOn: '2026-10-03', totalNet: 31 - 0.75 + 24 - 1, createdAt: 10, analysisDoneAt: 50 });
    expect(getExamMarks('e1')).toEqual([{ sectionId: 'turkce', topicId: 'tyt.turkce.paragraf', wrong: 3, blank: 2 }]);
    expect(sectionNetHistory('TYT', 'matematik').map((p) => p.net)).toEqual([23]);
    expect(listMockExams()).toHaveLength(1);
  });

  it('marks that no longer fit go and the reminder comes back', () => {
    saveTyt();
    saveExamAnalysis('e1', [{ sectionId: 'turkce', topicId: 'tyt.turkce.paragraf', wrong: 4, blank: 0 }], 50);
    updateMockExam(
      'e1',
      { kind: 'TYT', scope: 'brans', bransSectionId: 'turkce', takenOn: '2026-10-05' },
      [{ sectionId: 'turkce', questions: 40, correct: 30, wrong: 2 }],
      60,
    );
    expect(getMockExam('e1')).toMatchObject({ scope: 'brans', bransSectionId: 'turkce', analysisDoneAt: null });
    expect(getMockExam('e1')?.scores).toHaveLength(1);
    expect(getExamMarks('e1')).toEqual([]);
    expect(listExamsNeedingAnalysis().map((e) => e.id)).toEqual(['e1']);
  });

  it('an exam that no longer exists is not recreated', () => {
    expect(updateMockExam('gone', { kind: 'TYT', scope: 'genel', bransSectionId: null, takenOn: '2026-10-05' }, tyt, 1)).toBe(
      false,
    );
    expect(listMockExams()).toEqual([]);
  });
});

describe('deleting a saved exam', () => {
  it('removes the exam with its scores and topic marks; other exams stay as they are', () => {
    saveTyt('e1');
    saveTyt('e2');
    saveExamAnalysis('e1', [{ sectionId: 'turkce', topicId: 'tyt.turkce.paragraf', wrong: 3, blank: 1 }], 50);
    saveExamAnalysis('e2', [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 2, blank: 0 }], 50);

    deleteMockExam('e1');

    expect(getMockExam('e1')).toBeNull();
    expect(getExamMarks('e1')).toEqual([]);
    expect(listMockExams().map((e) => e.id)).toEqual(['e2']);
    expect(getMockExam('e2')?.scores).toEqual(tyt);
    expect(listAllMarks()).toEqual([{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 2, blank: 0 }]);
    // The net charts no longer show it either.
    expect(sectionNetHistory('TYT', 'turkce').map((p) => p.examId)).toEqual(['e2']);
  });

  it('deleting an exam that is already gone changes nothing', () => {
    saveTyt('e1');
    deleteMockExam('gone');
    expect(listMockExams().map((e) => e.id)).toEqual(['e1']);
  });

  it('an exam with a pending analysis leaves the reminder list when deleted', () => {
    saveTyt('e1');
    expect(listExamsNeedingAnalysis().map((e) => e.id)).toEqual(['e1']);
    deleteMockExam('e1');
    expect(listExamsNeedingAnalysis()).toEqual([]);
  });
});
