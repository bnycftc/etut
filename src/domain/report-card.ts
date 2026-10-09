/**
 * Subject report card ("ders karnesi"): study time, topics and mock-exam nets of one subject on
 * one screen — the plan's "süre ve net tek akışta". Pure views over the student's own data; no
 * comparison with anyone.
 *
 * Timer subjects and exam sections are not the same list: AYT splits Tarih and Coğrafya into two
 * tests, "Felsefe Grubu" is the AYT test of Felsefe, and the geometry questions are inside the
 * Matematik test of every paper. `examSectionsForSubject` maps them.
 */

import type { Topic } from './curriculum';
import { type DayKey, addDays } from './istanbul-day';
import { dailyTotals, type SessionSpan } from './daily-totals';
import { type TopicMark, type TopicMiss, topMissedTopics } from './exam-analysis';
import { EXAM_SECTIONS, type ExamKind } from './net';
import type { TopicStatus } from './topics';

/** Weeks in the report card's trend chart. */
export const REPORT_TREND_WEEKS = 8;

/**
 * Timer subject a topic id belongs to: topic ids are `<paper>.<subjectId>.<slug>` (see
 * `curriculum/types.ts`), so this also works for a topic no longer in the student's lists.
 */
export function subjectOfTopic(topicId: string): string | null {
  const parts = topicId.split('.');
  return parts.length >= 3 && parts[1] !== '' ? parts[1] : null;
}

/** Timer subject whose time and topics an exam section's net belongs to. */
export function subjectOfSection(sectionId: string): string {
  switch (sectionId) {
    case 'tarih1':
    case 'tarih2':
      return 'tarih';
    case 'cografya1':
    case 'cografya2':
      return 'cografya';
    case 'felsefe_grubu':
      return 'felsefe';
    default:
      return sectionId;
  }
}

export interface SubjectSection {
  kind: ExamKind;
  sectionId: string;
  questions: number;
}

/**
 * Exam sections whose nets belong to `subjectId`, for the given papers in their order.
 * Geometri has no test of its own: its questions are in Matematik, so it gets the Matematik nets.
 */
export function examSectionsForSubject(subjectId: string, kinds: readonly ExamKind[]): SubjectSection[] {
  const target = subjectId === 'geometri' ? 'matematik' : subjectId;
  const out: SubjectSection[] = [];
  for (const kind of kinds) {
    for (const s of EXAM_SECTIONS[kind]) {
      if (subjectOfSection(s.id) === target) out.push({ kind, sectionId: s.id, questions: s.questions });
    }
  }
  return out;
}

export interface WeekTotal {
  weekStart: DayKey;
  ms: number;
}

/**
 * Study time of `subjectId` in each of the `weeks` weeks ending with the week of `thisWeekStart`,
 * oldest first. `spans` must cover those weeks.
 */
export function subjectWeekTrend(
  spans: SessionSpan[],
  subjectId: string,
  thisWeekStart: DayKey,
  weeks = REPORT_TREND_WEEKS,
): WeekTotal[] {
  const first = addDays(thisWeekStart, -7 * (weeks - 1));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
  const totals = dailyTotals(
    spans.filter((s) => s.subjectId === subjectId),
    days,
  );
  return Array.from({ length: weeks }, (_, w) => ({
    weekStart: days[w * 7],
    ms: totals.slice(w * 7, w * 7 + 7).reduce((sum, t) => sum + t.totalMs, 0),
  }));
}

export interface SubjectTopicSummary {
  total: number;
  done: Topic[];
  review: Topic[];
  /** Studied (time recorded) but not marked yet. */
  started: Topic[];
  /** No mark and no recorded time. */
  untouched: Topic[];
}

/** Topics of the subject by state, each list in curriculum order. */
export function subjectTopicSummary(
  topics: readonly Topic[],
  statuses: Readonly<Record<string, TopicStatus>>,
  topicMs: Readonly<Record<string, number>>,
): SubjectTopicSummary {
  const out: SubjectTopicSummary = { total: topics.length, done: [], review: [], started: [], untouched: [] };
  for (const t of topics) {
    const status = statuses[t.id];
    if (status === 'done') out.done.push(t);
    else if (status === 'review') out.review.push(t);
    else if ((topicMs[t.id] ?? 0) > 0) out.started.push(t);
    else out.untouched.push(t);
  }
  return out;
}

export interface SubjectMiss extends TopicMiss {
  /** Study time recorded on the topic (all time). */
  ms: number;
}

/** The subject's most-missed topics across all analysed exams, with the time spent on each. */
export function subjectMissedTopics(
  marks: readonly TopicMark[],
  subjectId: string,
  topicMs: Readonly<Record<string, number>>,
  limit = 5,
): SubjectMiss[] {
  return topMissedTopics(
    marks.filter((m) => subjectOfTopic(m.topicId) === subjectId),
    limit,
  ).map((m) => ({ ...m, ms: topicMs[m.topicId] ?? 0 }));
}
