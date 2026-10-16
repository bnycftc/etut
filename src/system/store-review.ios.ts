/**
 * The App Store rating dialog (expo-store-review → StoreKit `AppStore.requestReview`). Apple shows
 * it at most three times in 365 days and may show nothing; the rating goes from the student to
 * Apple, nothing reaches Etüt. In TestFlight builds it is not available (`isAvailable` is false).
 */

import * as StoreReview from 'expo-store-review';

import type { StoreReviewAdapter } from './types';

export const storeReview: StoreReviewAdapter = {
  isAvailable: () => StoreReview.isAvailableAsync(),
  request: () => StoreReview.requestReview(),
};
