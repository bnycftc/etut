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

/** "Hâlâ çalışıyor musun?" (`planNotifications`, kind `long_session`). */
const LONG_SESSION_ID_PREFIX = `${NOTIFICATION_ID_PREFIX}long:`;

/**
 * While the app is open nothing is presented (pomodoro: the timer screen vibrates), except the
 * long-session warning: a forgotten timer usually stays open on the timer screen (kept awake).
 */
async function foregroundBehavior(n: Notifications.Notification): Promise<Notifications.NotificationBehavior> {
  const show = n.request.identifier.startsWith(LONG_SESSION_ID_PREFIX);
  return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
}

Notifications.setNotificationHandler({ handleNotification: foregroundBehavior });

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

const repeats = (n: PlannedNotification) => n.kind === 'daily' && n.repeats === 'weekly';

/**
 * Stored with each notification: the plan's signature, and for a repeating one its trigger on the
 * phone's clock. A new time zone or DST offset then changes it, so the next sync (any opening of
 * the app) moves the weekly reminders back to their Istanbul time.
 */
function scheduledSignature(n: PlannedNotification): string {
  return repeats(n) ? `${notificationSignature(n)}|${JSON.stringify(triggerFor(n))}` : notificationSignature(n);
}

/**
 * A single notification at its moment, or a repeating one every week at the weekday and time of
 * its next delivery on the phone's clock (the same as Istanbul time on a phone set to Turkey).
 */
function triggerFor(n: PlannedNotification): Notifications.SchedulableNotificationTriggerInput {
  const channelId = Platform.OS === 'android' ? ANDROID_CHANNEL : undefined;
  if (!repeats(n)) return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId };
  const next = new Date(n.at);
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    // 1 = Sunday (expo-notifications), getDay() 0 = Sunday.
    weekday: next.getDay() + 1,
    hour: next.getHours(),
    minute: next.getMinutes(),
    channelId,
  };
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
    scheduledSignature,
  );
  for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
  for (const n of schedule) {
    // A repeating one is still wanted for its later deliveries.
    if (!repeats(n) && n.at < Date.now() + MIN_LEAD_MS) continue;
    const t = text(n);
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: t.title, body: t.body, sound: true, data: { sig: scheduledSignature(n), url: t.url } },
        trigger: triggerFor(n),
      });
    } catch {
      // One refused notification must not stop the others.
    }
  }
}

/** The last tap handled (`onOpen`). */
let lastOpened: string | null = null;

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
    const open = (response: Notifications.NotificationResponse) => {
      // The same tap can come both ways (read below and as the event): handle it once.
      const key = `${response.notification.request.identifier}|${response.notification.date}`;
      if (key === lastOpened) return;
      lastOpened = key;
      // Kept natively after every tap: a later subscription (dev reload) would open it again.
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // Not available: the key above still stops a repeat in this process.
      }
      const url = response.notification.request.content.data?.url;
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && typeof url === 'string') {
        listener(url);
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    // A tap that launched the app was emitted before anyone listened: read it once.
    try {
      const launch = Notifications.getLastNotificationResponse();
      if (launch) open(launch);
    } catch {
      // Not available on this platform.
    }
    return () => subscription.remove();
  },
};
