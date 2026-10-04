import type { DayKey } from '../domain/istanbul-day';
import { type ExamKind, type ExamScope, net, type SectionScore, totalNet } from '../domain/net';
import { getDb } from './db';

export interface MockExam {
  id: string;
  kind: ExamKind;
  scope: ExamScope;
  bransSectionId: string | null;
  takenOn: DayKey;
  totalNet: number;
  createdAt: number;
}

export interface MockExamWithScores extends MockExam {
  scores: SectionScore[];
}

interface ExamRow {
  id: string;
  kind: ExamKind;
  scope: ExamScope;
  brans_section_id: string | null;
  taken_on: string;
  total_net: number;
  created_at: number;
}

interface ScoreRow {
  section_id: string;
  questions: number;
  correct: number;
  wrong: number;
}

function toExam(row: ExamRow): MockExam {
  return {
    id: row.id,
    kind: row.kind,
    scope: row.scope,
    bransSectionId: row.brans_section_id,
    takenOn: row.taken_on,
    totalNet: row.total_net,
    createdAt: row.created_at,
  };
}

export function saveMockExam(
  exam: Omit<MockExam, 'totalNet'>,
  scores: SectionScore[],
): MockExam {
  const saved: MockExam = { ...exam, totalNet: totalNet(scores) };
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO mock_exams (id, kind, scope, brans_section_id, taken_on, total_net, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      saved.id,
      saved.kind,
      saved.scope,
      saved.bransSectionId,
      saved.takenOn,
      saved.totalNet,
      saved.createdAt,
    );
    for (const s of scores) {
      db.runSync(
        `INSERT INTO mock_exam_scores (exam_id, section_id, questions, correct, wrong, net)
         VALUES (?, ?, ?, ?, ?, ?)`,
        saved.id,
        s.sectionId,
        s.questions,
        s.correct,
        s.wrong,
        net(s.correct, s.wrong),
      );
    }
  });
  return saved;
}

/** All mock exams, newest first. */
export function listMockExams(): MockExam[] {
  return getDb()
    .getAllSync<ExamRow>(
      `SELECT id, kind, scope, brans_section_id, taken_on, total_net, created_at
       FROM mock_exams ORDER BY taken_on DESC, created_at DESC`,
    )
    .map(toExam);
}

export function getMockExam(id: string): MockExamWithScores | null {
  const db = getDb();
  const row = db.getFirstSync<ExamRow>(
    `SELECT id, kind, scope, brans_section_id, taken_on, total_net, created_at
     FROM mock_exams WHERE id = ?`,
    id,
  );
  if (!row) return null;
  const scores = db
    .getAllSync<ScoreRow>(
      `SELECT section_id, questions, correct, wrong FROM mock_exam_scores
       WHERE exam_id = ? ORDER BY rowid`,
      id,
    )
    .map((s) => ({ sectionId: s.section_id, questions: s.questions, correct: s.correct, wrong: s.wrong }));
  return { ...toExam(row), scores };
}

export function deleteMockExam(id: string): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM mock_exam_scores WHERE exam_id = ?', id);
    db.runSync('DELETE FROM mock_exams WHERE id = ?', id);
  });
}
