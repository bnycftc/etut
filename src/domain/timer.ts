/**
 * Study timer as pure data. Elapsed time is never counted by ticking: it is always derived from
 * the start timestamp and the pause intervals, so it stays correct after the app is suspended,
 * killed or restarted.
 *
 * Background rule (iOS cannot tell "screen locked" from "switched to another app"):
 * - Leaving the app for at most BACKGROUND_TOLERANCE_MS changes nothing.
 * - Leaving it longer turns the whole away interval into an automatic break ("away" pause).
 *   The student is then offered a one-tap "I was studying" that credits the interval back.
 * - The timer keeps running after the student returns.
 * - If the app dies without a background event, the gap after the last foreground heartbeat
 *   (`lastSeenAt`) is handled the same way on the next launch.
 * - A second absence before the student answered joins the first one: one prompt, one answer
 *   for both (`pendingAway` spans them, `pendingAwayMs` is the time actually away).
 * - The student can choose in Settings that leaving the app counts as study (`AwayRule` 'count');
 *   then no break is made and nothing is asked. The default stays 'ask'.
 *
 * A clock set back before the start (e.g. corrected by the network) never loses the session:
 * it is saved up to the last moment the app recorded (`finishSession`).
 */

import type { Interval } from './istanbul-day';
import {
  isPomodoroState,
  type PomodoroConfig,
  pomodoroBreaks,
  type PomodoroState,
  skipBreak as skipPomodoroBreak,
} from './pomodoro';

export const BACKGROUND_TOLERANCE_MS = 10_000;

/**
 * What leaving the app while the timer runs means: 'ask' (default) = automatic break plus
 * "Çalışıyordum"; 'count' = the time away counts as study, nothing is asked.
 */
export type AwayRule = 'ask' | 'count';

/**
 * Study time of one session above which finishing asks first ("did you really study that long?").
 * Same 10 hours as the limit of one manual entry (`MANUAL_MAX_MS`) and the server's `too_long`.
 */
export const LONG_SESSION_MS = 10 * 3_600_000;

/** `break` = a pomodoro break (stored on finished sessions only; derived while running). */
export type PauseKind = 'manual' | 'away' | 'break';

/** `manual` = added afterwards by the student ("elle"), shown with that label everywhere. */
export type SessionSource = 'timer' | 'manual';

export interface Pause {
  start: number;
  /** `null` while the break is still going on. */
  end: number | null;
  kind: PauseKind;
}

export interface ClosedPause extends Pause {
  end: number;
}

export interface ActiveSession {
  id: string;
  subjectId: string;
  /** Optional curriculum topic (see `curriculum/`). */
  topicId: string | null;
  startedAt: number;
  pauses: Pause[];
  /** When the app went to the background while the timer was running; `null` otherwise. */
  backgroundedAt: number | null;
  /**
   * Automatic breaks the student has not answered yet: from the start of the first unanswered
   * one to the end of the last (in-app time between them was never a break).
   */
  pendingAway: Interval | null;
  /**
   * Heartbeat written while the timer runs in the foreground. If the app dies without a
   * background event (force quit, crash, battery), the gap after it is treated as away time.
   */
  lastSeenAt: number | null;
  /** Pomodoro mode; `null` = plain stopwatch ("kronometre"). */
  pomodoro: PomodoroState | null;
}

export interface CompletedSession {
  id: string;
  subjectId: string;
  topicId: string | null;
  startedAt: number;
  endedAt: number;
  pauses: ClosedPause[];
  durationMs: number;
  source: SessionSource;
}

export interface StartOptions {
  topicId?: string | null;
  pomodoro?: PomodoroConfig | null;
}

export function startSession(
  id: string,
  subjectId: string,
  now: number,
  options: StartOptions = {},
): ActiveSession {
  return {
    id,
    subjectId,
    topicId: options.topicId ?? null,
    startedAt: now,
    pauses: [],
    backgroundedAt: null,
    pendingAway: null,
    lastSeenAt: now,
    pomodoro: options.pomodoro ? { config: { ...options.pomodoro }, skips: [] } : null,
  };
}

export function isPaused(session: ActiveSession): boolean {
  const last = session.pauses[session.pauses.length - 1];
  return last !== undefined && last.end === null;
}

export function pauseSession(session: ActiveSession, now: number): ActiveSession {
  if (isPaused(session)) return session;
  // A clock set back before the start: the break begins after what was recorded, not at the start
  // (which would turn the whole session into a break).
  const start = now >= session.startedAt ? now : lastRecordedAt(session);
  return { ...session, pauses: [...session.pauses, { start, end: null, kind: 'manual' }] };
}

