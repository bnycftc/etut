/** Android and web: no rating dialog. The iOS version is `store-review.ios.ts`. */

import type { StoreReviewAdapter } from './types';

export const storeReview: StoreReviewAdapter = {
  isAvailable: async () => false,
  request: async () => {},
};
