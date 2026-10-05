/**
 * Local notifications on iOS and Android (expo-notifications). Only scheduled, on-device
 * notifications: no push token is ever requested and nothing leaves the device (hukuk/03 K-16).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  diffNotifications,
  NOTIFICATION_ID_PREFIX,
  notificationSignature,
  type PlannedNotification,
} from '../domain/reminders';
import { tr } from '../strings';
import type { NotificationPermission, NotificationsAdapter, NotificationText } from './types';

const ANDROID_CHANNEL = 'hatirlatici';
/** A notification due sooner than this is not scheduled any more (it would fire at once). */
const MIN_LEAD_MS = 2_000;

// While the app is open it shows its own UI (pomodoro: vibration), so nothing is presented.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function toPermission(status: Notifications.NotificationPermissionsStatus): NotificationPermission {
  const ios = status.ios?.status;
  if (
    status.granted ||
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  if (String(status.status) === 'denied' || !status.canAskAgain) return 'denied';
  return 'undetermined';
}

let channelReady: Promise<void> | null = null;

/** Android 8+ needs a channel; on Android 13+ the permission prompt needs one too. */
function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: tr.notification.channel,
    importance: Notifications.AndroidImportance.DEFAULT,
  }).then(
    () => {},
    () => {
      channelReady = null;
    },
  );
  return channelReady;
}

async function getPermission(): Promise<NotificationPermission> {
  try {
    return toPermission(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

/** Runs jobs one at a time; a job queued while another runs replaces any older queued job. */
let queued: (() => Promise<void>) | null = null;
let draining: Promise<void> | null = null;

function enqueue(job: () => Promise<void>): Promise<void> {
  queued = job;
  draining ??= (async () => {
    while (queued !== null) {
      const next = queued;
      queued = null;
      try {
        await next();
      } catch {
        // Best effort: the next sync starts again from what is really scheduled.
      }
    }
    draining = null;
  })();
  return draining;
}

async function cancelOurs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    if (request.identifier.startsWith(NOTIFICATION_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}

async function syncNow(
  planned: PlannedNotification[],
  text: (n: PlannedNotification) => NotificationText,
): Promise<void> {
  if ((await getPermission()) !== 'granted') {
    await cancelOurs();
    return;
  }
  await ensureChannel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const { cancel, schedule } = diffNotifications(
    scheduled.map((r) => ({
      id: r.identifier,
      signature: typeof r.content.data?.sig === 'string' ? r.content.data.sig : null,
    })),
    planned,
  );
  for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
  for (const n of schedule) {
    if (n.at < Date.now() + MIN_LEAD_MS) continue;
    const t = text(n);
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: t.title, body: t.body, sound: true, data: { sig: notificationSignature(n), url: t.url } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: n.at,
          channelId: Platform.OS === 'android' ? ANDROID_CHANNEL : undefined,
        },
      });
    } catch {
      // One refused notification must not stop the others.
    }
  }
}

export const notifications: NotificationsAdapter = {
  supported: true,
  getPermission,
  async requestPermission() {
    const current = await getPermission();
    if (current !== 'undetermined') return current;
    try {
      await ensureChannel();
      return toPermission(
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        }),
      );
    } catch {
      return 'unsupported';
    }
  },
  sync: (planned, text) => enqueue(() => syncNow(planned, text)),
  cancelAll: () =>
    enqueue(async () => {
      await cancelOurs();
      await Notifications.dismissAllNotificationsAsync();
    }),
  onOpen(listener) {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && typeof url === 'string') {
        listener(url);
      }
    });
    return () => subscription.remove();
  },
};
