import { analysisAfterEdit, examNeedsAnalysis, type TopicMark } from '../domain/exam-analysis';
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
  /** When "analizi tamamla" was done; `null` while the analysis is pending. */
  analysisDoneAt: number | null;
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
  analysis_done_at: number | null;
}

interface ScoreRow {
  section_id: string;
  questions: number;
  correct: number;
  wrong: number;
}

const EXAM_COLUMNS =
  'id, kind, scope, brans_section_id, taken_on, total_net, created_at, analysis_done_at';

function toExam(row: ExamRow): MockExam {
  return {
    id: row.id,
    kind: row.kind,
    scope: row.scope,
    bransSectionId: row.brans_section_id,
    takenOn: row.taken_on,
    totalNet: row.total_net,
    createdAt: row.created_at,
    analysisDoneAt: row.analysis_done_at,
  };
}

type Db = ReturnType<typeof getDb>;

function insertScores(db: Db, examId: string, kind: ExamKind, scores: readonly SectionScore[]): void {
  for (const s of scores) {
    db.runSync(
      `INSERT INTO mock_exam_scores (exam_id, section_id, questions, correct, wrong, net)
       VALUES (?, ?, ?, ?, ?, ?)`,
      examId,
      s.sectionId,
      s.questions,
      s.correct,
      s.wrong,
      net(s.correct, s.wrong, kind),
    );
  }
}

function insertMarks(db: Db, examId: string, marks: readonly TopicMark[]): void {
  for (const m of marks) {
    if (m.wrong + m.blank <= 0) continue;
    db.runSync(
      `INSERT INTO mock_exam_marks (exam_id, section_id, topic_id, wrong, blank)
       VALUES (?, ?, ?, ?, ?)`,
      examId,
      m.sectionId,
      m.topicId,
      m.wrong,
      m.blank,
    );
  }
}

/**
 * An exam without any wrong or blank answer has nothing to analyse and is saved as done.
 * Saving the same id again (a second tap on "Kaydet") changes nothing: no duplicate exam.
 */
