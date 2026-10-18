/**
 * The moment after "Bitir": what the short summary shows and how long an accidental finish can
 * be taken back.
 *
 * "Geri al" restores the session exactly as it was (running or paused) and removes the saved
 * record, as if Bitir had never been pressed. The few seconds in between count like any other
 * second of the session; the window is shorter than the 10 s background tolerance, so it can
 * never be used to turn a break into study time.
 *
 * A session with a topic also offers "Bitti" / "Tekrar lazım" in the summary. "Geri al" takes a
 * mark set there back too (`topicMarkToRestore`).
 */

import { goalRatio } from './streak';
import type { TimedTopicStatus, TopicStatus } from './topics';

/** "Geri al" is offered for this long after Bitir. */
export const UNDO_FINISH_MS = 8_000;

export function canUndoFinish(finishedAt: number, now: number): boolean {
  return now >= finishedAt && now - finishedAt <= UNDO_FINISH_MS;
}

/**
 * What "Geri al" writes for a topic marked in the summary: the mark it had before the first tap,
 * with its own time, or no mark when it had none. The topic is left as if Bitir never happened.
 */
export function topicMarkToRestore(
  before: TimedTopicStatus | null,
  now: number,
): { status: TopicStatus | null; at: number } {
  return before === null ? { status: null, at: now } : { status: before.status, at: before.updatedAt };
}

export interface GoalStep {
  /** Whole percent of the daily goal before and after the session (0…100). */
  beforePercent: number;
  afterPercent: number;
  /** This session took today over the goal. */
  reached: boolean;
}

/**
 * Goal progress the session added. `todayAfterMs` is today's total including the session,
 * `sessionTodayMs` the part of the session counted today (0 for one that started yesterday).
 */
export function goalStep(todayAfterMs: number, sessionTodayMs: number, goalMinutes: number): GoalStep {
  const beforeMs = Math.max(0, todayAfterMs - sessionTodayMs);
  const before = goalRatio(beforeMs, goalMinutes);
  const after = goalRatio(todayAfterMs, goalMinutes);
  return {
    beforePercent: Math.floor(before * 100),
    afterPercent: Math.floor(after * 100),
    reached: before < 1 && after >= 1,
  };
}
