/**
 * Per-day study totals. A session belongs whole to the Istanbul day it started on, everywhere
 * (day totals, goal, streak, week, widget): one that crosses midnight is not split, so a day never
 * shows two numbers for the same session.
 */

import { type DayKey, istanbulDayKey } from './istanbul-day';
import {
  type ActiveSession,
  effectivePauses,
  intervalsTotal,
  type Pause,
  type SessionSource,
  workIntervals,
} from './timer';

export interface SessionSpan {
  subjectId: string;
  startedAt: number;
  endedAt: number;
  pauses: Pause[];
  topicId?: string | null;
  /** Missing = `timer`. */
  source?: SessionSource;
}

/** The running session as a span ending at `now` (pomodoro breaks included as pauses). */
export function activeSpan(session: ActiveSession, now: number): SessionSpan {
  const endedAt = Math.max(now, session.startedAt);
  return {
    subjectId: session.subjectId,
    topicId: session.topicId,
    startedAt: session.startedAt,
    endedAt,
    pauses: effectivePauses(session, endedAt),
    source: 'timer',
  };
}

/** Study time of one span. */
export function spanStudyMs(span: SessionSpan): number {
  return intervalsTotal(workIntervals(span.startedAt, span.pauses, span.endedAt));
}

/**
 * Study time per Istanbul day before `today`, only for days the spans started on (e.g. a running
 * session that started before midnight).
 */
export function pastDayTotals(spans: SessionSpan[], today: DayKey): Map<DayKey, number> {
  const out = new Map<DayKey, number>();
  for (const s of spans) {
    const day = istanbulDayKey(s.startedAt);
    if (day < today) out.set(day, (out.get(day) ?? 0) + spanStudyMs(s));
  }
  return out;
}

/**
 * Study time of the spans that started inside `[from, to)`, counted up to `to` (what a day or week
 * total showed at the moment `to`).
 */
export function studiedBetween(spans: SessionSpan[], from: number, to: number): number {
  let total = 0;
  for (const s of spans) {
    if (s.startedAt < from || s.startedAt >= to) continue;
    total += intervalsTotal(workIntervals(s.startedAt, s.pauses, Math.min(s.endedAt, to)));
  }
  return total;
}

export interface DayTotal {
  day: DayKey;
  totalMs: number;
  bySubject: Record<string, number>;
}

/**
 * Totals for each day in `days` (keeps the given order; days without study are 0).
 * A session counts whole towards the day it started on, also when it crosses midnight. Sessions
 * that started on other days are skipped before their time is summed.
 */
export function dailyTotals(sessions: SessionSpan[], days: DayKey[]): DayTotal[] {
  const byDay = new Map<DayKey, DayTotal>();
  for (const day of days) byDay.set(day, { day, totalMs: 0, bySubject: {} });

  for (const s of sessions) {
    const total = byDay.get(istanbulDayKey(s.startedAt));
    if (!total) continue;
    const ms = spanStudyMs(s);
    if (ms <= 0) continue;
    total.totalMs += ms;
    total.bySubject[s.subjectId] = (total.bySubject[s.subjectId] ?? 0) + ms;
  }
  return days.map((d) => byDay.get(d)!);
}

/** Subjects of one day, largest first. */
export function subjectBreakdown(total: DayTotal): { subjectId: string; ms: number }[] {
  return Object.entries(total.bySubject)
    .map(([subjectId, ms]) => ({ subjectId, ms }))
    .filter((e) => e.ms > 0)
    .sort((a, b) => b.ms - a.ms);
}
