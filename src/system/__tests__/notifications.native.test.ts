/**
 * The local notification adapter against an in-memory stand-in for the system scheduler
 * (expo-notifications): what is really scheduled must end up equal to the plan, without
 * scheduling anything twice and without touching notifications of other origins.
 */

import type { PlannedNotification } from '../../domain/reminders';
// jest.mock below is hoisted above this import.
import { notifications } from '../notifications.native';
import type { NotificationText } from '../types';

interface MockRequest {
  identifier: string;
  content: { title: string; body: string; data: Record<string, unknown> };
  trigger: { type: string; date: number };
}

const mockOs: { permission: 'granted' | 'denied'; scheduled: MockRequest[]; schedules: number; cancels: number } = {
  permission: 'granted',
  scheduled: [],
  schedules: 0,
  cancels: 0,
};

jest.mock('expo-notifications', () => ({
  setNotificationHandler: () => {},
  IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getPermissionsAsync: async () =>
    mockOs.permission === 'granted'
      ? { granted: true, status: 'granted', canAskAgain: true }
      : { granted: false, status: 'denied', canAskAgain: false },
  setNotificationChannelAsync: async () => null,
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
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
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
