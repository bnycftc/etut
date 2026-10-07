/**
 * The local notification adapter against an in-memory stand-in for the system scheduler
 * (expo-notifications): what is really scheduled must end up equal to the plan, without
 * scheduling anything twice and without touching notifications of other origins. Also the
 * permission prompt (asked once, never for badges) and opening a tapped notification's route.
 */

import { Platform } from 'react-native';

import type { PlannedNotification } from '../../domain/reminders';
// jest.mock below is hoisted above this import.
import { notifications } from '../notifications.native';
import type { NotificationText } from '../types';

interface MockRequest {
  identifier: string;
  content: { title: string; body: string; data: Record<string, unknown> };
  trigger: { type: string; date: number; channelId?: string };
}

type MockPermission = 'granted' | 'denied' | 'undetermined' | 'provisional';

const mockOs: {
  permission: MockPermission;
  /** What the system prompt answers (it is only shown while undetermined). */
  answer: MockPermission;
  requests: unknown[];
  failGet: boolean;
  failRequest: boolean;
  channels: { id: string; options: Record<string, unknown> }[];
  /** Listeners for notification taps, and how many were removed. */
  tapListeners: ((response: unknown) => void)[];
  removed: number;
  scheduled: MockRequest[];
  schedules: number;
  cancels: number;
} = {
  permission: 'granted',
  answer: 'granted',
  requests: [],
  failGet: false,
  failRequest: false,
  channels: [],
  tapListeners: [],
  removed: 0,
  scheduled: [],
  schedules: 0,
  cancels: 0,
};

/** expo-notifications' NotificationPermissionsStatus for a state. */
function mockStatus(p: MockPermission) {
  switch (p) {
    case 'granted':
      return { granted: true, status: 'granted', canAskAgain: true };
    case 'denied':
      return { granted: false, status: 'denied', canAskAgain: false };
    case 'undetermined':
      return { granted: false, status: 'undetermined', canAskAgain: true };
    case 'provisional':
      return { granted: false, status: 'undetermined', canAskAgain: true, ios: { status: 3 } };
  }
}

jest.mock('expo-notifications', () => ({
  setNotificationHandler: () => {},
  IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getPermissionsAsync: async () => {
    if (mockOs.failGet) throw new Error('no native module');
    return mockStatus(mockOs.permission);
  },
  requestPermissionsAsync: async (options: unknown) => {
    mockOs.requests.push(options);
    if (mockOs.failRequest) throw new Error('prompt failed');
    mockOs.permission = mockOs.answer;
    return mockStatus(mockOs.permission);
  },
  setNotificationChannelAsync: async (id: string, options: Record<string, unknown>) => {
    mockOs.channels.push({ id, options });
    return null;
  },
  getAllScheduledNotificationsAsync: async () => mockOs.scheduled.map((r) => ({ ...r })),
  // Like iOS: the same identifier replaces the earlier request.
  scheduleNotificationAsync: async (request: MockRequest) => {
    mockOs.schedules += 1;
    mockOs.scheduled = [...mockOs.scheduled.filter((r) => r.identifier !== request.identifier), request];
    return request.identifier;
  },
  cancelScheduledNotificationAsync: async (id: string) => {
    mockOs.cancels += 1;
    mockOs.scheduled = mockOs.scheduled.filter((r) => r.identifier !== id);
  },
  dismissAllNotificationsAsync: async () => {},
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => {
    mockOs.tapListeners.push(listener);
    return {
      remove: () => {
        mockOs.removed += 1;
        mockOs.tapListeners = mockOs.tapListeners.filter((l) => l !== listener);
      },
    };
  },
}));

const MIN = 60_000;
const text = (n: PlannedNotification): NotificationText => ({ title: n.kind, body: n.id, url: '/' });
const daily = (id: string, at: number): PlannedNotification => ({ id: `etut:daily:${id}`, at, kind: 'daily' });
const foreign: MockRequest = {
  identifier: 'another-origin',
  content: { title: 'x', body: 'x', data: {} },
  trigger: { type: 'date', date: Date.now() + 60 * MIN },
};
const ours = () =>
  mockOs.scheduled
    .filter((r) => r.identifier.startsWith('etut:'))
    .map((r) => [r.identifier, r.trigger.date])
    .sort();

