/**
 * Interfaces of the platform adapters. Each adapter has a no-op default file (web, and Android
 * where noted) and a platform file (`.ios.ts` / `.native.ts`) that Metro picks for the device.
 * Every call is best effort: a failure (feature off in iOS Settings, old iOS, permission
 * denied) is swallowed and the app keeps working without that system surface.
 */

import type { PlannedNotification } from '../domain/reminders';
import type { TimerActivityProps, TodayWidgetProps } from './surface-props';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface NotificationText {
  title: string;
  body: string;
  /** In-app route opened when the notification is tapped. */
  url: string;
}

export interface NotificationsAdapter {
  readonly supported: boolean;
  getPermission(): Promise<NotificationPermission>;
  /** Shows the system prompt if the student has not answered it yet. */
  requestPermission(): Promise<NotificationPermission>;
  /** Makes the scheduled notifications equal to `planned` (cancels the rest of ours). */
  sync(planned: PlannedNotification[], text: (n: PlannedNotification) => NotificationText): Promise<void>;
  cancelAll(): Promise<void>;
  /** Called with the route of a notification the student tapped. Returns an unsubscribe. */
  onOpen(listener: (url: string) => void): () => void;
}

export interface LiveActivityAdapter {
  readonly supported: boolean;
  /** Active Live Activities of ours (any session). */
  count(): number;
  /** `false` when the system refused (Live Activities turned off, not in the foreground, …). */
  start(props: TimerActivityProps, staleAt: number | null): boolean;
  update(props: TimerActivityProps, staleAt: number | null): Promise<void>;
  endAll(): Promise<void>;
}

export interface HomeWidgetAdapter {
  readonly supported: boolean;
  setTimeline(entries: { at: number; props: TodayWidgetProps }[]): void;
}
