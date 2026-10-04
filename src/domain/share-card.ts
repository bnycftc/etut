/**
 * Shareable study card ("paylaşılabilir çalışma kartı"): the numbers shown on the daily and the
 * weekly 9:16 image. Only study numbers: no name, age, school, exam type or anything else that
 * identifies the student. The image is shared with the system share sheet; nothing is uploaded.
 */

import { dailyTotals, type SessionSpan } from './daily-totals';
import { weeklySummary } from './compare';
import { addDays, type DayKey } from './istanbul-day';
import { goalMet, goalRatio } from './streak';

export type CardPeriod = 'day' | 'week';

/** Subjects listed one by one; the rest are summed into one "other subjects" row. */
export const CARD_TOP_SUBJECTS = 4;

export interface CardRow {
  /** Subject id, or `null` for the "other subjects" row. */
  subjectId: string | null;
  ms: number;
  /** Whole percent of the total; the rows add up to exactly 100. */
  percent: number;
}

export interface StudyCard {
  period: CardPeriod;
  from: DayKey;
  to: DayKey;
  totalMs: number;
  rows: CardRow[];
  /** Days with study in the period (week only). */
  activeDays: number | null;
  /** `null` without a daily goal. */
  goalMinutes: number | null;
  /** Day: share of the goal reached (0–100). */
  goalPercent: number | null;
  /** Week: days on which the goal was met. */
  goalDays: number | null;
  /** Current streak in days; `null` without a goal. */
  streakDays: number | null;
}

/**
 * Whole percents that add up to 100 (largest remainder). All zero when the total is zero.
 */
export function wholePercents(values: readonly number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v * 100) / total);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/** Largest subjects first; after `CARD_TOP_SUBJECTS`, one summed row with `subjectId: null`. */
export function cardRows(bySubject: readonly { subjectId: string; ms: number }[]): CardRow[] {
  const sorted = bySubject.filter((s) => s.ms > 0).sort((a, b) => b.ms - a.ms);
  const top = sorted.slice(0, CARD_TOP_SUBJECTS).map((s) => ({ subjectId: s.subjectId as string | null, ms: s.ms }));
  const restMs = sorted.slice(CARD_TOP_SUBJECTS).reduce((sum, s) => sum + s.ms, 0);
  const rows = restMs > 0 ? [...top, { subjectId: null, ms: restMs }] : top;
  const percents = wholePercents(rows.map((r) => r.ms));
  return rows.map((r, i) => ({ ...r, percent: percents[i] }));
}

/** `spans` must cover the day (running session included). */
export function dailyCard(
  spans: SessionSpan[],
  day: DayKey,
  goalMinutes: number | null,
  streakDays: number | null,
): StudyCard {
  const total = dailyTotals(spans, [day])[0];
  return {
    period: 'day',
    from: day,
    to: day,
    totalMs: total.totalMs,
    rows: cardRows(Object.entries(total.bySubject).map(([subjectId, ms]) => ({ subjectId, ms }))),
    activeDays: null,
    goalMinutes,
    goalPercent: goalMinutes === null ? null : Math.floor(goalRatio(total.totalMs, goalMinutes) * 100),
    goalDays: null,
    streakDays: goalMinutes === null ? null : streakDays,
  };
}

/** `spans` must cover the week (Monday `weekStart` to Sunday). */
export function weeklyCard(
  spans: SessionSpan[],
  weekStart: DayKey,
  goalMinutes: number | null,
  streakDays: number | null,
): StudyCard {
  const week = weeklySummary(spans, weekStart, goalMinutes);
  return {
    period: 'week',
    from: weekStart,
    to: addDays(weekStart, 6),
    totalMs: week.totalMs,
    rows: cardRows(week.bySubject),
    activeDays: week.activeDays,
    goalMinutes,
    goalPercent: null,
    goalDays: goalMinutes === null ? null : week.days.filter((d) => goalMet(d.totalMs, goalMinutes)).length,
    streakDays: goalMinutes === null ? null : streakDays,
  };
}
