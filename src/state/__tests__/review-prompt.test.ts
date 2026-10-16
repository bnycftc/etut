/** Glue of the App Store rating dialog: the time is recorded before asking, failures stay silent. */

import { AppState, type AppStateStatus } from 'react-native';

import type { Profile } from '../../domain/profile';
import { askForReviewIfDue } from '../review-prompt';

const mockReview = {
  askedAt: null as number | null,
  available: true,
  requests: 0,
  failRead: false,
  failRequest: false,
};

jest.mock('../../storage/review-kv', () => ({
  loadReviewAskedAt: () => {
    if (mockReview.failRead) throw new Error('kv-store unavailable');
    return mockReview.askedAt;
  },
  storeReviewAskedAt: (ms: number) => {
    mockReview.askedAt = ms;
  },
}));

jest.mock('../../system/store-review', () => ({
  storeReview: {
    isAvailable: async () => mockReview.available,
    request: async () => {
      mockReview.requests += 1;
      if (mockReview.failRequest) throw new Error('ERR_STORE_REVIEW_FAILED');
    },
  },
}));

const ADULT: Profile = { birthYear: 2006, examType: 'YKS', yksArea: 'esit_agirlik', soloOnly: false, createdAt: 0 };
const UNDER_15: Profile = { birthYear: 2013, examType: 'LGS', yksArea: null, soloOnly: true, createdAt: 0 };
const THIRD_EXAM = () => ({ kind: 'exam_saved', examCount: 3 }) as const;
const NOW = Date.parse('2026-11-10T12:00:00Z');

const originalAppState = AppState.currentState;
const setAppState = (status: AppStateStatus) =>
  Object.defineProperty(AppState, 'currentState', { value: status, configurable: true, writable: true });

beforeEach(() => {
  Object.assign(mockReview, { askedAt: null, available: true, requests: 0, failRead: false, failRequest: false });
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  setAppState('active');
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(AppState, 'currentState', { value: originalAppState, configurable: true, writable: true });
});

it('records the time, then asks once; the next moment within 120 days asks nothing', async () => {
  await askForReviewIfDue(ADULT, false, THIRD_EXAM);
  expect(mockReview).toMatchObject({ askedAt: NOW, requests: 1 });
  await askForReviewIfDue(ADULT, false, () => ({ kind: 'exam_saved', examCount: 4 }));
  expect(mockReview.requests).toBe(1);
});

it('asks nothing for an under-15 profile, during a session or before the 3rd exam', async () => {
  await askForReviewIfDue(UNDER_15, false, THIRD_EXAM);
  await askForReviewIfDue(ADULT, true, THIRD_EXAM);
  await askForReviewIfDue(ADULT, false, () => ({ kind: 'exam_saved', examCount: 2 }));
  expect(mockReview).toMatchObject({ askedAt: null, requests: 0 });
});

it('asks nothing while the app is in the background or switching', async () => {
  setAppState('background');
  await askForReviewIfDue(ADULT, false, THIRD_EXAM);
  setAppState('inactive');
  await askForReviewIfDue(ADULT, false, THIRD_EXAM);
  expect(mockReview).toMatchObject({ askedAt: null, requests: 0 });
});

it('where the dialog is not available (web, TestFlight) nothing is recorded, so a later build can ask', async () => {
  mockReview.available = false;
  await askForReviewIfDue(ADULT, false, THIRD_EXAM);
  expect(mockReview).toMatchObject({ askedAt: null, requests: 0 });
});

it('a storage or StoreKit failure never throws and never leads to asking without a record', async () => {
  mockReview.failRead = true;
  await expect(askForReviewIfDue(ADULT, false, THIRD_EXAM)).resolves.toBeUndefined();
  expect(mockReview.requests).toBe(0);
  mockReview.failRead = false;
  // Counting the exams fails: silent too.
  const failingCount = () => {
    throw new Error('database closed');
  };
  await expect(askForReviewIfDue(ADULT, false, failingCount)).resolves.toBeUndefined();
  expect(mockReview).toMatchObject({ askedAt: null, requests: 0 });
  mockReview.failRequest = true;
  await expect(askForReviewIfDue(ADULT, false, THIRD_EXAM)).resolves.toBeUndefined();
  // Asked once and recorded: the failure does not make it ask again soon.
  expect(mockReview).toMatchObject({ askedAt: NOW, requests: 1 });
});
