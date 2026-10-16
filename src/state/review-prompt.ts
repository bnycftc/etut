/**
 * Asks Apple for the App Store rating dialog when domain/review-prompt.ts says the moment is
 * right. Glue only: no rules here. The time is recorded before asking, so a failure can never
 * lead to asking again before 120 days.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { Profile } from '../domain/profile';
import { type ReviewMoment, shouldAskForReview } from '../domain/review-prompt';
import { loadReviewAskedAt, storeReviewAskedAt } from '../storage/review-kv';
import { storeReview } from '../system/store-review';
import { useAppState } from './app-state';

/** `moment` is read inside the try: a failure while reading it (e.g. counting exams) stays silent too. */
export async function askForReviewIfDue(profile: Profile | null, sessionActive: boolean, moment: () => ReviewMoment) {
  try {
    const now = Date.now();
    const check = {
      profile,
      foreground: AppState.currentState === 'active',
      sessionActive,
      moment: moment(),
      lastAskedAt: loadReviewAskedAt(),
      now,
    };
    if (!shouldAskForReview(check)) return;
    if (!(await storeReview.isAvailable())) return;
    storeReviewAskedAt(now);
    await storeReview.request();
  } catch {
    // Optional: a failure must never reach the timer or the exam form.
  }
}

/**
 * Timer tab: `finished` is the session saved with Bitir (its id and when) once its "Geri al"
 * window has closed (`null` before that and after a new start), so the dialog never covers
 * "Geri al" and never comes while a session runs. `streakDays` is the streak when today's goal is
 * met, else 0.
 */
export function useReviewAfterFinish(finished: { id: string; at: number } | null, streakDays: number): void {
  const { profile, active } = useAppState();
  const finishedId = finished?.id ?? null;
  // Deliberately keyed on the finished session only: one check per Bitir, not on every later
  // change of the profile, the session or the streak (the values of this render are used).
  useEffect(() => {
    if (finished === null) return;
    const finishedAt = finished.at;
    void askForReviewIfDue(profile, active !== null, () => ({ kind: 'goal_streak', streakDays, finishedAt }));
  }, [finishedId]);
}
