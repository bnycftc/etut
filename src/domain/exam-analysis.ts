/**
 * Mock exam analysis ("deneme analizi"), in two steps: first the nets are saved, later the
 * student tags wrong and blank questions with curriculum topics ("analizi tamamla").
 * Also: per-section net trend, most-missed topics and per-section target nets.
 */

import type { SectionScore } from './net';

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
