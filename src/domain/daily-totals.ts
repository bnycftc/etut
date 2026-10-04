/** Per-day study totals, split at Istanbul midnight. */

import { type DayKey, splitByIstanbulDay } from './istanbul-day';
import { type Pause, workIntervals } from './timer';

export interface SessionSpan {
  subjectId: string;
  startedAt: number;
  endedAt: number;
  pauses: Pause[];
}

export interface DayTotal {
  day: DayKey;
  totalMs: number;
  bySubject: Record<string, number>;
}

/**
 * Totals for each day in `days` (keeps the given order; days without study are 0).
 * A session that crosses midnight counts towards both days.
 */
export function dailyTotals(sessions: SessionSpan[], days: DayKey[]): DayTotal[] {
  const byDay = new Map<DayKey, DayTotal>();
  for (const day of days) byDay.set(day, { day, totalMs: 0, bySubject: {} });

  for (const s of sessions) {
    for (const interval of workIntervals(s.startedAt, s.pauses, s.endedAt)) {
      for (const part of splitByIstanbulDay(interval)) {
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