beforeEach(() => {
  mockOs.permission = 'granted';
  mockOs.answer = 'granted';
  mockOs.requests = [];
  mockOs.failGet = false;
  mockOs.failRequest = false;
  mockOs.tapListeners = [];
  mockOs.removed = 0;
  mockOs.scheduled = [foreign];
  mockOs.schedules = 0;
  mockOs.cancels = 0;
});

it('schedules the plan once; the same plan again does nothing', async () => {
  const now = Date.now();
  const plan = [daily('a', now + 10 * MIN), daily('b', now + 20 * MIN)];
  await notifications.sync(plan, text);
  expect(ours()).toEqual([
    ['etut:daily:a', now + 10 * MIN],
    ['etut:daily:b', now + 20 * MIN],
  ]);
  expect(mockOs.schedules).toBe(2);
  await notifications.sync(plan, text);
  expect(mockOs.schedules).toBe(2);
  expect(mockOs.cancels).toBe(0);
});

it('a changed one is replaced, a dropped one cancelled, another origin left alone', async () => {
  const now = Date.now();
  await notifications.sync([daily('a', now + 10 * MIN), daily('b', now + 20 * MIN)], text);
  await notifications.sync([daily('a', now + 15 * MIN)], text);
  expect(ours()).toEqual([['etut:daily:a', now + 15 * MIN]]);
  expect(mockOs.scheduled.map((r) => r.identifier)).toContain('another-origin');
});

it('skips a notification due within two seconds (it would fire at once)', async () => {
  const now = Date.now();
  await notifications.sync([daily('soon', now + 500), daily('later', now + 10 * MIN)], text);
  expect(ours()).toEqual([['etut:daily:later', now + 10 * MIN]]);
});

it('without the permission ours are cancelled and nothing is scheduled', async () => {
  const now = Date.now();
  await notifications.sync([daily('a', now + 10 * MIN)], text);
  mockOs.permission = 'denied';
  await notifications.sync([daily('a', now + 10 * MIN), daily('b', now + 20 * MIN)], text);
  expect(ours()).toEqual([]);
  expect(mockOs.scheduled.map((r) => r.identifier)).toEqual(['another-origin']);
});

it('several syncs in a row end with the last plan', async () => {
  const now = Date.now();
  await Promise.all([
    notifications.sync([daily('1', now + 10 * MIN)], text),
    notifications.sync([daily('2', now + 20 * MIN)], text),
    notifications.sync([daily('3', now + 30 * MIN)], text),
  ]);
  expect(ours()).toEqual([['etut:daily:3', now + 30 * MIN]]);
});

it('cancelAll removes only ours', async () => {
  await notifications.sync([daily('a', Date.now() + 10 * MIN)], text);
  await notifications.cancelAll();
  expect(mockOs.scheduled.map((r) => r.identifier)).toEqual(['another-origin']);
});

