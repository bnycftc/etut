/**
 * Home Screen widget data as pure data: today's study time, the streak and the daily goal.
 *
 * The widget cannot run app code, so the app hands it a timeline: one entry for now and one for
 * every moment the picture changes by itself, assuming the student does nothing in between —
 * Istanbul midnight (a new day), pomodoro phase changes (study time stops/starts growing) and the
 * moment the daily goal is reached. While study time grows the widget draws the clock itself
 * (`counting`, from `at - todayMs`), so no entry per minute is needed.
 * The app sends a new timeline whenever the data changes (start, pause, finish, goal, …) and at
 * every pomodoro phase change while it is open.
 *
 * A pomodoro can have more phase changes before the last midnight than the timeline can hold, and
 * it goes on after the last midnight. An entry that stays in effect past the first phase change the
 * timeline leaves out cannot know when that break comes, so it does not count: the timeline may show
 * less than the running session, never more.
 * Time away from the app: when the app goes to the background it passes `awayAt` (`provisionalAwayAt`
 * in `timer.ts`: rule 'ask' the moment it left, rule 'count' 3 hours later), and the timeline treats
 * the session as on an automatic break from then on: the total stops, nothing counts. Until then
 * (rule 'count') the session goes on as it is, phase changes included. That is what is saved when
 * the app comes back late and the student does not answer "Çalışıyordum" (if they do, the sync then
 * adds the time). Back within the tolerance, the next sync makes it count again.
 *
 * Exam countdown ("YKS'ye 255 gün"): the number of days left changes at every Istanbul midnight,
 * which the timeline already has entries for. With nothing running the timeline then goes on for
 * `COUNTDOWN_MIDNIGHTS` midnights instead of `SETTLED_MIDNIGHT`. An entry that stays in effect past
 * the next midnight (the last one, or one cut off by the budget) shows no countdown at all rather
 * than a number that would be a day off.
 */

import { activeSpan, dailyTotals, type SessionSpan } from './daily-totals';
import { examDaysLeft } from './exam-dates';
import { addDays, DAY_MS, type DayKey, dayStartMs, istanbulDayKey, splitByIstanbulDay } from './istanbul-day';
import { pomodoroStatus, upcomingPhaseChanges } from './pomodoro';
import type { ExamType } from './profile';
import { computeStreak, type GoalHistory, goalMet, type GoalOf, goalOfDay, goalRatio } from './streak';
import { type ActiveSession, isPaused, workIntervals } from './timer';

/** Midnights ahead covered by the timeline (the widget shows a fresh day even if the app stays closed). */
const MIDNIGHTS_AHEAD = 2;
/**
 * With nothing running, the timeline goes on to this midnight so that its last entry is right for
 * good, however long the app stays closed: by then the three days before it were missed, two of
 * them in the same week, which no rest day bridges, so the streak is 0 from there on and nothing
 * else changes either (nothing studied, goal not met). Up to that midnight a rest day can still
 * carry the streak (a missed Sunday and Monday), so every midnight in between gets its entry.
 */
const SETTLED_MIDNIGHT = 4;
/** WidgetKit keeps the timeline small; later entries are dropped. */
export const MAX_WIDGET_ENTRIES = 40;
/**
 * Midnights covered while nothing runs and an exam date is set: the countdown stays right for a
 * month with the app closed. Below the budget: now + these midnights, and an idle session has no
 * goal or phase entries.
 */
export const COUNTDOWN_MIDNIGHTS = 30;
/**
 * Pomodoro phase changes covered: what is left of `MAX_WIDGET_ENTRIES` after "now", the midnights
 * and the moments the goal is reached (at most one per day shown). 34 changes ≈ 9 hours with the
 * default 25/5/15 rhythm.
 */
export const PHASE_CHANGES_AHEAD = MAX_WIDGET_ENTRIES - 1 - MIDNIGHTS_AHEAD - (MIDNIGHTS_AHEAD + 1);

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
  /**
   * Days left to the exam on `day` (0 = exam day); missing/`null` = no date, passed, or not known
   * for sure. `estimated`: the date is the built-in estimate (missing = official or the student's).
   */
  countdown?: { examType: ExamType; daysLeft: number; estimated?: boolean } | null;
}

export interface WidgetExam {
  examType: ExamType;
  /** First day of the exam (Istanbul). */
  day: DayKey;
  /** Days the exam takes (`ExamDate.days`); missing = 1. */
  days?: number;
  /** The built-in estimate, not an official or the student's own date (`ExamDate.estimated`). */
  estimated?: boolean;
}

export interface WidgetTimelineInput {
  now: number;
  /** Study time per Istanbul day from saved sessions (the running session excluded). */
  savedTotal: (day: DayKey) => number;
  active: ActiveSession | null;
  /** Daily goal in minutes; `null` = none. */
  goalMinutes: number | null;
  /** Changes of the goal, for the streak (`goalOfDay`); missing = none kept. */
  goalHistory?: GoalHistory;
  /** Exam date for the countdown line; missing/`null` = none. */
  exam?: WidgetExam | null;
  /** In the background: from when the time away costs study time (`provisionalAwayAt`; may lie ahead). */
  awayAt?: number | null;
}

