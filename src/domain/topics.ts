/** Topic tracking ("konu takibi"): per-topic study time and "bitti / tekrar lazım" progress. */

import type { Topic } from './curriculum/types';

export type TopicStatus = 'done' | 'review';

export function isTopicStatus(value: unknown): value is TopicStatus {
  return value === 'done' || value === 'review';
}

/** A topic's stored mark with the time it was set. */
export interface TimedTopicStatus {
  status: TopicStatus;
  updatedAt: number;
}

export interface TopicProgress {
  total: number;
  done: number;
  review: number;
  /** Whole percent of topics marked done (0–100). */
  percent: number;
}

export function topicProgress(
  topics: readonly Topic[],
  statuses: Readonly<Record<string, TopicStatus>>,
): TopicProgress {
  let done = 0;
  let review = 0;
  for (const t of topics) {
    if (statuses[t.id] === 'done') done++;
    else if (statuses[t.id] === 'review') review++;
  }
  const total = topics.length;
  return { total, done, review, percent: total === 0 ? 0 : Math.floor((done * 100) / total) };
}

/** "Tekrar lazım" topics first; otherwise the curriculum order is kept. */
export function reviewFirst<T extends Topic>(
  topics: readonly T[],
  statuses: Readonly<Record<string, TopicStatus>>,
): T[] {
  return [
    ...topics.filter((t) => statuses[t.id] === 'review'),
    ...topics.filter((t) => statuses[t.id] !== 'review'),
  ];
}

/** Tapping the chip of the current status clears it; tapping another one sets that. */
export function toggleStatus(current: TopicStatus | undefined, tapped: TopicStatus): TopicStatus | null {
  return current === tapped ? null : tapped;
}