describe('requestPermission', () => {
  it('undetermined: shows the system prompt once, for alerts and sounds, no badge', async () => {
    mockOs.permission = 'undetermined';
    expect(await notifications.getPermission()).toBe('undetermined');
    expect(await notifications.requestPermission()).toBe('granted');
    expect(mockOs.requests).toEqual([{ ios: { allowAlert: true, allowSound: true, allowBadge: false } }]);
    // Answered: asking again only reads the answer.
    expect(await notifications.requestPermission()).toBe('granted');
    expect(mockOs.requests).toHaveLength(1);
  });

  it('a refusal in the prompt is reported as denied', async () => {
    mockOs.permission = 'undetermined';
    mockOs.answer = 'denied';
    expect(await notifications.requestPermission()).toBe('denied');
  });

  it('already granted or denied: no prompt at all', async () => {
    expect(await notifications.requestPermission()).toBe('granted');
    mockOs.permission = 'denied';
    expect(await notifications.requestPermission()).toBe('denied');
    expect(mockOs.requests).toEqual([]);
  });

  it('iOS provisional (quiet) authorisation counts as granted', async () => {
    mockOs.permission = 'provisional';
    expect(await notifications.getPermission()).toBe('granted');
    expect(await notifications.requestPermission()).toBe('granted');
    expect(mockOs.requests).toEqual([]);
  });

  it('a failing native module or prompt is "unsupported", never a crash', async () => {
    mockOs.failGet = true;
    expect(await notifications.getPermission()).toBe('unsupported');
    expect(await notifications.requestPermission()).toBe('unsupported');
    mockOs.failGet = false;
    mockOs.permission = 'undetermined';
    mockOs.failRequest = true;
    expect(await notifications.requestPermission()).toBe('unsupported');
  });

  it('a failing permission check cancels ours instead of scheduling', async () => {
    const now = Date.now();
    await notifications.sync([daily('a', now + 10 * MIN)], text);
    mockOs.failGet = true;
    await notifications.sync([daily('a', now + 10 * MIN)], text);
    expect(ours()).toEqual([]);
  });

  it('iOS: no channel, no channelId', async () => {
    mockOs.channels = [];
    await notifications.sync([daily('b', Date.now() + 10 * MIN)], text);
    expect(mockOs.channels).toEqual([]);
    expect(mockOs.scheduled.find((r) => r.identifier === 'etut:daily:b')?.trigger.channelId).toBeUndefined();
  });

  it('Android: the channel exists before the prompt and every notification uses it', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      mockOs.channels = [];
      mockOs.permission = 'undetermined';
      expect(await notifications.requestPermission()).toBe('granted');
      expect(mockOs.channels).toEqual([{ id: 'hatirlatici', options: { name: expect.any(String), importance: 3 } }]);
      const now = Date.now();
      await notifications.sync([daily('a', now + 10 * MIN)], text);
      // Created once per process.
      expect(mockOs.channels).toHaveLength(1);
      const request = mockOs.scheduled.find((r) => r.identifier === 'etut:daily:a');
      expect(request?.trigger).toMatchObject({ type: 'date', date: now + 10 * MIN, channelId: 'hatirlatici' });
    } finally {
      os.restore();
    }
  });
});

describe('onOpen', () => {
  const DEFAULT = 'expo.modules.notifications.actions.DEFAULT';
  const tap = (actionIdentifier: string, data: Record<string, unknown>) => {
    for (const listener of mockOs.tapListeners) {
      listener({ actionIdentifier, notification: { request: { content: { data } } } });
    }
  };

  it('a tap on the notification opens its route; after unsubscribing nothing does', () => {
    const opened: string[] = [];
    const unsubscribe = notifications.onOpen((url) => opened.push(url));
    tap(DEFAULT, { url: '/denemeler', sig: 'x' });
    expect(opened).toEqual(['/denemeler']);
    unsubscribe();
    expect(mockOs.removed).toBe(1);
    tap(DEFAULT, { url: '/' });
    expect(opened).toEqual(['/denemeler']);
  });

  it('another action or a notification without a route opens nothing', () => {
    const opened: string[] = [];
    notifications.onOpen((url) => opened.push(url));
    tap('expo.modules.notifications.actions.DISMISS', { url: '/' });
    tap(DEFAULT, {});
    tap(DEFAULT, { url: 42 });
    expect(opened).toEqual([]);
  });

  it('what is scheduled carries the route that the tap opens', async () => {
    await notifications.sync([daily('r', Date.now() + 10 * MIN)], (n) => ({ title: 't', body: 'b', url: `/r-${n.kind}` }));
    const request = mockOs.scheduled.find((r) => r.identifier === 'etut:daily:r');
    expect(request?.content.data).toMatchObject({ url: '/r-daily' });
    const opened: string[] = [];
    notifications.onOpen((url) => opened.push(url));
    tap(DEFAULT, request!.content.data);
    expect(opened).toEqual(['/r-daily']);
  });
});
