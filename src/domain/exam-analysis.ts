/**
 * Mock exam analysis ("deneme analizi"), in two steps: first the nets are saved, later the
 * student tags wrong and blank questions with curriculum topics ("analizi tamamla").
 * Also: per-section net trend, most-missed topics and per-section target nets.
 */

import { topicsForSubject } from './curriculum';
import type { ExamKind, SectionScore, YksArea } from './net';
import type { ExamType } from './profile';
import { subjectsFor } from './subjects';

/** Wrong/blank questions of one section attributed to one topic. */
export interface TopicMark {
  sectionId: string;
  topicId: string;
  wrong: number;
  blank: number;
}

export type MarkError = 'not_integer' | 'negative' | 'too_many_wrong' | 'too_many_blank';

export function blankCount(score: SectionScore): number {
  return Math.max(0, score.questions - score.correct - score.wrong);
}

/** A section has something to analyse when at least one question was wrong or left blank. */
export function sectionNeedsAnalysis(score: SectionScore): boolean {
  return score.wrong + blankCount(score) > 0;
}

export function examNeedsAnalysis(scores: readonly SectionScore[]): boolean {
  return scores.some(sectionNeedsAnalysis);
}

/**
 * Tagged counts may not exceed the section's wrong/blank counts. Tagging fewer is fine
 * (not every question has to be attributed).
 */
export function validateSectionMarks(
  score: SectionScore,
  marks: readonly TopicMark[],
): MarkError | null {
  let wrong = 0;
  let blank = 0;
  for (const m of marks) {
    if (m.sectionId !== score.sectionId) continue;
    if (!Number.isInteger(m.wrong) || !Number.isInteger(m.blank)) return 'not_integer';
    if (m.wrong < 0 || m.blank < 0) return 'negative';
    wrong += m.wrong;
    blank += m.blank;
  }
  if (wrong > score.wrong) return 'too_many_wrong';
  if (blank > blankCount(score)) return 'too_many_blank';
  return null;
}

export interface TopicMiss {
  topicId: string;
  wrong: number;
  blank: number;
}

/** Topics with the most wrong answers across all exams (blank breaks ties), largest first. */
export function topMissedTopics(marks: readonly TopicMark[], limit = 5): TopicMiss[] {
  const byTopic = new Map<string, TopicMiss>();
  for (const m of marks) {
    const t = byTopic.get(m.topicId) ?? { topicId: m.topicId, wrong: 0, blank: 0 };
    t.wrong += m.wrong;
    t.blank += m.blank;
    byTopic.set(m.topicId, t);
  }
  return [...byTopic.values()]
    .filter((t) => t.wrong + t.blank > 0)
    .sort((a, b) => b.wrong - a.wrong || b.blank - a.blank || a.topicId.localeCompare(b.topicId))
    .slice(0, limit);
}

/** How many recent nets the "hedefe uzaklık" average uses. */
export const TARGET_WINDOW = 3;

export interface TargetProgress {
  /** Average of the most recent nets (up to `TARGET_WINDOW`). */
  recentAverage: number;
  /** target − recentAverage; ≤ 0 means the target is reached. */
  gap: number;
  reached: boolean;
}

/** `nets` newest first. `null` without any net. */
export function targetProgress(target: number, nets: readonly number[]): TargetProgress | null {
  const recent = nets.slice(0, TARGET_WINDOW);
  if (recent.length === 0) return null;
  const recentAverage = Math.round((recent.reduce((s, n) => s + n, 0) / recent.length) * 100) / 100;
  const gap = Math.round((target - recentAverage) * 100) / 100;
  return { recentAverage, gap, reached: gap <= 0 };
}

/**
 * Target net text ("32,5" or "32.5") → number. Nets are multiples of 0.25 between 0 and the
 * section's question count; anything else is `null`.
 */
export function parseTargetNet(text: string, questions: number): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const value = Number(t);
  if (value <= 0 || value > questions) return null;
  if (Math.round(value * 4) !== value * 4) return null;
  return value;
}

