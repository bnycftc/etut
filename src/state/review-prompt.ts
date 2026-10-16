/**
 * Asks Apple for the App Store rating dialog when domain/review-prompt.ts says the moment is
 * right. Glue only: no rules here. The time is recorded before asking, so a failure can never
 * lead to asking again before 120 days.
 */

import { useEffect } from 'react';

import type { Profile } from '../domain/profile';
import { type ReviewMoment, shouldAskForReview } from '../domain/review-prompt';
import { loadReviewAskedAt, storeReviewAskedAt } from '../storage/review-kv';
import { storeReview } from '../system/store-review';
import { useAppState } from './app-state';

export async function askForReviewIfDue(profile: Profile | null, sessionActive: boolean, moment: ReviewMoment) {
  try {
    const now = Date.now();
    if (!shouldAskForReview({ profile, sessionActive, moment, lastAskedAt: loadReviewAskedAt(), now })) return;
    if (!(await storeReview.isAvailable())) return;
    storeReviewAskedAt(now);
    await storeReview.request();
  } catch {
    // Optional: a failure must never reach the timer or the exam form.
  }
}

/**
 * Timer tab: `finishedId` is the session saved with Bitir once its "Geri al" window has closed
 * (`null` before that and after a new start), so the dialog never covers "Geri al" and never
 * comes while a session runs. `streakDays` is the streak when today's goal is met, else 0.
 */
export function useReviewAfterFinish(finishedId: string | null, streakDays: number): void {
  const { profile, active } = useAppState();
  useEffect(() => {
    if (finishedId === null) return;
    void askForReviewIfDue(profile, active !== null, { kind: 'goal_streak', streakDays });
  }, [finishedId]);
}