/** With `awayAt`, the running session as if the automatic away break had begun then. */
function withAway(input: WidgetTimelineInput): WidgetTimelineInput {
  const { active, awayAt } = input;
  if (active === null || awayAt === undefined || awayAt === null) return input;
  return { ...input, active: { ...active, pauses: [...active.pauses, { start: awayAt, end: null, kind: 'away' }] } };
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

/**
 * `known`: the timeline still knows what happens after `at` (see the cut in `widgetTimeline`).
 * `goalOf`: the goal of each day, `null` without a goal.
 */
function entryAt(input: WidgetTimelineInput, at: number, known: boolean, goalOf: GoalOf | null): WidgetEntry {
  const { savedTotal, active, exam } = input;
  const day = istanbulDayKey(at);
  const goalMinutes = goalOf === null ? null : goalOf(day);
  const daysLeft = exam ? examDaysLeft(exam, day) : null;
  const running = active === null ? null : runningByDay(active, at);
  const total = (d: DayKey) => savedTotal(d) + (running?.get(d) ?? 0);
  const todayMs = total(day);
  const counting = known && isCounting(active, at);
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
    streakDays: goalOf === null ? null : computeStreak(total, day, goalOf).current,
    countdown:
      exam && daysLeft !== null && daysLeft >= 0 ? { examType: exam.examType, daysLeft, estimated: exam.estimated } : null,
  };
}

export function widgetTimeline(timelineInput: WidgetTimelineInput): WidgetEntry[] {
  const input = withAway(timelineInput);
  const { now, active, goalMinutes } = input;
  // The session as it runs, and from when the away break replaces it (rule 'count': hours ahead).
  const running = timelineInput.active !== null && !isPaused(timelineInput.active) ? timelineInput.active : null;
  const awayFrom = (timelineInput.active === null ? null : timelineInput.awayAt) ?? Number.POSITIVE_INFINITY;
  const inputAt = (at: number) => (at < awayFrom ? timelineInput : input);
  const points = new Set<number>([now]);
  const today = istanbulDayKey(now);
  // Every day of the timeline is today or later and goes by the goal now; past days by their own.
  const goalOf = goalMinutes === null ? null : goalOfDay(input.goalHistory ?? [], goalMinutes, today);
  // A running session goes on counting in the timeline; only an idle one settles (see SETTLED_MIDNIGHT).
  const idle = active === null || isPaused(active);
  const examAhead = input.exam ? examDaysLeft(input.exam, today) >= 0 : false;
  const midnights = !idle ? MIDNIGHTS_AHEAD : examAhead ? COUNTDOWN_MIDNIGHTS : SETTLED_MIDNIGHT;
  for (let i = 1; i <= midnights; i++) points.add(dayStartMs(addDays(today, i)));
  const horizon = dayStartMs(addDays(today, midnights));
  // The first phase change the timeline leaves out (over budget or after the last midnight).
  // An entry that stays in effect past it cannot know about that break: it does not count.
  let firstUncovered = Number.POSITIVE_INFINITY;
  // Paused, or on the away break: phase changes change nothing any more.
  if (running !== null) {
    const changes = upcomingPhaseChanges(running, now, PHASE_CHANGES_AHEAD + 1).filter((c) => c.at < awayFrom);
    const covered = changes.filter((c) => c.at <= horizon).slice(0, PHASE_CHANGES_AHEAD);
    for (const change of covered) points.add(change.at);
    firstUncovered = changes[covered.length]?.at ?? Number.POSITIVE_INFINITY;
    // Counting right up to the away break: the total stops there (in a pomodoro break it already has).
    if (awayFrom > now && awayFrom <= horizon && isCounting(running, awayFrom - 1)) points.add(awayFrom);
  }
  const times = [...points].filter((t) => t >= now && t <= horizon).sort((a, b) => a - b);

  // The goal is reached inside a counting stretch: add that moment as its own entry.
  const goalMs = goalMinutes === null ? null : goalMinutes * 60_000;
  const entries: WidgetEntry[] = [];
  for (let i = 0; i < times.length; i++) {
    // The last entry stays in effect for good.
    const next = i + 1 < times.length ? times[i + 1] : Number.POSITIVE_INFINITY;
    const known = next <= firstUncovered;
    const entry = entryAt(inputAt(times[i]), times[i], known, goalOf);
    const end = i + 1 < times.length ? times[i + 1] : times[i] + DAY_MS;
    if (goalMs !== null && entry.counting && !entry.goalMet) {
      const reachAt = entry.at + (goalMs - entry.todayMs);
      entry.goalReachedAt = reachAt;
      entries.push(entry);
      if (reachAt < end) entries.push(entryAt(inputAt(reachAt), reachAt, known, goalOf));
    } else {
      entries.push(entry);
    }
  }
  const kept = entries.slice(0, MAX_WIDGET_ENTRIES);
  // The countdown only while the next entry comes by the next midnight (it changes there).
  for (let i = 0; i < kept.length; i++) {
    const nextAt = i + 1 < kept.length ? kept[i + 1].at : Number.POSITIVE_INFINITY;
    if (nextAt > dayStartMs(addDays(kept[i].day, 1))) kept[i].countdown = null;
  }
  return kept;
}

/** Per-day totals of saved sessions, as the `savedTotal` lookup of `widgetTimeline`. */
export function savedTotalsLookup(sessions: SessionSpan[], days: DayKey[]): (day: DayKey) => number {
  const map = new Map(dailyTotals(sessions, days).map((t) => [t.day, t.totalMs]));
  return (day) => map.get(day) ?? 0;
}