export function resumeSession(session: ActiveSession, now: number): ActiveSession {
  if (!isPaused(session)) return session;
  const pauses = session.pauses.map((p, i) =>
    i === session.pauses.length - 1 ? { ...p, end: Math.max(now, p.start) } : p,
  );
  return { ...session, pauses, lastSeenAt: seenAt(session, now) };
}

/**
 * `lastSeenAt` for a look at the clock at `now`. A clock that went back before the start keeps
 * the last reading from before (so `finishSession` can still save what was studied).
 */
function seenAt(session: ActiveSession, now: number): number {
  return now < session.startedAt && session.lastSeenAt !== null ? Math.max(now, session.lastSeenAt) : now;
}

/** Latest moment this session recorded (heartbeat, background event, breaks, pomodoro skips). */
function lastRecordedAt(session: ActiveSession): number {
  let latest = Math.max(session.startedAt, session.lastSeenAt ?? 0, session.backgroundedAt ?? 0);
  for (const p of session.pauses) latest = Math.max(latest, p.start, p.end ?? 0);
  for (const s of session.pomodoro?.skips ?? []) latest = Math.max(latest, s.at);
  return latest;
}

/** Pauses with any open break closed at `endAt`, clipped to `[startedAt, endAt]`. */
export function closePauses(startedAt: number, pauses: Pause[], endAt: number): ClosedPause[] {
  return pauses
    .map((p) => {
      const start = Math.min(Math.max(p.start, startedAt), endAt);
      const end = Math.min(Math.max(p.end ?? endAt, start), endAt);
      return { ...p, start, end };
    })
    .filter((p) => p.end > p.start);
}

/** Intervals actually spent studying: `[startedAt, endAt]` minus all pauses. */
export function workIntervals(startedAt: number, pauses: Pause[], endAt: number): Interval[] {
  if (endAt <= startedAt) return [];
  const closed = closePauses(startedAt, pauses, endAt).sort((a, b) => a.start - b.start);
  const intervals: Interval[] = [];
  let cursor = startedAt;
  for (const p of closed) {
    if (p.start > cursor) intervals.push({ start: cursor, end: p.start });
    cursor = Math.max(cursor, p.end);
  }
  if (endAt > cursor) intervals.push({ start: cursor, end: endAt });
  return intervals;
}

export function intervalsTotal(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
}

/**
 * All breaks of a running session up to `now`: the stored pauses plus, in pomodoro mode, the
 * derived pomodoro breaks (kind `break`).
 */
export function effectivePauses(session: ActiveSession, now: number): Pause[] {
  const breaks = pomodoroBreaks(session, now).map(
    (b): Pause => ({ start: b.start, end: b.end, kind: 'break' }),
  );
  return breaks.length === 0 ? session.pauses : [...session.pauses, ...breaks];
}

export function elapsedMs(session: ActiveSession, now: number): number {
  return intervalsTotal(workIntervals(session.startedAt, effectivePauses(session, now), now));
}

export function finishSession(session: ActiveSession, now: number): CompletedSession {
  // A clock set back before the start would leave nothing: end at the last recorded moment.
  const endedAt = now >= session.startedAt ? now : lastRecordedAt(session);
  return {
    id: session.id,
    subjectId: session.subjectId,
    topicId: session.topicId,
    startedAt: session.startedAt,
    endedAt,
    pauses: closePauses(session.startedAt, effectivePauses(session, endedAt), endedAt).sort(
      (a, b) => a.start - b.start,
    ),
    durationMs: elapsedMs(session, endedAt),
    source: 'timer',
  };
}

/**
 * Keeps only the first `maxMs` of study time of a finished session (the student said a very long
 * session was not all study): it then ends at the moment that much study time was reached.
 */
export function capStudyTime(done: CompletedSession, maxMs: number): CompletedSession {
  if (done.durationMs <= maxMs) return done;
  let left = maxMs;
  let endedAt = done.startedAt;
  for (const interval of workIntervals(done.startedAt, done.pauses, done.endedAt)) {
    const length = interval.end - interval.start;
    if (length >= left) {
      endedAt = interval.start + left;
      break;
    }
    left -= length;
  }
  return { ...done, endedAt, pauses: closePauses(done.startedAt, done.pauses, endedAt), durationMs: maxMs };
}

/**
 * What "Bitir" must ask before saving, in this order: an absence the student has not answered
 * (never dropped silently), then a session longer than `LONG_SESSION_MS`. `null` = save at once.
 */
export function finishQuestion(session: ActiveSession, now: number): 'away' | 'long' | null {
  if (session.pendingAway !== null) return 'away';
  return finishSession(session, now).durationMs > LONG_SESSION_MS ? 'long' : null;
}

/** "Molayı geç" in pomodoro mode (no effect otherwise). */
export function skipBreak(session: ActiveSession, now: number): ActiveSession {
  return skipPomodoroBreak(session, now, isPaused(session));
}