/** Key of a target net: the same section id means different things in TYT and AYT. */
export function targetKey(kind: string, sectionId: string): string {
  return `${kind}:${sectionId}`;
}

// ---------------------------------------------------------------------------------------------
// Editing a saved exam

export interface ExamAnalysisState {
  kind: ExamKind;
  scores: readonly SectionScore[];
  marks: readonly TopicMark[];
  analysisDoneAt: number | null;
}

/**
 * Topic marks and analysis state after the student corrected a saved exam (same exam id, so the
 * analysis stays with it). A section keeps its marks while they still fit its new wrong/blank
 * counts; otherwise that section's marks go. A different paper drops every mark (its topics belong
 * to another curriculum). The analysis turns pending again when marks were dropped, or when an exam
 * that had nothing to analyse now has wrong or blank questions; it is done when nothing is left
 * to analyse.
 */
export function analysisAfterEdit(
  before: ExamAnalysisState,
  kind: ExamKind,
  scores: readonly SectionScore[],
  now: number,
): { marks: TopicMark[]; analysisDoneAt: number | null } {
  const sameKind = kind === before.kind;
  const marks = sameKind
    ? before.marks.filter((m) => {
        const score = scores.find((s) => s.sectionId === m.sectionId);
        return score !== undefined && validateSectionMarks(score, before.marks) === null;
      })
    : [];
  if (!examNeedsAnalysis(scores)) return { marks, analysisDoneAt: before.analysisDoneAt ?? now };
  const dropped = marks.length < before.marks.length;
  const neverAnalysed = !examNeedsAnalysis(before.scores);
  const pending = before.analysisDoneAt === null || dropped || neverAnalysed || !sameKind;
  return { marks, analysisDoneAt: pending ? null : before.analysisDoneAt };
}

// ---------------------------------------------------------------------------------------------
// Net charts

export interface NetTrend {
  last: number;
  /** last − previous; `null` with a single net. */
  change: number | null;
}

/** `nets` oldest first. `null` without any net. */
export function netTrend(nets: readonly number[]): NetTrend | null {
  if (nets.length === 0) return null;
  const last = nets[nets.length - 1];
  const change = nets.length < 2 ? null : Math.round((last - nets[nets.length - 2]) * 100) / 100;
  return { last, change };
}

const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

/** Smallest "round" number ≥ `value` (5, 10, 20, 25, 50…), never above `limit`. */
function niceCeil(value: number, limit: number): number {
  const nice = NICE_STEPS.map((s) => Math.ceil(value / s) * s).find((n, i) => n / NICE_STEPS[i] <= 5);
  return Math.min(limit, nice ?? Math.ceil(value));
}

/**
 * Vertical range of a net chart: from 0 (or below, for a negative net) to a round number a little
 * above the largest net or target, at most the paper's question count. One exam therefore shows
 * as a point in the upper part of the chart, not as a bar filling it.
 */
export function chartScale(
  values: readonly number[],
  target: number | null,
  questions: number,
): { min: number; max: number } {
  const top = Math.max(0, target ?? 0, ...values);
  const max = top <= 0 ? Math.min(5, questions) : niceCeil(top * 1.15, questions);
  const low = Math.min(0, ...values);
  const min = low < 0 ? -niceCeil(-low, questions) : 0;
  return { min, max: Math.max(max, min + 1) };
}

// ---------------------------------------------------------------------------------------------
// From a missed topic to studying it

/**
 * The timer subject (of this student's list) whose topics contain `topicId`, so that "Çalış" on a
 * most-missed topic starts the timer on it. `null` when the topic is not in the student's current
 * lists (e.g. an AYT topic after switching to another area): then no start is offered.
 */
export function studyTargetForTopic(
  examType: ExamType,
  yksArea: YksArea | null,
  topicId: string,
): { subjectId: string; topicId: string } | null {
  for (const subjectId of subjectsFor(examType, yksArea)) {
    if (topicsForSubject(examType, yksArea, subjectId).some((t) => t.id === topicId)) {
      return { subjectId, topicId };
    }
  }
  return null;
}
