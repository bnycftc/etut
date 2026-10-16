/**
 * Local reminders as pure data: which notifications should be waiting in the system right now.
 *
 * Nothing is sent anywhere: the app asks the system to show a notification at a time (no push,
 * no token, no server). The plan is recomputed from the current state after every change and
 * compared with what is already scheduled (`diffNotifications`), so a reminder is never scheduled
 * twice and a stale one (finished session, analysed exam, changed time) is cancelled.
 * Identifiers are stable: the same reminder always gets the same id.
 *
 * Kinds:
 * - `long_session`: the timer has been running without a manual pause for `hours` ("Hâlâ
 *   çalışıyor musun?"). Once per running stretch; a manual pause + resume starts a new stretch.
 *   Pomodoro breaks do not pause the timer, so the text never says "without a break".
 * - `pomodoro`: a pomodoro phase ends (the in-app vibration covers the foreground case).
 * - `daily`: the student's daily study reminder at a chosen Istanbul time; skipped today once
 *   the student has studied today or a session is running. One repeating (weekly) notification
 *   per weekday, so it keeps coming however long the app stays closed (single notifications for
 *   the next 10 days ran out when the app was not opened). See `planNotifications` for the
 *   skipped day.
 * - `exam_analysis`: one reminder the day after a mock exam was saved with its analysis pending.
 *
 * Nothing is planned before the student has confirmed reminders once (`effectiveReminderPrefs`).
 */

import { addDays, type DayKey, dayStartMs, istanbulDayKey, istanbulWeekday } from './istanbul-day';
import { type PomodoroPhase, upcomingPhaseChanges } from './pomodoro';
import { type ActiveSession, isPaused } from './timer';

const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

export const LONG_SESSION_HOURS = { min: 1, max: 8, default: 3 } as const;
export const DAILY_MINUTE_STEP = 15;
/** Istanbul hour of the "analizi bekleyen deneme" reminder on the next day. */
export const EXAM_REMINDER_HOUR = 18;
/**
 * Weeks of single daily reminders that stand in for a skipped weekday's repeating one (see
 * `planNotifications`): 6 repeating + 4 single = 10 daily notifications at most.
 */
export const DAILY_SKIPPED_WEEKS_AHEAD = 4;
/**
 * Pomodoro phase changes kept scheduled ahead: ≈ 10 h 50 min with the default 25/5/15 rhythm,
 * so a locked phone keeps getting them. The plan moves on at every phase change while the app is
 * open and when it goes to the background. With at most 10 daily notifications, 1 long-session
 * reminder and at most 2 exam days (yesterday's and today's exams) it stays under `MAX_PLANNED`.
 */
export const POMODORO_CHANGES_AHEAD = 40;
/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_PLANNED = 60;

export interface ReminderPrefs {
  longSession: { enabled: boolean; hours: number };
  pomodoro: { enabled: boolean };
  daily: { enabled: boolean; hour: number; minute: number };
  examAnalysis: { enabled: boolean };
}

/**
 * Defaults for fields missing from stored preferences. The `enabled` flags here never switch a
 * reminder on by themselves: before the first confirmation every reminder is off
 * (`effectiveReminderPrefs`), and confirming turns on only the one the student chose
 * (`remindersAfterConfirm`), stored as a full set.
 */
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  longSession: { enabled: true, hours: LONG_SESSION_HOURS.default },
  pomodoro: { enabled: true },
  daily: { enabled: false, hour: 20, minute: 0 },
  examAnalysis: { enabled: true },
};

export type ReminderKey = keyof ReminderPrefs;

/**
 * The reminders actually in force. Until the student has turned reminders on through the
 * explanation screen (`confirmed`), every reminder is off — even when the system permission is
 * already granted: Android 12 and older grant it at install time, and the permission outlives
 * "Tüm verileri sil".
 */
