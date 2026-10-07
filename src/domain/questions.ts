/**
 * Solved question count ("çözülen soru"): an optional number the student may give for a study
 * session (after "Bitir" or in "Elle ekle"). Never required, never compared with anyone: it is
 * only added up for the student's own day, week and subject views.
 *
 * A session's questions belong to the Istanbul day the session started on (a count can not be
 * split at midnight like time can). Missing or 0 = not given.
 */

import type { DayKey } from './istanbul-day';
import { istanbulDayKey } from './istanbul-day';

/** More than any study session can hold (10 h × 3 questions a minute); larger input is refused. */
export const MAX_SESSION_QUESTIONS = 2000;

export type QuestionInput = { ok: true; value: number | null } | { ok: false };

/** Text field → count. Empty or 0 = not given (`null`); anything else must be a whole number in range. */
export function parseQuestionCount(text: string): QuestionInput {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  if (!/^\d{1,4}$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n > MAX_SESSION_QUESTIONS) return { ok: false };
  return { ok: true, value: n === 0 ? null : n };
}

/** A stored or imported value: a whole number 1…MAX, otherwise "not given". */
export function normalizeQuestions(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_SESSION_QUESTIONS
    ? value
    : null;
}

export interface QuestionSpan {
  subjectId: string;
  startedAt: number;
  questions?: number | null;
}

export interface QuestionTotals {
  total: number;
  byDay: Record<DayKey, number>;
  bySubject: Record<string, number>;
}

/** Questions of the sessions that started on one of `days` (other sessions are ignored). */
export function questionTotals(spans: readonly QuestionSpan[], days: readonly DayKey[]): QuestionTotals {
  const wanted = new Set(days);
  const out: QuestionTotals = { total: 0, byDay: {}, bySubject: {} };
  for (const s of spans) {
    const n = normalizeQuestions(s.questions);
    if (n === null) continue;
    const day = istanbulDayKey(s.startedAt);
    if (!wanted.has(day)) continue;
    out.total += n;
    out.byDay[day] = (out.byDay[day] ?? 0) + n;
    out.bySubject[s.subjectId] = (out.bySubject[s.subjectId] ?? 0) + n;
  }
  return out;
}