/** The app moved to the background. Only a running timer is watched. */
export function onAppBackground(session: ActiveSession, now: number): ActiveSession {
  if (isPaused(session) || session.backgroundedAt !== null) return session;
  return { ...session, backgroundedAt: now };
}

/** The app is active again. `rule` = the student's choice for time away (default 'ask'). */
export function onAppForeground(session: ActiveSession, now: number, rule: AwayRule = 'ask'): ActiveSession {
  const awayStart = session.backgroundedAt;
  if (awayStart === null) return session;
  const cleared: ActiveSession = { ...session, backgroundedAt: null, lastSeenAt: seenAt(session, now) };
  // A clock that went backwards is treated as "no time away".
  if (now - awayStart <= BACKGROUND_TOLERANCE_MS) return cleared;
  // The student chose that time away counts as study: no break, nothing to ask.
  if (rule === 'count') return cleared;
  // Pomodoro: being away only during a break loses no study time, so there is nothing to ask.
  if (session.pomodoro !== null) {
    const breaks = pomodoroBreaks(session, now).map((b): Pause => ({ ...b, kind: 'break' }));
    if (intervalsTotal(workIntervals(awayStart, breaks, now)) === 0) return cleared;
  }
  return {
    ...cleared,
    pauses: [...cleared.pauses, { start: awayStart, end: now, kind: 'away' }],
    // Still unanswered from before: one prompt (and one answer) for both absences.
    // (min/max: with a clock that was set back the new absence can lie before the first one.)
    pendingAway:
      session.pendingAway === null
        ? { start: awayStart, end: now }
        : { start: Math.min(session.pendingAway.start, awayStart), end: Math.max(session.pendingAway.end, now) },
  };
}

/** Foreground heartbeat (see `lastSeenAt`). Only a running, foreground timer is marked. */
export function markSeen(session: ActiveSession, now: number): ActiveSession {
  if (isPaused(session) || session.backgroundedAt !== null) return session;
  return { ...session, lastSeenAt: seenAt(session, now) };
}

/**
 * Cold start with a persisted session. If the background event was recorded, the normal rule
 * applies; if the app died in the foreground, the time since the last heartbeat is the absence.
 */
export function onAppLaunch(session: ActiveSession, now: number, rule: AwayRule = 'ask'): ActiveSession {
  if (session.backgroundedAt === null && !isPaused(session) && session.lastSeenAt !== null) {
    return onAppForeground({ ...session, backgroundedAt: session.lastSeenAt }, now, rule);
  }
  return onAppForeground(session, now, rule);
}

/** The automatic breaks inside `pendingAway`. */
function isPendingAway(p: Pause, away: Interval): boolean {
  return p.kind === 'away' && p.end !== null && p.start >= away.start && p.end <= away.end;
}

/** Time actually spent away in the unanswered absences (0 when nothing is pending). */
export function pendingAwayMs(session: ActiveSession): number {
  const away = session.pendingAway;
  if (away === null) return 0;
  return session.pauses.reduce((sum, p) => (isPendingAway(p, away) ? sum + ((p.end ?? p.start) - p.start) : sum), 0);
}

/** "Çalışıyordum, süreye ekle": remove the automatic breaks so the time away counts as study. */
export function creditAway(session: ActiveSession): ActiveSession {
  const away = session.pendingAway;
  if (away === null) return session;
  const pauses = session.pauses.filter((p) => !isPendingAway(p, away));
  return { ...session, pauses, pendingAway: null };
}

/** Keep the automatic break and hide the prompt. */
export function dismissAway(session: ActiveSession): ActiveSession {
  return session.pendingAway === null ? session : { ...session, pendingAway: null };
}

/** Runtime check for a value read back from storage. */
export function isActiveSession(value: unknown): value is ActiveSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.subjectId === 'string' &&
    typeof v.startedAt === 'number' &&
    Array.isArray(v.pauses) &&
    v.pauses.every(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Pause).start === 'number' &&
        ((p as Pause).end === null || typeof (p as Pause).end === 'number'),
    ) &&
    (v.backgroundedAt === null || typeof v.backgroundedAt === 'number') &&
    (v.pendingAway === null || typeof v.pendingAway === 'object') &&
    (v.lastSeenAt === null || typeof v.lastSeenAt === 'number') &&
    // Added later: missing in sessions stored by older versions.
    (v.topicId === undefined || v.topicId === null || typeof v.topicId === 'string') &&
    (v.pomodoro === undefined || v.pomodoro === null || isPomodoroState(v.pomodoro))
  );
}

/** Reads a stored session, filling fields that older versions did not write. */
export function toActiveSession(value: unknown): ActiveSession | null {
  if (!isActiveSession(value)) return null;
  return { ...value, topicId: value.topicId ?? null, pomodoro: value.pomodoro ?? null };
}
