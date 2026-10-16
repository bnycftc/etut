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
  trigger: { type: string; date?: number; weekday?: number; hour?: number; minute?: number; channelId?: string };
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
  /** The tap the system keeps (`getLastNotificationResponse`), and how often it was cleared. */
  lastResponse: unknown;
  clears: number;
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
  lastResponse: null,
  clears: 0,
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
  setNotificationHandler: jest.fn(),
  IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
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
  getLastNotificationResponse: () => mockOs.lastResponse,
  clearLastNotificationResponse: () => {
    mockOs.clears += 1;
    mockOs.lastResponse = null;
  },
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
  mockOs.lastResponse = null;
  mockOs.clears = 0;
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

it('a repeating daily reminder becomes a weekly trigger on the phone clock, kept while single ones come and go', async () => {
  // Tuesday 1 January 2030, 20:30 on this computer's clock.
  const at = new Date(2030, 0, 1, 20, 30).getTime();
  const weekly: PlannedNotification = { id: 'etut:daily:weekly:1', at, kind: 'daily', repeats: 'weekly' };
  await notifications.sync([weekly], text);
  const trigger = () => mockOs.scheduled.find((r) => r.identifier === weekly.id)?.trigger;
  expect(trigger()).toEqual({ type: 'weekly', weekday: 3, hour: 20, minute: 30 });
  const now = Date.now();
  await notifications.sync([weekly, daily('a', now + 10 * MIN)], text);
  await notifications.sync([weekly], text);
  expect(mockOs.schedules).toBe(2);
  expect(trigger()).toEqual({ type: 'weekly', weekday: 3, hour: 20, minute: 30 });
});

it('a repeating one due within two seconds is still scheduled (its later deliveries count)', async () => {
  const soon: PlannedNotification = { id: 'etut:daily:weekly:2', at: Date.now() + 500, kind: 'daily', repeats: 'weekly' };
  await notifications.sync([soon], text);
  expect(mockOs.scheduled.find((r) => r.identifier === soon.id)?.trigger.type).toBe('weekly');
});

it('cancelAll removes only ours', async () => {
  await notifications.sync([daily('a', Date.now() + 10 * MIN)], text);
  await notifications.cancelAll();
  expect(mockOs.scheduled.map((r) => r.identifier)).toEqual(['another-origin']);
});

describe('while the app is open', () => {
  const handler = () =>
    (jest.requireMock('expo-notifications').setNotificationHandler as jest.Mock).mock.calls[0][0] as {
      handleNotification: (n: unknown) => Promise<Record<string, boolean>>;
    };
  const delivered = (identifier: string) => ({ request: { identifier, content: { data: {} } }, date: Date.now() });

  it('only the long-session warning is presented (a forgotten timer stays open on screen)', async () => {
    expect(await handler().handleNotification(delivered('etut:long:s1:1700000000000'))).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    for (const id of ['etut:pomodoro:s1:1', 'etut:daily:weekly:3', 'etut:exam:2026-10-05', 'another-origin']) {
      expect(await handler().handleNotification(delivered(id))).toEqual({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      });
    }
  });
});

it('a new time zone or DST offset moves the weekly reminders at the next sync, once', async () => {
  // The phone clock as a fixed offset from UTC (Jest cannot switch the process time zone).
  let offsetHours = 3;
  const local = (d: Date) => new Date(d.getTime() + offsetHours * 3_600_000);
  const spies = [
    jest.spyOn(Date.prototype, 'getDay').mockImplementation(function (this: Date) {
      return local(this).getUTCDay();
    }),
    jest.spyOn(Date.prototype, 'getHours').mockImplementation(function (this: Date) {
      return local(this).getUTCHours();
    }),
    jest.spyOn(Date.prototype, 'getMinutes').mockImplementation(function (this: Date) {
      return local(this).getUTCMinutes();
    }),
  ];
  try {
    // Tuesday 1 January 2030, 20:00 Istanbul.
    const at = Date.parse('2030-01-01T17:00:00Z');
    const weekly: PlannedNotification = { id: 'etut:daily:weekly:2', at, kind: 'daily', repeats: 'weekly' };
    const trigger = () => mockOs.scheduled.find((r) => r.identifier === weekly.id)?.trigger;
    await notifications.sync([weekly], text);
    expect(trigger()).toMatchObject({ weekday: 3, hour: 20, minute: 0 });
    // The phone is set to Germany (UTC+1 in winter): 20:00 in Istanbul is 18:00 there.
    offsetHours = 1;
    await notifications.sync([weekly], text);
    expect(trigger()).toMatchObject({ weekday: 3, hour: 18, minute: 0 });
    expect(mockOs.schedules).toBe(2);
    await notifications.sync([weekly], text);
    expect(mockOs.schedules).toBe(2);
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
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
  let delivered = 0;
  /** A tap on a delivered notification, as expo-notifications reports it. */
  const response = (actionIdentifier: string, data: Record<string, unknown>) => ({
    actionIdentifier,
    notification: { date: (delivered += 1), request: { identifier: 'etut:exam:2026-10-05', content: { data } } },
  });
  const tap = (actionIdentifier: string, data: Record<string, unknown>) => {
    const r = response(actionIdentifier, data);
    mockOs.lastResponse = r;
    for (const listener of mockOs.tapListeners) listener(r);
  };

  it('a tap that launched the app (before anyone listened) opens its route once, and is cleared', () => {
    const launch = response(DEFAULT, { url: '/denemeler' });
    mockOs.lastResponse = launch;
    const opened: string[] = [];
    notifications.onOpen((url) => opened.push(url));
    expect(opened).toEqual(['/denemeler']);
    expect(mockOs.clears).toBe(1);
    // The event may still arrive after the listener was added: the same tap is not opened twice.
    for (const listener of mockOs.tapListeners) listener(launch);
    expect(opened).toEqual(['/denemeler']);
    // Subscribing again (dev reload) does not replay it.
    notifications.onOpen((url) => opened.push(url));
    expect(opened).toEqual(['/denemeler']);
  });

  it('a tap while the app runs is cleared too, so it never comes back as a launch tap', () => {
    const opened: string[] = [];
    notifications.onOpen((url) => opened.push(url));
    tap(DEFAULT, { url: '/' });
    expect(opened).toEqual(['/']);
    expect(mockOs.lastResponse).toBeNull();
  });

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
