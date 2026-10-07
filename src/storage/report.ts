/**
 * Reads and writes for the subject report card ("ders karnesi") and the optional question count.
 * Rules live in `domain/questions.ts` and `domain/report-card.ts`; this file only moves rows.
 */

import { normalizeQuestions } from '../domain/questions';
import { getDb } from './db';

/**
 * Sets (or with `null` clears) the solved question count of a saved session, e.g. right after
 * "Bitir". A missing session changes nothing.
 */
export function setSessionQuestions(id: string, questions: number | null): void {
  getDb().runSync('UPDATE sessions SET questions = ? WHERE id = ?', normalizeQuestions(questions), id);
}

export interface SubjectAllTime {
  /** Study time of every saved session of the subject. */
  ms: number;
  questions: number;
}

/** All-time totals of one subject (saved sessions only; the running one is added by the screen). */
export function subjectAllTime(subjectId: string): SubjectAllTime {
  const row = getDb().getFirstSync<{ ms: number | null; questions: number | null }>(
    'SELECT SUM(duration_ms) AS ms, SUM(questions) AS questions FROM sessions WHERE subject_id = ?',
    subjectId,
  );
  return { ms: row?.ms ?? 0, questions: row?.questions ?? 0 };
}
