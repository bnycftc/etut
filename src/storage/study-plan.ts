/**
 * Glue for the weekly study plan (`domain/study-plan.ts`): the student's weekly availability is
 * kept in the small key-value store (deleted with "Tüm verileri sil", part of the backup file since
 * version 3, kept in the demo store in demo mode via `kvStore()`); the plan itself is never stored,
 * it is computed again from the stored data each time.
 */

import { dailyTotals } from '../domain/daily-totals';
import { topMissedTopics } from '../domain/exam-analysis';
import { resolveExamDate } from '../domain/exam-dates';
import { addDays, DAY_MS, type DayKey, dayStartMs, istanbulDayKey, istanbulWeekday } from '../domain/istanbul-day';
import type { Profile } from '../domain/profile';
import {
  AVAILABILITY_MAX_MIN,
  type Availability,
  buildWeekPlan,
  type BuildWeekPlanInput,
  defaultAvailability,
  type PlanBlock,
  todayBlocks,
  type Weekday,
  type WeekPlan,
} from '../domain/study-plan';
import { loadCustomExamDate, loadDailyGoal } from './kv';
import { kvStore } from './kv-store';
import { listAllMarks } from './mock-exams';
import { sessionsOverlapping } from './sessions';
import { loadSubjectTargets } from './subject-targets';
import { loadTopicStatuses } from './topics';

const KEY = 'etut.studyAvailability.v1';

/** The editor's limits: 0 (rest day) to 8 hours a day, in 15 minute steps. */
export { AVAILABILITY_MAX_MIN };
export const AVAILABILITY_STEP_MIN = 15;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** How many missed topics the plan looks at (the engine sorts them itself). */
const MISSED_LIMIT = 30;

/** A stored value read back: every weekday a whole number of minutes within the limits, else `null`. */
export function normalizeAvailability(value: unknown): Availability | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out = {} as Availability;
  for (const day of WEEKDAYS) {
    const minutes = v[day];
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > AVAILABILITY_MAX_MIN) {
      return null;
    }
    out[day] = minutes;
  }
  return out;
}

/** The availability the student set; `null` = never set (the plan then uses the default). */
export function loadAvailability(): Availability | null {
  const raw = kvStore().getItemSync(KEY);
  if (raw === null) return null;
  try {
    return normalizeAvailability(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** `null` removes it (backup restore of a file without one). */
export function saveAvailability(availability: Availability | null): void {
  const clean = availability === null ? null : normalizeAvailability(availability);
  if (clean === null) kvStore().removeItemSync(KEY);
  else kvStore().setItemSync(KEY, JSON.stringify(clean));
}

/** The stored availability, or the default from the daily goal. */
export function availabilityOrDefault(): Availability {
  return loadAvailability() ?? defaultAvailability(loadDailyGoal());
}

/** Monday of the Istanbul week that holds `today`. */
export function weekStartFor(today: DayKey): DayKey {
  return addDays(today, -istanbulWeekday(today));
}

type PlanProfile = Pick<Profile, 'examType' | 'yksArea'>;

/** Whole minutes per subject from milliseconds per subject. */
function toMinutes(bySubject: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [subjectId, ms] of Object.entries(bySubject)) out[subjectId] = Math.floor(ms / 60_000);
  return out;
}

/** Whole minutes studied per subject this week, before today and today. */
export interface StudiedThisWeek {
  beforeToday: Record<string, number>;
  today: Record<string, number>;
}

/**
 * Study time per subject this week: before today (what the week's plan takes into account), and
 * today (what marks today's blocks done). Today's study does not change today's plan, so a block
 * the student just studied is ticked off instead of moving to another subject. The only read of
 * the sessions: screens keep it apart, so a topic mark or a setting reads no sessions.
 */
export function studiedThisWeek(today: DayKey): StudiedThisWeek {
  const weekStart = weekStartFor(today);
  const days: DayKey[] = [];
  for (let day = weekStart; day <= today; day = addDays(day, 1)) days.push(day);
  const sessions = sessionsOverlapping(dayStartMs(weekStart), dayStartMs(today) + DAY_MS);
  const before: Record<string, number> = {};
  let todayMs: Record<string, number> = {};
  for (const total of dailyTotals(sessions, days)) {
    if (total.day === today) {
      todayMs = total.bySubject;
      continue;
    }
    for (const [subjectId, ms] of Object.entries(total.bySubject)) before[subjectId] = (before[subjectId] ?? 0) + ms;
  }
  return { beforeToday: toMinutes(before), today: toMinutes(todayMs) };
}

/** Everything the plan engine needs, read from storage. */
function planInput(profile: PlanProfile, today: DayKey, studiedBefore: Record<string, number>): BuildWeekPlanInput {
  const examDate = resolveExamDate(profile.examType, loadCustomExamDate(profile.examType), today);
  const missedTopics = topMissedTopics(listAllMarks(), MISSED_LIMIT).map((m) => ({
    topicId: m.topicId,
    count: m.wrong + m.blank,
  }));
  return {
    examType: profile.examType,
    yksArea: profile.yksArea,
    examDay: examDate?.day ?? null,
    weekStart: weekStartFor(today),
    availability: availabilityOrDefault(),
    topicMarks: loadTopicStatuses(),
    missedTopics,
    subjectTargets: loadSubjectTargets(),
    studiedThisWeekBySubject: studiedBefore,
  };
}

/** This week's plan (Monday to Sunday, Istanbul days) at the moment `now`. */
export function currentWeekPlan(
  profile: PlanProfile,
  now: number,
  studied: StudiedThisWeek = studiedThisWeek(istanbulDayKey(now)),
): WeekPlan {
  return buildWeekPlan(planInput(profile, istanbulDayKey(now), studied.beforeToday));
}

export type TodayPlanBlock = PlanBlock & { done: boolean };

export interface TodaysPlan {
  /** Today's blocks with their `done` flag; empty on a rest day. */
  blocks: TodayPlanBlock[];
  /** How many of them are done. */
  done: number;
}

/** Today's blocks of this week's plan, ticked off by today's study per subject. */
export function todaysPlan(
  profile: PlanProfile,
  now: number,
  studied: StudiedThisWeek = studiedThisWeek(istanbulDayKey(now)),
): TodaysPlan {
  const today = istanbulDayKey(now);
  const plan = buildWeekPlan(planInput(profile, today, studied.beforeToday));
  const blocks = todayBlocks(plan, today, studied.today);
  return { blocks, done: blocks.filter((b) => b.done).length };
}
