/** Android and web: no Home Screen widget yet. The iOS version is `home-widget.ios.ts`. */

import type { HomeWidgetAdapter } from './types';

export const homeWidget: HomeWidgetAdapter = {
  supported: false,
  setTimeline: () => {},
};
