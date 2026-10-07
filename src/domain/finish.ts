/**
 * The moment after "Bitir": what the short summary shows and how long an accidental finish can
 * be taken back.
 *
 * "Geri al" restores the session exactly as it was (running or paused) and removes the saved
 * record, as if Bitir had never been pressed. The few seconds in between count like any other
 * second of the session; the window is shorter than the 10 s background tolerance, so it can
 * never be used to turn a break into study time.
 */

import { goalRatio } from './streak';

/** "Geri al" is offered for this long after Bitir. */
export const UNDO_FINISH_MS = 8_000;

export function canUndoFinish(finishedAt: number, now: number): boolean {
  return now >= finishedAt && now - finishedAt <= UNDO_FINISH_MS;
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
 * `sessionTodayMs` the part of the session that fell on today (a session can cross midnight).
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
