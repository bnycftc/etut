/** Android and web: no Live Activity. The iOS version is `live-activity.ios.ts`. */

import type { LiveActivityAdapter } from './types';

export const liveActivity: LiveActivityAdapter = {
  supported: false,
  count: () => 0,
  start: () => false,
  update: async () => {},
  endAll: async () => {},
};
