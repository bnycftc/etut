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
 * - `pomodoro`: a pomodoro phase ends (the in-app vibration covers the foreground case).
 * - `daily`: the student's daily study reminder at a chosen Istanbul time; skipped today once
 *   the student has studied today or a session is running.
 * - `exam_analysis`: one reminder the day after a mock exam was saved with its analysis pending.
 */

import { addDays, type DayKey, dayStartMs, istanbulDayKey } from './istanbul-day';
import { type PomodoroPhase, upcomingPhaseChanges } from './pomodoro';
import { type ActiveSession, isPaused } from './timer';

const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

export const LONG_SESSION_HOURS = { min: 1, max: 8, default: 3 } as const;
export const DAILY_MINUTE_STEP = 15;
/** Istanbul hour of the "analizi bekleyen deneme" reminder on the next day. */
export const EXAM_REMINDER_HOUR = 18;
/** Days of daily reminders kept scheduled ahead (refreshed whenever the app is opened). */
export const DAILY_DAYS_AHEAD = 10;
/** Pomodoro phase changes kept scheduled ahead. */
export const POMODORO_CHANGES_AHEAD = 8;
/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_PLANNED = 60;

export interface ReminderPrefs {
  longSession: { enabled: boolean; hours: number };
  pomodoro: { enabled: boolean };
  daily: { enabled: boolean; hour: number; minute: number };
  examAnalysis: { enabled: boolean };
}

/** The daily reminder is off until the student turns it on; the others start on. */
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  longSession: { enabled: true, hours: LONG_SESSION_HOURS.default },
  pomodoro: { enabled: true },
  daily: { enabled: false, hour: 20, minute: 0 },
  examAnalysis: { enabled: true },
};

export type ReminderKey = keyof ReminderPrefs;

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
  | { id: string; at: number; kind: 'daily' }
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
    const today = istanbulDayKey(now);
    for (let i = 0; i < DAILY_DAYS_AHEAD; i++) {
      const day = addDays(today, i);
      if (i === 0 && (studiedToday || active !== null)) continue;
      const at = istanbulTime(day, prefs.daily.hour, prefs.daily.minute);
      if (at > now) out.push({ id: `${NOTIFICATION_ID_PREFIX}daily:${day}`, at, kind: 'daily' });
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
