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
  /** Last automatic break that the student has not answered yet. */
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
  const start = Math.max(now, session.startedAt);
  return { ...session, pauses: [...session.pauses, { start, end: null, kind: 'manual' }] };
}

export function resumeSession(session: ActiveSession, now: number): ActiveSession {
  if (!isPaused(session)) return session;
  const pauses = session.pauses.map((p, i) =>
    i === session.pauses.length - 1 ? { ...p, end: Math.max(now, p.start) } : p,
  );
  return { ...session, pauses, lastSeenAt: now };
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
  const endedAt = Math.max(now, session.startedAt);
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

/** "Molayı geç" in pomodoro mode (no effect otherwise). */
export function skipBreak(session: ActiveSession, now: number): ActiveSession {
  return skipPomodoroBreak(session, now, isPaused(session));
}

/** The app moved to the background. Only a running timer is watched. */
export function onAppBackground(session: ActiveSession, now: number): ActiveSession {
  if (isPaused(session) || session.backgroundedAt !== null) return session;
  return { ...session, backgroundedAt: now };
}

/** The app is active again. */
export function onAppForeground(session: ActiveSession, now: number): ActiveSession {
  const awayStart = session.backgroundedAt;
  if (awayStart === null) return session;
  const cleared: ActiveSession = { ...session, backgroundedAt: null, lastSeenAt: now };
  // A clock that went backwards is treated as "no time away".
  if (now - awayStart <= BACKGROUND_TOLERANCE_MS) return cleared;
  // Pomodoro: being away only during a break loses no study time, so there is nothing to ask.
  if (session.pomodoro !== null) {
    const breaks = pomodoroBreaks(session, now).map((b): Pause => ({ ...b, kind: 'break' }));
    if (intervalsTotal(workIntervals(awayStart, breaks, now)) === 0) return cleared;
  }
  return {
    ...cleared,
    pauses: [...cleared.pauses, { start: awayStart, end: now, kind: 'away' }],
    pendingAway: { start: awayStart, end: now },
  };
}

/** Foreground heartbeat (see `lastSeenAt`). Only a running, foreground timer is marked. */
export function markSeen(session: ActiveSession, now: number): ActiveSession {
  if (isPaused(session) || session.backgroundedAt !== null) return session;
  return { ...session, lastSeenAt: now };
}

/**
 * Cold start with a persisted session. If the background event was recorded, the normal rule
 * applies; if the app died in the foreground, the time since the last heartbeat is the absence.
 */
export function onAppLaunch(session: ActiveSession, now: number): ActiveSession {
  if (session.backgroundedAt === null && !isPaused(session) && session.lastSeenAt !== null) {
    return onAppForeground({ ...session, backgroundedAt: session.lastSeenAt }, now);
  }
  return onAppForeground(session, now);
}

/** "Çalışıyordum, süreye ekle": remove the automatic break so the interval counts as study. */
export function creditAway(session: ActiveSession): ActiveSession {
  const away = session.pendingAway;
  if (away === null) return session;
  const pauses = session.pauses.filter(
    (p) => !(p.kind === 'away' && p.start === away.start && p.end === away.end),
  );
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