export function saveMockExam(
  exam: Omit<MockExam, 'totalNet' | 'analysisDoneAt'>,
  scores: SectionScore[],
): MockExam {
  const saved: MockExam = {
    ...exam,
    totalNet: totalNet(scores, exam.kind),
    analysisDoneAt: examNeedsAnalysis(scores) ? null : exam.createdAt,
  };
  const db = getDb();
  db.withTransactionSync(() => {
    if (db.getFirstSync('SELECT 1 FROM mock_exams WHERE id = ?', saved.id) !== null) return;
    db.runSync(
      `INSERT INTO mock_exams (${EXAM_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      saved.id,
      saved.kind,
      saved.scope,
      saved.bransSectionId,
      saved.takenOn,
      saved.totalNet,
      saved.createdAt,
      saved.analysisDoneAt,
    );
    insertScores(db, saved.id, saved.kind, scores);
  });
  return saved;
}

export type MockExamChanges = Pick<MockExam, 'kind' | 'scope' | 'bransSectionId' | 'takenOn'>;

/**
 * Corrects a saved exam in place (paper, type, date, counts). The id and `createdAt` stay, so the
 * topic analysis stays linked; marks that no longer fit are dropped (`analysisAfterEdit`).
 * `false` when the exam no longer exists.
 */
export function updateMockExam(
  id: string,
  changes: MockExamChanges,
  scores: SectionScore[],
  now: number,
): boolean {
  const db = getDb();
  let found = false;
  db.withTransactionSync(() => {
    const before = getMockExam(id);
    if (before === null) return;
    found = true;
    const after = analysisAfterEdit(
      { kind: before.kind, scores: before.scores, marks: getExamMarks(id), analysisDoneAt: before.analysisDoneAt },
      changes.kind,
      scores,
      now,
    );
    db.runSync(
      `UPDATE mock_exams SET kind = ?, scope = ?, brans_section_id = ?, taken_on = ?, total_net = ?,
         analysis_done_at = ? WHERE id = ?`,
      changes.kind,
      changes.scope,
      changes.bransSectionId,
      changes.takenOn,
      totalNet(scores, changes.kind),
      after.analysisDoneAt,
      id,
    );
    db.runSync('DELETE FROM mock_exam_scores WHERE exam_id = ?', id);
    insertScores(db, id, changes.kind, scores);
    db.runSync('DELETE FROM mock_exam_marks WHERE exam_id = ?', id);
    insertMarks(db, id, after.marks);
  });
  return found;
}

/** All mock exams, newest first. */
export function listMockExams(): MockExam[] {
  return getDb()
    .getAllSync<ExamRow>(
      `SELECT ${EXAM_COLUMNS} FROM mock_exams ORDER BY taken_on DESC, created_at DESC`,
    )
    .map(toExam);
}

/**
 * Exams whose analysis is still pending, newest first: no `analysis_done_at` and some question
 * wrong or blank (questions − correct > 0, the same rule as `examNeedsAnalysis`). Exams saved
 * before migration 4 were marked as analysed by that migration.
 */
export function listExamsNeedingAnalysis(): MockExam[] {
  return getDb()
    .getAllSync<ExamRow>(
      `SELECT ${EXAM_COLUMNS} FROM mock_exams e
       WHERE e.analysis_done_at IS NULL
         AND EXISTS (SELECT 1 FROM mock_exam_scores s
                     WHERE s.exam_id = e.id AND s.questions - s.correct > 0)
       ORDER BY taken_on DESC, created_at DESC`,
    )
    .map(toExam);
}

export function getMockExam(id: string): MockExamWithScores | null {
  const db = getDb();
  const row = db.getFirstSync<ExamRow>(`SELECT ${EXAM_COLUMNS} FROM mock_exams WHERE id = ?`, id);
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
    db.runSync('DELETE FROM mock_exam_marks WHERE exam_id = ?', id);
    db.runSync('DELETE FROM mock_exam_scores WHERE exam_id = ?', id);
    db.runSync('DELETE FROM mock_exams WHERE id = ?', id);
  });
}

interface MarkRow {
  section_id: string;
  topic_id: string;
  wrong: number;
  blank: number;
}

function toMark(r: MarkRow): TopicMark {
  return { sectionId: r.section_id, topicId: r.topic_id, wrong: r.wrong, blank: r.blank };
}

export function getExamMarks(examId: string): TopicMark[] {
  return getDb()
    .getAllSync<MarkRow>(
      'SELECT section_id, topic_id, wrong, blank FROM mock_exam_marks WHERE exam_id = ?',
      examId,
    )
    .map(toMark);
}

/** Every topic mark of every exam (for "en çok yanlış yapılan konular"). */
export function listAllMarks(): TopicMark[] {
  return getDb()
    .getAllSync<MarkRow>('SELECT section_id, topic_id, wrong, blank FROM mock_exam_marks')
    .map(toMark);
}

/** Replaces the exam's marks and marks the analysis as done. Zero rows are not stored. */
export function saveExamAnalysis(examId: string, marks: TopicMark[], now: number): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM mock_exam_marks WHERE exam_id = ?', examId);
    insertMarks(db, examId, marks);
    db.runSync('UPDATE mock_exams SET analysis_done_at = ? WHERE id = ?', now, examId);
  });
}

export interface SectionNetPoint {
  examId: string;
  takenOn: DayKey;
  scope: ExamScope;
  net: number;
}

/** Nets of one section across exams of one kind (general and branch), oldest first. */
export function sectionNetHistory(kind: ExamKind, sectionId: string): SectionNetPoint[] {
  return getDb()
    .getAllSync<{ id: string; taken_on: string; scope: ExamScope; net: number }>(
      `SELECT e.id, e.taken_on, e.scope, s.net FROM mock_exams e
       JOIN mock_exam_scores s ON s.exam_id = e.id
       WHERE e.kind = ? AND s.section_id = ?
       ORDER BY e.taken_on, e.created_at`,
      kind,
      sectionId,
    )
    .map((r) => ({ examId: r.id, takenOn: r.taken_on, scope: r.scope, net: r.net }));
}
