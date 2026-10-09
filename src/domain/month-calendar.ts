/**
 * Monthly view ("aylık görünüm"): a Monday-first calendar of one Istanbul month with every day
 * shaded by its study time, plus the month's own numbers (total, best day, average on study
 * days, days without study). Own data only; nothing is compared with anyone.
 */

import { dailyTotals, type SessionSpan } from './daily-totals';
import { addDays, type DayKey, istanbulWeekday } from './istanbul-day';

/** Shade of a day: 0 = no study, then <1 h, 1–3 h, 3–6 h, 6 h and more. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

const HOUR_MS = 3_600_000;
/** Lower bounds of levels 2, 3 and 4 (level 1 is anything above zero). */
export const HEAT_THRESHOLDS_MS = [1 * HOUR_MS, 3 * HOUR_MS, 6 * HOUR_MS] as const;

export function heatLevel(ms: number): HeatLevel {
  if (ms <= 0) return 0;
  if (ms < HEAT_THRESHOLDS_MS[0]) return 1;
  if (ms < HEAT_THRESHOLDS_MS[1]) return 2;
  if (ms < HEAT_THRESHOLDS_MS[2]) return 3;
  return 4;
}

/** First day (`YYYY-MM-01`) of the month containing `day`. */
export function monthStartOf(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

/** First day of the month `count` months after (negative: before) the month of `monthStart`. */
export function addMonths(monthStart: DayKey, count: number): DayKey {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7)) - 1 + count;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Every day of the month that starts on `monthStart`, in order. */
export function monthDays(monthStart: DayKey): DayKey[] {
  const prefix = monthStart.slice(0, 7);
  const days: DayKey[] = [];
  for (let d = monthStart; d.startsWith(prefix); d = addDays(d, 1)) days.push(d);
  return days;
}

export interface MonthCell {
  day: DayKey;
  /** Day of the month, 1…31. */
  date: number;
  ms: number;
  level: HeatLevel;
  /** After today: nothing can have been studied yet. */
  future: boolean;
}

export interface MonthView {
  monthStart: DayKey;
  year: number;
  /** 1…12 */
  month: number;
  /** Calendar rows, Monday first; `null` = a slot outside the month. 4 to 6 rows. */
  weeks: (MonthCell | null)[][];
  days: MonthCell[];
  totalMs: number;
  /** Days of the month up to today (all of them for a past month). */
  elapsedDays: number;
  studyDays: number;
  /** Elapsed days without any study. */
  restDays: number;
  /** The day with the most study; the earlier one on a tie. `null` without study. */
  bestDay: { day: DayKey; ms: number } | null;
  /** Average over the days with study (0 without study). */
  averageStudyDayMs: number;
}

/**
 * `spans` must cover the month (the running session included as a span). `today` decides which
 * days are still to come.
 */
export function monthView(spans: SessionSpan[], monthStart: DayKey, today: DayKey): MonthView {
  const keys = monthDays(monthStart);
  const totals = dailyTotals(spans, keys);
  const days: MonthCell[] = totals.map((t) => ({
    day: t.day,
    date: Number(t.day.slice(8, 10)),
    ms: t.totalMs,
    level: heatLevel(t.totalMs),
    future: t.day > today,
  }));

  const weeks: (MonthCell | null)[][] = [];
  let row: (MonthCell | null)[] = Array.from({ length: istanbulWeekday(monthStart) }, () => null);
  for (const cell of days) {
    row.push(cell);
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }

  const elapsed = days.filter((d) => !d.future);
  const studied = elapsed.filter((d) => d.ms > 0);
  const totalMs = studied.reduce((sum, d) => sum + d.ms, 0);
  let bestDay: MonthView['bestDay'] = null;
  for (const d of studied) if (bestDay === null || d.ms > bestDay.ms) bestDay = { day: d.day, ms: d.ms };
  return {
    monthStart,
    year: Number(monthStart.slice(0, 4)),
    month: Number(monthStart.slice(5, 7)),
    weeks,
    days,
    totalMs,
    elapsedDays: elapsed.length,
    studyDays: studied.length,
    restDays: elapsed.length - studied.length,
    bestDay,
    averageStudyDayMs: studied.length === 0 ? 0 : Math.round(totalMs / studied.length),
  };
}
