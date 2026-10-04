/**
 * Home Screen widget data as pure data: today's study time, the streak and the daily goal.
 *
 * The widget cannot run app code, so the app hands it a timeline: one entry for now and one for
 * every moment the picture changes by itself, assuming the student does nothing in between —
 * Istanbul midnight (a new day), pomodoro phase changes (study time stops/starts growing) and the
 * moment the daily goal is reached. While study time grows the widget draws the clock itself
 * (`counting`, from `at - todayMs`), so no entry per minute is needed.
 * The app sends a new timeline whenever the data changes (start, pause, finish, goal, …).
 */

import { activeSpan, dailyTotals, type SessionSpan } from './daily-totals';
import { addDays, DAY_MS, type DayKey, dayStartMs, istanbulDayKey, splitByIstanbulDay } from './istanbul-day';
import { pomodoroStatus, upcomingPhaseChanges } from './pomodoro';
import { computeStreak, goalMet, goalRatio } from './streak';
import { type ActiveSession, isPaused, workIntervals } from './timer';

/** Midnights ahead covered by the timeline (the widget shows a fresh day even if the app stays closed). */
const MIDNIGHTS_AHEAD = 2;
/** Pomodoro phase changes covered (≈ 12 hours with the default 25/5/15 rhythm). */
const PHASE_CHANGES_AHEAD = 24;
/** WidgetKit keeps the timeline small; later entries are dropped. */
export const MAX_WIDGET_ENTRIES = 40;

export interface WidgetEntry {
  /** When this entry becomes current. */
  at: number;
  day: DayKey;
  /** Study time of `day` at `at`. */
  todayMs: number;
  /** Study time keeps growing after `at` (running timer, not on a pomodoro break). */
  counting: boolean;
  goalMinutes: number | null;
  goalMet: boolean;
  /** Share of the goal at `at`, 0…1 (0 without a goal). */
  goalRatio: number;
  /** When the goal is reached if `counting` continues; `null` if met, no goal, or not counting. */
  goalReachedAt: number | null;
  /** `null` without a goal. */
  streakDays: number | null;
}

export interface WidgetTimelineInput {
  now: number;
  /** Study time per Istanbul day from saved sessions (the running session excluded). */
  savedTotal: (day: DayKey) => number;
  active: ActiveSession | null;
  /** Daily goal in minutes; `null` = none. */
  goalMinutes: number | null;
}

/** Study time per day of the running session if it ran unchanged until `at`. */
function runningByDay(active: ActiveSession, at: number): Map<DayKey, number> {
  const span: SessionSpan = activeSpan(active, at);
  const out = new Map<DayKey, number>();
  for (const interval of workIntervals(span.startedAt, span.pauses, span.endedAt)) {
    for (const part of splitByIstanbulDay(interval)) {
      out.set(part.day, (out.get(part.day) ?? 0) + part.ms);
    }
  }
  return out;
}

function isCounting(active: ActiveSession | null, at: number): boolean {
  if (active === null || isPaused(active) || at < active.startedAt) return false;
  const status = pomodoroStatus(active, at);
  return status === null || status.phase === 'work';
}

function entryAt(input: WidgetTimelineInput, at: number): WidgetEntry {
  const { savedTotal, active, goalMinutes } = input;
  const day = istanbulDayKey(at);
  const running = active === null ? null : runningByDay(active, at);
  const total = (d: DayKey) => savedTotal(d) + (running?.get(d) ?? 0);
  const todayMs = total(day);
  const counting = isCounting(active, at);
  const met = goalMinutes !== null && goalMet(todayMs, goalMinutes);
  return {
    at,
    day,
    todayMs,
    counting,
    goalMinutes,
    goalMet: met,
    goalRatio: goalMinutes === null ? 0 : goalRatio(todayMs, goalMinutes),
    goalReachedAt: null,
    streakDays: goalMinutes === null ? null : computeStreak(total, day, goalMinutes).current,
  };
}

export function widgetTimeline(input: WidgetTimelineInput): WidgetEntry[] {
  const { now, active, goalMinutes } = input;
  const points = new Set<number>([now]);
  const today = istanbulDayKey(now);
  for (let i = 1; i <= MIDNIGHTS_AHEAD; i++) points.add(dayStartMs(addDays(today, i)));
  if (active !== null) {
    for (const change of upcomingPhaseChanges(active, now, PHASE_CHANGES_AHEAD)) points.add(change.at);
  }
  const horizon = dayStartMs(addDays(today, MIDNIGHTS_AHEAD));
  const times = [...points].filter((t) => t >= now && t <= horizon).sort((a, b) => a - b);

  // The goal is reached inside a counting stretch: add that moment as its own entry.
  const goalMs = goalMinutes === null ? null : goalMinutes * 60_000;
  const entries: WidgetEntry[] = [];
  for (let i = 0; i < times.length; i++) {
    const entry = entryAt(input, times[i]);
    const end = i + 1 < times.length ? times[i + 1] : times[i] + DAY_MS;
    if (goalMs !== null && entry.counting && !entry.goalMet) {
      const reachAt = entry.at + (goalMs - entry.todayMs);
      entry.goalReachedAt = reachAt;
      entries.push(entry);
      if (reachAt < end) entries.push(entryAt(input, reachAt));
    } else {
      entries.push(entry);
    }
  }
  return entries.slice(0, MAX_WIDGET_ENTRIES);
}

/** Per-day totals of saved sessions, as the `savedTotal` lookup of `widgetTimeline`. */
export function savedTotalsLookup(sessions: SessionSpan[], days: DayKey[]): (day: DayKey) => number {
  const map = new Map(dailyTotals(sessions, days).map((t) => [t.day, t.totalMs]));
  return (day) => map.get(day) ?? 0;
}
