import { UNDO_FINISH_MS } from '../finish';
import { DAY_MS } from '../istanbul-day';
import type { Profile } from '../profile';
import {
  REVIEW_FINISH_WINDOW_MS,
  REVIEW_INTERVAL_DAYS,
  REVIEW_MIN_EXAMS,
  REVIEW_MIN_STREAK_DAYS,
  type ReviewCheck,
  shouldAskForReview,
} from '../review-prompt';

const ADULT: Profile = { birthYear: 2008, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 0 };
const UNDER_15: Profile = { birthYear: 2013, examType: 'LGS', yksArea: null, soloOnly: true, createdAt: 0 };
const NOW = Date.parse('2026-11-10T12:00:00Z');
/** A session finished with Bitir just now, keeping a streak of `streakDays`. */
const streak = (streakDays: number, finishedAt = NOW) => ({ kind: 'goal_streak', streakDays, finishedAt }) as const;

const check = (over: Partial<ReviewCheck>): ReviewCheck => ({
  profile: ADULT,
  foreground: true,
  sessionActive: false,
  moment: { kind: 'exam_saved', examCount: REVIEW_MIN_EXAMS },
  lastAskedAt: null,
  now: NOW,
  ...over,
});

describe('App Store rating prompt (X-7)', () => {
  it('uses the rules of the roadmap', () => {
    expect([REVIEW_MIN_EXAMS, REVIEW_MIN_STREAK_DAYS, REVIEW_INTERVAL_DAYS]).toEqual([3, 7, 120]);
    expect(REVIEW_FINISH_WINDOW_MS).toBe(UNDO_FINISH_MS + 30_000);
  });

  it('asks from the 3rd saved exam on', () => {
    expect(shouldAskForReview(check({ moment: { kind: 'exam_saved', examCount: 1 } }))).toBe(false);
    expect(shouldAskForReview(check({ moment: { kind: 'exam_saved', examCount: 2 } }))).toBe(false);
    expect(shouldAskForReview(check({ moment: { kind: 'exam_saved', examCount: 3 } }))).toBe(true);
    expect(shouldAskForReview(check({ moment: { kind: 'exam_saved', examCount: 12 } }))).toBe(true);
  });

  it('asks after a session that keeps a 7-day goal streak', () => {
    expect(shouldAskForReview(check({ moment: streak(0) }))).toBe(false);
    expect(shouldAskForReview(check({ moment: streak(6) }))).toBe(false);
    expect(shouldAskForReview(check({ moment: streak(7) }))).toBe(true);
    expect(shouldAskForReview(check({ moment: streak(30) }))).toBe(true);
  });

  it('a finished session only within 30 s after "Geri al" (its timer pauses while the phone is locked)', () => {
    expect(shouldAskForReview(check({ moment: streak(7, NOW - UNDO_FINISH_MS) }))).toBe(true);
    expect(shouldAskForReview(check({ moment: streak(7, NOW - REVIEW_FINISH_WINDOW_MS) }))).toBe(true);
    expect(shouldAskForReview(check({ moment: streak(7, NOW - REVIEW_FINISH_WINDOW_MS - 1) }))).toBe(false);
    // Locked within the undo window, opened again hours later.
    expect(shouldAskForReview(check({ moment: streak(7, NOW - 3 * 60 * 60_000) }))).toBe(false);
  });

  it('only while the app is on screen', () => {
    expect(shouldAskForReview(check({ foreground: false }))).toBe(false);
    expect(shouldAskForReview(check({ foreground: false, moment: streak(7) }))).toBe(false);
  });

  it('only for 15+ profiles (the study-card gate), never under 15 or without a profile', () => {
    expect(shouldAskForReview(check({ profile: UNDER_15 }))).toBe(false);
    expect(shouldAskForReview(check({ profile: UNDER_15, moment: streak(9) }))).toBe(false);
    expect(shouldAskForReview(check({ profile: null }))).toBe(false);
  });

  it('never while a session is running or paused', () => {
    expect(shouldAskForReview(check({ sessionActive: true }))).toBe(false);
    expect(shouldAskForReview(check({ sessionActive: true, moment: streak(7) }))).toBe(false);
  });

  it('at most once in 120 days', () => {
    expect(shouldAskForReview(check({ lastAskedAt: NOW - DAY_MS }))).toBe(false);
    expect(shouldAskForReview(check({ lastAskedAt: NOW - 119 * DAY_MS }))).toBe(false);
    expect(shouldAskForReview(check({ lastAskedAt: NOW - 120 * DAY_MS + 1 }))).toBe(false);
    expect(shouldAskForReview(check({ lastAskedAt: NOW - 120 * DAY_MS }))).toBe(true);
    expect(shouldAskForReview(check({ lastAskedAt: NOW - 400 * DAY_MS }))).toBe(true);
    // A clock set back after asking does not ask again.
    expect(shouldAskForReview(check({ lastAskedAt: NOW + DAY_MS }))).toBe(false);
  });
});
