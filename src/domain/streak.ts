/**
 * Daily goal and streak ("seri"), on Istanbul days.
 *
 * - A day is "met" when its study time reaches the daily goal.
 * - The streak is the number of consecutive met days ending today (or yesterday while today
 *   is still in progress: an unfinished today never breaks the streak).
 * - One missed day per week (Monday–Sunday) is a rest day: it keeps the streak alive but does
 *   not add to it. A second missed day in the same week ends the streak.
 * - The current goal applies to all past days (goal history is not kept).
 */

import { addDays, type DayKey, istanbulWeekday } from './istanbul-day';

const MIN_MS = 60_000;

/** Daily goal limits in minutes (15 min steps in the UI). */
export const GOAL_MIN_MINUTES = 15;
export const GOAL_MAX_MINUTES = 16 * 60;
/** The streak is evaluated at most this many days back. */
export const STREAK_LOOKBACK_DAYS = 400;

export interface StreakResult {
  current: number;
  todayMet: boolean;
  /** A rest day of the current week has already been used. */
  restUsedThisWeek: boolean;
}

/** Monday of the Istanbul week that contains `day`. */
export function weekStartOf(day: DayKey): DayKey {
  return addDays(day, -istanbulWeekday(day));
}

export function clampGoalMinutes(minutes: number): number {
  return Math.min(GOAL_MAX_MINUTES, Math.max(GOAL_MIN_MINUTES, Math.round(minutes)));
}

export function goalMet(totalMs: number, goalMinutes: number): boolean {
  return totalMs >= goalMinutes * MIN_MS;
}

/** Share of the goal reached, 0…1 (capped at 1). */
export function goalRatio(totalMs: number, goalMinutes: number): number {
  if (goalMinutes <= 0) return 0;
  return Math.min(1, Math.max(0, totalMs / (goalMinutes * MIN_MS)));
}

/**
 * `totals(day)` returns the study time of an Istanbul day (0 when nothing was recorded).
 */
export function computeStreak(
  totals: (day: DayKey) => number,
  today: DayKey,
  goalMinutes: number,
  lookbackDays = STREAK_LOOKBACK_DAYS,
): StreakResult {
  const thisWeek = weekStartOf(today);
  const todayMet = goalMet(totals(today), goalMinutes);
  // A rest day is only "used" when it bridges two parts of the streak, i.e. a met day lies
  // before it; a miss at the old end of the streak is just where the streak began.
  const usedRestWeeks = new Set<DayKey>();
  let tentative: DayKey[] = [];
  let current = todayMet ? 1 : 0;
  let day = addDays(today, -1);
  for (let i = 1; i <= lookbackDays; i++, day = addDays(day, -1)) {
    if (goalMet(totals(day), goalMinutes)) {
      current++;
      for (const w of tentative) usedRestWeeks.add(w);
      tentative = [];
      continue;
    }
    const week = weekStartOf(day);
    if (usedRestWeeks.has(week) || tentative.includes(week)) break;
    tentative.push(week);
  }
  return { current, todayMet, restUsedThisWeek: usedRestWeeks.has(thisWeek) };
}
