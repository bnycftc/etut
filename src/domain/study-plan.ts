/**
 * Weekly study plan ("haftalık çalışma planı"): turns the student's exam, weekly availability,
 * topic marks, most-missed topics and subject targets into blocks of 25–60 minutes.
 *
 * Everything here is a pure function of its arguments: no clock, no storage, no randomness, so the
 * same input always gives the same week. User-facing texts are left to the UI.
 */

import { findTopic, topicsForSubject } from './curriculum';
import { DAY_MS, dayStartMs, istanbulWeekday } from './istanbul-day';
import { examKindsFor, type YksArea } from './net';
import type { ExamType } from './profile';
import { examSectionsForSubject } from './report-card';
import { subjectsFor } from './subjects';
import type { TopicStatus } from './topics';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Minutes available per weekday (0 = Monday … 6 = Sunday). */
export type Availability = Record<Weekday, number>;

export type PlanPhase = 'learn' | 'mixed' | 'review';

export type PlanBlock = {
  day: Weekday;
  subjectId: string;
  /** `null` = subject-only block (no curriculum, exam passed, or DIGER). */
  topicId: string | null;
  /** 25..60 inclusive. */
  minutes: number;
  reason: 'review' | 'missed' | 'next' | 'target' | 'exam-day' | 'balance';
};

export type WeekPlan = {
  /** Day key (Monday) of the week. */
  weekStart: string;
  phase: PlanPhase;
  daysLeft: number | null;
  /** Ordered by day, then by position. */
  blocks: PlanBlock[];
  totalMinutes: number;
};

export type BuildWeekPlanInput = {
  examType: ExamType;
  yksArea: YksArea | null;
  /** Day key of the exam, `null` if unknown. */
  examDay: string | null;
  /** Monday day key. */
  weekStart: string;
  availability: Availability;
  topicMarks: Record<string, TopicStatus>;
  missedTopics: Array<{ topicId: string; count: number }>;
  /** Weekly target minutes per subject id (may be empty). */
  subjectTargets: Record<string, number>;
  /** Minutes already studied this week per subject id. */
  studiedThisWeekBySubject: Record<string, number>;
};

/** Blocks never get shorter than this. */
const MIN_BLOCK_MIN = 25;
/** …nor longer than this. */
const MAX_BLOCK_MIN = 60;
/** Days of a plan week, Monday first. */
const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Most minutes a day can hold (8 hours): the availability editor's and the stored value's limit. */
export const AVAILABILITY_MAX_MIN = 480;

/**
 * Default availability: a positive daily goal is used Monday–Saturday (Sunday off, a rest day),
 * capped at `AVAILABILITY_MAX_MIN` (a goal above 8 hours would make every day invalid to store).
 * Without a goal the week falls back to 2 hours on school days and 3 hours at the weekend.
 */
export function defaultAvailability(dailyGoalMin: number | null): Availability {
  if (dailyGoalMin !== null && Number.isFinite(dailyGoalMin) && dailyGoalMin > 0) {
    const goal = Math.min(AVAILABILITY_MAX_MIN, Math.round(dailyGoalMin));
    return { 0: goal, 1: goal, 2: goal, 3: goal, 4: goal, 5: goal, 6: 0 };
  }
  return { 0: 120, 1: 120, 2: 120, 3: 120, 4: 120, 5: 180, 6: 180 };
}

/** Phase from the days left to the exam: enough time to learn, then mixed, then review. */
export function phaseFor(daysLeft: number | null): PlanPhase {
  if (daysLeft === null || daysLeft > 180) return 'learn';
  if (daysLeft >= 60) return 'mixed';
  return 'review';
}

/** Kept as an accessor so the UI does not dig into the block shape. */
export function planReason(block: PlanBlock): PlanBlock['reason'] {
  return block.reason;
}

/** Monday-based weekday of a day key, without touching the clock. */
function weekdayOf(day: string): Weekday {
  return istanbulWeekday(day) as Weekday;
}

/** Whole days from `from` to `to` (negative once `to` is in the past). */
function daysBetween(from: string, to: string): number {
  return Math.round((dayStartMs(to) - dayStartMs(from)) / DAY_MS);
}

/**
 * Split a day's minutes into as few 25–60 minute blocks as possible, as evenly as possible, so a
 * day always adds up to its availability exactly (70 → 35 + 35, 130 → 44 + 43 + 43). Returns an
 * empty list below the minimum block length.
 */