export function effectiveReminderPrefs(prefs: ReminderPrefs, confirmed: boolean): ReminderPrefs {
  if (confirmed) return prefs;
  return {
    longSession: { ...prefs.longSession, enabled: false },
    pomodoro: { enabled: false },
    daily: { ...prefs.daily, enabled: false },
    examAnalysis: { enabled: false },
  };
}

/**
 * What the explanation screen stores once the permission is granted: the reminders in force now
 * (all off before the first confirmation) plus the one the student turned on (`key`; `null` = only
 * the permission was asked for). No other reminder comes on with it: each is turned on by itself.
 */
export function remindersAfterConfirm(stored: ReminderPrefs, confirmed: boolean, key: ReminderKey | null): ReminderPrefs {
  const current = effectiveReminderPrefs(stored, confirmed);
  return key === null ? current : { ...current, [key]: { ...current[key], enabled: true } };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Reads stored preferences, filling missing or invalid fields with the defaults. */
export function normalizeReminderPrefs(value: unknown): ReminderPrefs {
  const v = record(value);
  const d = DEFAULT_REMINDER_PREFS;
  const long = record(v.longSession);
  const pomodoro = record(v.pomodoro);
  const daily = record(v.daily);
  const exam = record(v.examAnalysis);
  const minute = clampInt(daily.minute, 0, 59, d.daily.minute);
  return {
    longSession: {
      enabled: bool(long.enabled, d.longSession.enabled),
      hours: clampInt(long.hours, LONG_SESSION_HOURS.min, LONG_SESSION_HOURS.max, d.longSession.hours),
    },
    pomodoro: { enabled: bool(pomodoro.enabled, d.pomodoro.enabled) },
    daily: {
      enabled: bool(daily.enabled, d.daily.enabled),
      hour: clampInt(daily.hour, 0, 23, d.daily.hour),
      minute: minute - (minute % DAILY_MINUTE_STEP),
    },
    examAnalysis: { enabled: bool(exam.enabled, d.examAnalysis.enabled) },
  };
}

export type PlannedNotification =
  | { id: string; at: number; kind: 'long_session'; hours: number }
  | { id: string; at: number; kind: 'pomodoro'; ended: PomodoroPhase; next: PomodoroPhase }
  /** `at` = next delivery; `repeats: 'weekly'` = then again every 7 days at the same time. */
  | { id: string; at: number; kind: 'daily'; repeats?: 'weekly' }
  | { id: string; at: number; kind: 'exam_analysis'; count: number };

/** All identifiers of this app start with this prefix. */
export const NOTIFICATION_ID_PREFIX = 'etut:';

export interface PendingExam {
  id: string;
  createdAt: number;
}

export interface ReminderInput {
  now: number;
  prefs: ReminderPrefs;
  active: ActiveSession | null;
  /** Any study time recorded today (Istanbul day), the running session included. */
  studiedToday: boolean;
  pendingExams: PendingExam[];
}

/** Start of the current running stretch: the end of the last manual pause, or the start. */
export function runningStretchStart(session: ActiveSession): number {
  let start = session.startedAt;
  for (const p of session.pauses) {
    if (p.kind === 'manual' && p.end !== null && p.end > start) start = p.end;
  }
  return start;
}

/** Istanbul wall-clock time `hour:minute` on `day`. */
function istanbulTime(day: DayKey, hour: number, minute: number): number {
  return dayStartMs(day) + hour * HOUR_MS + minute * MIN_MS;
}

export function planNotifications(input: ReminderInput): PlannedNotification[] {
  const { now, prefs, active, studiedToday, pendingExams } = input;
  const out: PlannedNotification[] = [];
  const running = active !== null && !isPaused(active);

  if (running && prefs.longSession.enabled) {
    const stretch = runningStretchStart(active);
    const at = stretch + prefs.longSession.hours * HOUR_MS;
    if (at > now) {
      out.push({ id: `${NOTIFICATION_ID_PREFIX}long:${active.id}:${stretch}`, at, kind: 'long_session', hours: prefs.longSession.hours });
    }
  }

  if (running && prefs.pomodoro.enabled) {
    for (const change of upcomingPhaseChanges(active, now, POMODORO_CHANGES_AHEAD)) {
      if (change.at <= now) continue;
      out.push({
        id: `${NOTIFICATION_ID_PREFIX}pomodoro:${active.id}:${change.at}`,
        at: change.at,
        kind: 'pomodoro',
        ended: change.ended,
        next: change.next,
      });
    }
  }

  if (prefs.daily.enabled) {
    const { hour, minute } = prefs.daily;
    const today = istanbulDayKey(now);
    // The next delivery of each weekday: from today, or from tomorrow once today's time has passed.
    const first = istanbulTime(today, hour, minute) > now ? 0 : 1;
    for (let i = first; i < first + 7; i++) {
      const day = addDays(today, i);
      if (i === 0 && (studiedToday || active !== null)) {
        // Today is skipped, and a repeating notification can not leave out one delivery: this
        // weekday gets single ones for the next weeks instead. The next sync (any opening of the
        // app, also later today) puts its repeating one back. Trade-off: if the app then stays
        // closed for more than DAILY_SKIPPED_WEEKS_AHEAD weeks, this weekday falls silent; the
        // six other days keep coming.
        for (let week = 1; week <= DAILY_SKIPPED_WEEKS_AHEAD; week++) {
          const later = addDays(day, 7 * week);
          out.push({ id: `${NOTIFICATION_ID_PREFIX}daily:${later}`, at: istanbulTime(later, hour, minute), kind: 'daily' });
        }
        continue;
      }
      out.push({
        id: `${NOTIFICATION_ID_PREFIX}daily:weekly:${istanbulWeekday(day)}`,
        at: istanbulTime(day, hour, minute),
        kind: 'daily',
        repeats: 'weekly',
      });
    }
  }

  if (prefs.examAnalysis.enabled) {
    const byDay = new Map<DayKey, number>();
    for (const exam of pendingExams) {
      const day = addDays(istanbulDayKey(exam.createdAt), 1);
      if (istanbulTime(day, EXAM_REMINDER_HOUR, 0) > now) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    for (const [day, count] of byDay) {
      out.push({
        id: `${NOTIFICATION_ID_PREFIX}exam:${day}`,
        at: istanbulTime(day, EXAM_REMINDER_HOUR, 0),
        kind: 'exam_analysis',
        count,
      });
    }
  }

  return out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).slice(0, MAX_PLANNED);
}

/** Everything that defines a scheduled notification; equal signatures need no rescheduling. */
export function notificationSignature(n: PlannedNotification): string {
  return JSON.stringify(n);
}

export interface ScheduledNotification {
  id: string;
  /** Signature stored with the notification when it was scheduled (`null` if unknown). */
  signature: string | null;
}

/**
 * Turns "what is scheduled" into "what should be": cancel what is not planned (or changed),
 * schedule what is missing (or changed). Notifications of other origins are left alone.
 */
export function diffNotifications(
  scheduled: ScheduledNotification[],
  planned: PlannedNotification[],
): { cancel: string[]; schedule: PlannedNotification[] } {
  const wanted = new Map(planned.map((n) => [n.id, notificationSignature(n)]));
  const byId = new Map<string, (string | null)[]>();
  for (const s of scheduled) {
    if (!s.id.startsWith(NOTIFICATION_ID_PREFIX)) continue;
    byId.set(s.id, [...(byId.get(s.id) ?? []), s.signature]);
  }
  const kept = new Set<string>();
  const cancel: string[] = [];
  for (const [id, signatures] of byId) {
    // A duplicate is cancelled as a whole and scheduled again once.
    if (signatures.length === 1 && wanted.get(id) === signatures[0]) kept.add(id);
    else cancel.push(id);
  }
  return { cancel, schedule: planned.filter((n) => !kept.has(n.id)) };
}
