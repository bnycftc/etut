/**
 * "Dünkü sen": comparisons only with the student's own past (never with other people), and the
 * weekly summary. All days and weeks are Istanbul days; weeks run Monday–Sunday.
 */

import {
  dailyTotals,
  type DayTotal,
  type SessionSpan,
  spanStudyMs,
  studiedBetween,
} from './daily-totals';
import { addDays, DAY_MS, type DayKey, dayStartMs, istanbulDayKey } from './istanbul-day';
import { goalMet, weekStartOf } from './streak';

export interface SelfComparison {
  today: number;
  /** Yesterday from 00:00 up to the same clock time as now. */
  yesterdaySameTime: number;
  /** This week from Monday 00:00 up to now. */
  thisWeek: number;
  /** Last week from Monday 00:00 up to the same weekday and clock time. */
  lastWeekSameTime: number;
}

/** `spans` must cover at least last week's Monday up to now. */
export function compareWithPast(spans: SessionSpan[], now: number): SelfComparison {
  const today = istanbulDayKey(now);
  const todayStart = dayStartMs(today);
  const weekStart = dayStartMs(weekStartOf(today));
  return {
    today: studiedBetween(spans, todayStart, now),
    yesterdaySameTime: studiedBetween(spans, todayStart - DAY_MS, now - DAY_MS),
    thisWeek: studiedBetween(spans, weekStart, now),
    lastWeekSameTime: studiedBetween(spans, weekStart - 7 * DAY_MS, now - 7 * DAY_MS),
  };
}

export interface WeeklySummary {
  weekStart: DayKey;
  days: DayTotal[];
  totalMs: number;
  manualMs: number;
  bySubject: { subjectId: string; ms: number }[];
  /** Longest single session that started in this week. */
  longest: { subjectId: string; ms: number; startedAt: number; manual: boolean } | null;
  /** Days of the week on which the goal was met; `null` without a goal. */
  goalDays: number | null;
  activeDays: number;
}

export function weekDays(weekStart: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** `spans` must cover the whole week (running session included as a span). */
export function weeklySummary(
  spans: SessionSpan[],
  weekStart: DayKey,
  goalMinutes: number | null,
): WeeklySummary {
  const days = weekDays(weekStart);
  const totals = dailyTotals(spans, days);
  const manual = dailyTotals(
    spans.filter((s) => s.source === 'manual'),
    days,
  );
  const bySubjectMap: Record<string, number> = {};
  for (const t of totals) {
    for (const [id, ms] of Object.entries(t.bySubject)) bySubjectMap[id] = (bySubjectMap[id] ?? 0) + ms;
  }
  const from = dayStartMs(weekStart);
  const to = from + 7 * DAY_MS;
  let longest: WeeklySummary['longest'] = null;
  for (const s of spans) {
    if (s.startedAt < from || s.startedAt >= to) continue;
    const ms = spanStudyMs(s);
    if (ms > 0 && (longest === null || ms > longest.ms)) {
      longest = { subjectId: s.subjectId, ms, startedAt: s.startedAt, manual: s.source === 'manual' };
    }
  }
  return {
    weekStart,
    days: totals,
    totalMs: totals.reduce((sum, t) => sum + t.totalMs, 0),
    manualMs: manual.reduce((sum, t) => sum + t.totalMs, 0),
    bySubject: Object.entries(bySubjectMap)
      .map(([subjectId, ms]) => ({ subjectId, ms }))
      .filter((e) => e.ms > 0)
      .sort((a, b) => b.ms - a.ms),
    longest,
    goalDays: goalMinutes === null ? null : totals.filter((t) => goalMet(t.totalMs, goalMinutes)).length,
    activeDays: totals.filter((t) => t.totalMs > 0).length,
  };
}