function splitDay(totalMinutes: number): number[] {
  if (totalMinutes < MIN_BLOCK_MIN) return [];
  const count = Math.ceil(totalMinutes / MAX_BLOCK_MIN);
  const base = Math.floor(totalMinutes / count);
  const remainder = totalMinutes - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

interface TopicCandidate {
  topicId: string;
  reason: 'review' | 'missed' | 'next';
}

/**
 * Topics of one subject in the order the plan should pick them. Review-marked topics always come
 * first. In the learning phase the next unseen topic wins over a missed one; in the mixed and
 * review phases missed topics come before new ones. Topics are never repeated within a week.
 */
function topicCandidates(
  examType: ExamType,
  yksArea: YksArea | null,
  subjectId: string,
  topicMarks: Record<string, TopicStatus>,
  missedTopics: Array<{ topicId: string; count: number }>,
  phase: PlanPhase,
): TopicCandidate[] {
  const topics = topicsForSubject(examType, yksArea, subjectId).filter((t) => findTopic(t.id) !== undefined);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const taken = new Set<string>();

  const review = topics.filter((t) => topicMarks[t.id] === 'review');
  for (const t of review) taken.add(t.id);

  const missedIds = new Set<string>();
  const missed = [...missedTopics]
    .sort((a, b) => b.count - a.count || a.topicId.localeCompare(b.topicId))
    .filter((m) => {
      if (!byId.has(m.topicId) || taken.has(m.topicId) || missedIds.has(m.topicId)) return false;
      missedIds.add(m.topicId);
      return true;
    })
    .map((m) => byId.get(m.topicId)!);
  for (const t of missed) taken.add(t.id);

  const next = topics.filter((t) => topicMarks[t.id] !== 'done' && !taken.has(t.id));

  const withReview: TopicCandidate[] = review.map((t) => ({ topicId: t.id, reason: 'review' }));
  const withMissed: TopicCandidate[] = missed.map((t) => ({ topicId: t.id, reason: 'missed' }));
  const withNext: TopicCandidate[] = next.map((t) => ({ topicId: t.id, reason: 'next' }));
  return phase === 'learn'
    ? [...withReview, ...withNext, ...withMissed]
    : [...withReview, ...withMissed, ...withNext];
}

/**
 * Build one week. Subject weights are the question counts of the student's papers (a subject with
 * no test of its own, like Geometri, shares its questions with Matematik, as in the report card).
 * Question weights are scaled to the week's total minutes, so they are in the same unit as the
 * weekly subject targets and a target neither disappears nor swallows the whole plan. A subject
 * with a target replaces its question-based weight with that target.
 */
export function buildWeekPlan(input: BuildWeekPlanInput): WeekPlan {
  const { examType, yksArea, examDay, weekStart, availability, topicMarks, missedTopics } = input;
  const subjectTargets = input.subjectTargets;
  const studied = input.studiedThisWeekBySubject;

  const daysLeft = examDay === null ? null : daysBetween(weekStart, examDay);
  const phase = phaseFor(daysLeft);
  const examPassed = daysLeft !== null && daysLeft < 0;

  const subjects = subjectsFor(examType, yksArea);
  const kinds = examKindsFor(examType, yksArea);
  const weekMinutes = WEEKDAYS.reduce<number>(
    (sum, day) => sum + Math.max(0, Math.floor(availability[day] ?? 0)),
    0,
  );

  // A paper with no curriculum at all ("Diğer", or a profile without any topic list) can only be
  // planned as subject-only balance blocks.
  const hasCurriculum = kinds.length > 0 && subjects.some((id) => topicsForSubject(examType, yksArea, id).length > 0);
  const flat = examType === 'DIGER' || !hasCurriculum;
  const useTopics = !flat && !examPassed;

  const questionCount = new Map<string, number>();
  let questionTotal = 0;
  for (const id of subjects) {
    const questions = examSectionsForSubject(id, kinds).reduce((sum, section) => sum + section.questions, 0);
    questionCount.set(id, questions);
    questionTotal += questions;
  }
  // One question's worth of the week, in minutes: keeps question weights comparable to targets.
  const minutesPerQuestion = questionTotal > 0 ? weekMinutes / questionTotal : 0;

  const baseWeights = new Map<string, number>();
  let weightTotal = 0;
  for (const id of subjects) {
    const target = subjectTargets[id];
    const hasTarget = typeof target === 'number' && Number.isFinite(target) && target > 0;
    const weight = hasTarget ? target : (questionCount.get(id) ?? 0) * minutesPerQuestion;
    baseWeights.set(id, weight);
    weightTotal += weight;
  }

  let active: string[];
  if (weightTotal > 0) {
    active = subjects.filter((id) => (baseWeights.get(id) ?? 0) > 0);
  } else {
    // No paper and no target: fall back to an even split so every day still gets its blocks.
    for (const id of subjects) baseWeights.set(id, 1);
    active = [...subjects];
    weightTotal = active.length;
  }

  // What is still owed to each subject this week. Time already studied comes off its share; it can
  // reach zero but never goes negative, and a fully studied subject stops being picked first.
  const remaining = new Map<string, number>();
  for (const id of active) {
    const ideal = weightTotal > 0 ? (weekMinutes * (baseWeights.get(id) ?? 0)) / weightTotal : 0;
    const already = Math.max(0, studied[id] ?? 0);
    remaining.set(id, Math.max(0, ideal - already));
  }

  const pickSubject = (): string => {
    let best = active[0];
    let left = remaining.get(best) ?? 0;
    for (const id of active) {
      const value = remaining.get(id) ?? 0;
      if (value > left) {
        best = id;
        left = value;
      }
    }
    if (left <= 0) {
      // Every share is used up before the week ends: restart from the base proportions.
      for (const id of active) remaining.set(id, baseWeights.get(id) ?? 1);
      return pickSubject();
    }
    return best;
  };

  const candidates = new Map<string, TopicCandidate[]>();
  if (useTopics) {
    for (const id of active) {
      candidates.set(id, topicCandidates(examType, yksArea, id, topicMarks, missedTopics, phase));
    }
  }
  const cursors = new Map<string, number>();
  const takeTopic = (subjectId: string): TopicCandidate | null => {
    const list = candidates.get(subjectId) ?? [];
    const index = cursors.get(subjectId) ?? 0;
    if (index >= list.length) return null;
    cursors.set(subjectId, index + 1);
    return list[index];
  };

  const fallbackReason = (subjectId: string): PlanBlock['reason'] => {
    const target = subjectTargets[subjectId];
    return typeof target === 'number' && target > 0 ? 'target' : 'balance';
  };

  const blocks: PlanBlock[] = [];
  const saturdayMinutes = Math.max(0, Math.floor(availability[5] ?? 0));
  const hasExamDayBlock = phase === 'review' && !flat && !examPassed && saturdayMinutes >= MIN_BLOCK_MIN;
  const examDaySubject = subjects[0];

  for (const day of WEEKDAYS) {
    let dayMinutes = Math.max(0, Math.floor(availability[day] ?? 0));
    if (dayMinutes < MIN_BLOCK_MIN) continue;

    if (day === 5 && hasExamDayBlock) {
      let examMinutes = Math.min(MAX_BLOCK_MIN, dayMinutes);
      const rest = dayMinutes - examMinutes;
      if (rest > 0 && rest < MIN_BLOCK_MIN) {
        // Keep the day representable: hand the unusable remainder to the exam block.
        examMinutes = dayMinutes - MIN_BLOCK_MIN;
      }
      blocks.push({
        day,
        subjectId: examDaySubject,
        topicId: null,
        minutes: examMinutes,
        reason: 'exam-day',
      });
      remaining.set(examDaySubject, Math.max(0, (remaining.get(examDaySubject) ?? 0) - examMinutes));
      dayMinutes -= examMinutes;
    }

    for (const minutes of splitDay(dayMinutes)) {
      const subjectId = pickSubject();
      const topic = useTopics ? takeTopic(subjectId) : null;
      blocks.push({
        day,
        subjectId,
        topicId: topic?.topicId ?? null,
        minutes,
        reason: topic?.reason ?? (flat || examPassed ? 'balance' : fallbackReason(subjectId)),
      });
      remaining.set(subjectId, Math.max(0, (remaining.get(subjectId) ?? 0) - minutes));
    }
  }

  return {
    weekStart,
    phase,
    daysLeft,
    blocks,
    totalMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
  };
}

/**
 * The blocks of `today`'s weekday with a `done` flag: a block counts as done when the subject's
 * minutes on that day, up to and including it, fit in what was already studied today.
 */
export function todayBlocks(
  plan: WeekPlan,
  today: string,
  studiedTodayBySubject: Record<string, number>,
): Array<PlanBlock & { done: boolean }> {
  const day = weekdayOf(today);
  const cumulative = new Map<string, number>();
  const out: Array<PlanBlock & { done: boolean }> = [];
  for (const block of plan.blocks) {
    if (block.day !== day) continue;
    const used = (cumulative.get(block.subjectId) ?? 0) + block.minutes;
    cumulative.set(block.subjectId, used);
    out.push({ ...block, done: used <= (studiedTodayBySubject[block.subjectId] ?? 0) });
  }
  return out;
}
