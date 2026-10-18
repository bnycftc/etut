/**
 * Daily goal and streak ("seri"), on Istanbul days.
 *
 * - A day is "met" when its study time reaches the daily goal.
 * - The streak is the number of consecutive met days ending today (or yesterday while today
 *   is still in progress: an unfinished today never breaks the streak).
 * - One missed day per week (Monday–Sunday) is a rest day: it keeps the streak alive but does
 *   not add to it. A second missed day in the same week ends the streak.
 * - Each day is judged by the goal of that day (`goalOfDay`, goal history): raising the goal never
 *   breaks a streak already there, lowering it never adds past days to one.
 * - Today: a raise made after today's goal was met starts tomorrow (a met day stays met); a raise
 *   before that, and any lowering, applies today (`withGoalChange`).
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

/** A change of the daily goal: `minutes` is the goal from the Istanbul day `from` on. */
export interface GoalChange {
  from: DayKey;
  minutes: number;
}

/** Changes of the daily goal, oldest first, at most one per day. */
export type GoalHistory = readonly GoalChange[];

/** The goal an Istanbul day is judged by, in minutes. */
export type GoalOf = (day: DayKey) => number;

/**
 * The goal each day is judged by: the goal set last on or before that day. Today and later days
 * take `current` (the goal now), except while a raise waits for tomorrow (an entry after today):
 * today then keeps the goal in force before it. Days before the first change take the first goal:
 * study from before a goal was set counts towards the first one, as it always did. Without a
 * history (a goal set before the history was kept, never changed since) `current` applies to
 * every day.
 */
export function goalOfDay(history: GoalHistory, current: number, today: DayKey): GoalOf {
  const past = history.filter((c) => c.from < today);
  const pending = history.some((c) => c.from > today);
  const todayGoal = pending ? (history.filter((c) => c.from <= today).pop()?.minutes ?? current) : current;
  return (day) => {
    if (day === today) return todayGoal;
    if (day > today || past.length === 0) return current;
    // The last change on or before `day` (binary search; the list is in day order).
    let lo = 0;
    let hi = past.length - 1;
    let found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (past[mid].from <= day) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return past[found].minutes;
  };
}

/** The goal that starts tomorrow (a raise after today's goal was met), if there is one. */
export function goalFromTomorrow(history: GoalHistory, today: DayKey): number | null {
  return history.find((c) => c.from > today)?.minutes ?? null;
}

/**
 * The history after the goal is set to `minutes` (`null` = turned off) on `today`; `previous` is
 * the goal until now, `todayMs` today's study time so far. A raise after today's goal (the one in
 * force today) was met starts tomorrow: today keeps its goal, so a met day stays met. A raise
 * before that and any lowering apply today. A change replaces one made earlier the same day (and
 * one waiting for tomorrow); a change back to the goal in force before it leaves no entry. Turning
 * the goal off changes nothing (the streak is only hidden; when a goal is set again, the days in
 * between keep the last goal). A goal from before the history was kept is written down first, from
 * the day before, so that the days before keep it.
 */
export function withGoalChange(
  history: GoalHistory,
  previous: number | null,
  minutes: number | null,
  today: DayKey,
  todayMs = 0,
): GoalHistory {
  if (minutes === previous) return history;
  const todayGoal = previous === null ? null : goalOfDay(history, previous, today)(today);
  const known = history.length === 0 && previous !== null ? [{ from: addDays(today, -1), minutes: previous }] : history;
  if (minutes === null) return known;
  const kept = known.filter((c) => c.from < today);
  const last = kept[kept.length - 1];
  const keep = (goal: number): GoalChange[] =>
    last !== undefined && last.minutes === goal ? [] : [{ from: today, minutes: goal }];
  if (todayGoal !== null && minutes > todayGoal && goalMet(todayMs, todayGoal)) {
    return [...kept, ...keep(todayGoal), { from: addDays(today, 1), minutes }];
  }
  return [...kept, ...keep(minutes)];
}

/**
 * A stored history read back: entries that are not a day and a number are dropped, minutes are
 * kept within the goal limits, and the list is put in day order with one entry per day.
 */
export function normalizeGoalHistory(value: unknown): GoalHistory {
  if (!Array.isArray(value)) return [];
  const byDay = new Map<DayKey, number>();
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const { from, minutes } = item as Record<string, unknown>;
    if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from) || addDays(from, 0) !== from) continue;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) continue;
    byDay.set(from, clampGoalMinutes(minutes));
  }
  return [...byDay.keys()].sort().map((from) => ({ from, minutes: byDay.get(from) as number }));
}

/**
 * `totals(day)` returns the study time of an Istanbul day (0 when nothing was recorded);
 * `goalOf(day)` the goal that day is judged by (`goalOfDay`).
 */
export function computeStreak(
  totals: (day: DayKey) => number,
  today: DayKey,
  goalOf: GoalOf,
  lookbackDays = STREAK_LOOKBACK_DAYS,
): StreakResult {
  const thisWeek = weekStartOf(today);
  const todayMet = goalMet(totals(today), goalOf(today));
  // A rest day is only "used" when it bridges two parts of the streak, i.e. a met day lies
  // before it; a miss at the old end of the streak is just where the streak began.
  const usedRestWeeks = new Set<DayKey>();
  let tentative: DayKey[] = [];
  let current = todayMet ? 1 : 0;
  let day = addDays(today, -1);
  for (let i = 1; i <= lookbackDays; i++, day = addDays(day, -1)) {
    if (goalMet(totals(day), goalOf(day))) {
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
