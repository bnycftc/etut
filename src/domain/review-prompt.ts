/**
 * When Etüt asks for an App Store rating (roadmap X-7). The dialog is Apple's own (StoreKit): Etüt
 * adds no question, text or button of its own before or around it, and Apple alone decides whether
 * it really appears (at most three times in 365 days). Etüt asks only
 *
 * - on a 15+ profile: the same gate as the study card (`canShareCard`, K-16); under 15 never;
 * - right after a finished, calm moment: a saved mock exam once at least 3 are saved, or a finished
 *   session on a day that keeps a daily-goal streak of at least 7 days;
 * - never while a session is running or paused (a timer is never interrupted);
 * - at most once in 120 days, counted from the last time it asked.
 */

import { DAY_MS } from './istanbul-day';
import type { Profile } from './profile';
import { canShareCard } from './share-card';

export const REVIEW_MIN_EXAMS = 3;
export const REVIEW_MIN_STREAK_DAYS = 7;
export const REVIEW_INTERVAL_DAYS = 120;

export type ReviewMoment =
  /** A new mock exam was saved; `examCount` includes it. */
  | { kind: 'exam_saved'; examCount: number }
  /** A session was finished; `streakDays` is the streak when today's goal is met, else 0. */
  | { kind: 'goal_streak'; streakDays: number };

export interface ReviewCheck {
  profile: Profile | null;
  /** A session is running or paused. */
  sessionActive: boolean;
  moment: ReviewMoment;
  /** When Etüt last asked; `null` = never. */
  lastAskedAt: number | null;
  now: number;
}

export function shouldAskForReview(check: ReviewCheck): boolean {
  if (!canShareCard(check.profile) || check.sessionActive) return false;
  const { moment } = check;
  const reached =
    moment.kind === 'exam_saved'
      ? moment.examCount >= REVIEW_MIN_EXAMS
      : moment.streakDays >= REVIEW_MIN_STREAK_DAYS;
  if (!reached) return false;
  return check.lastAskedAt === null || check.now - check.lastAskedAt >= REVIEW_INTERVAL_DAYS * DAY_MS;
}
