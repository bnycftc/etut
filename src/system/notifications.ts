/** Web preview: no local notifications. The device version is `notifications.native.ts`. */

import type { NotificationsAdapter } from './types';

export const notifications: NotificationsAdapter = {
  supported: false,
  getPermission: async () => 'unsupported',
  requestPermission: async () => 'unsupported',
  sync: async () => {},
  cancelAll: async () => {},
  onOpen: () => () => {},
};
