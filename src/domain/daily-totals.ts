/** Per-day study totals, split at Istanbul midnight. */

import { DAY_MS, type DayKey, dayStartMs, splitByIstanbulDay } from './istanbul-day';
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
 * Study time per Istanbul day before `today`, only for days the spans touch (e.g. a running
 * session that crossed one or more midnights).
 */
export function pastDayTotals(spans: SessionSpan[], today: DayKey): Map<DayKey, number> {
  const out = new Map<DayKey, number>();
  for (const s of spans) {
    for (const interval of workIntervals(s.startedAt, s.pauses, s.endedAt)) {
      for (const part of splitByIstanbulDay(interval)) {
        if (part.day < today) out.set(part.day, (out.get(part.day) ?? 0) + part.ms);
      }
    }
  }
  return out;
}

/** Study time inside `[from, to)` across all spans. */
export function studiedBetween(spans: SessionSpan[], from: number, to: number): number {
  let total = 0;
  for (const s of spans) {
    for (const i of workIntervals(s.startedAt, s.pauses, s.endedAt)) {
      const start = Math.max(i.start, from);
      const end = Math.min(i.end, to);
      if (end > start) total += end - start;
    }
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
 * A session that crosses midnight counts towards both days. Each interval is first cut to the
 * asked days, so a session spanning years (a wrong device clock) costs no more than a short one.
 */
export function dailyTotals(sessions: SessionSpan[], days: DayKey[]): DayTotal[] {
  const byDay = new Map<DayKey, DayTotal>();
  let from = Infinity;
  let to = -Infinity;
  for (const day of days) {
    byDay.set(day, { day, totalMs: 0, bySubject: {} });
    from = Math.min(from, dayStartMs(day));
    to = Math.max(to, dayStartMs(day) + DAY_MS);
  }

  for (const s of sessions) {
    for (const interval of workIntervals(s.startedAt, s.pauses, s.endedAt)) {
      const start = Math.max(interval.start, from);
      const end = Math.min(interval.end, to);
      if (end <= start) continue;
      for (const part of splitByIstanbulDay({ start, end })) {
        const total = byDay.get(part.day);
        if (!total) continue;
        total.totalMs += part.ms;
        total.bySubject[s.subjectId] = (total.bySubject[s.subjectId] ?? 0) + part.ms;
      }
    }
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
