/**
 * iOS Live Activity of the running timer (expo-widgets, local ActivityKit updates only:
 * `enablePushNotifications` is off, no push token is requested).
 */

import { createLiveActivity, type LiveActivity } from 'expo-widgets';

import { TimerActivity } from './ios/timer-activity';
import type { TimerActivityProps } from './surface-props';
import type { LiveActivityAdapter } from './types';

/** Storage key of the layout; must stay the same across app versions (running activities use it). */
const NAME = 'EtutTimer';

function createFactory() {
  try {
    return createLiveActivity<TimerActivityProps>(NAME, TimerActivity);
  } catch {
    return null;
  }
}

const factory = createFactory();

function instances(): LiveActivity<TimerActivityProps>[] {
  try {
    return factory?.getInstances() ?? [];
  } catch {
    return [];
  }
}

const staleDate = (staleAt: number | null) => (staleAt === null ? undefined : new Date(staleAt));

export const liveActivity: LiveActivityAdapter = {
  supported: factory !== null,
  count: () => instances().length,
  start(props, staleAt) {
    if (factory === null) return false;
    try {
      factory.start(props, undefined, staleDate(staleAt));
      return true;
    } catch {
      // Live Activities turned off in Settings, unsupported device, app not in the foreground.
      return false;
    }
  },
  async update(props, staleAt) {
    for (const instance of instances()) {
      try {
        await instance.update(props, staleDate(staleAt));
      } catch {
        // Ended meanwhile.
      }
    }
  },
  async endAll() {
    for (const instance of instances()) {
      try {
        await instance.end('immediate');
      } catch {
        // Already gone.
      }
    }
  },
};
