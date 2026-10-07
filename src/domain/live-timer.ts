/**
 * What the iPhone Lock Screen / Dynamic Island timer (Live Activity) shows, as pure data.
 *
 * The app never ticks the Live Activity: it hands the system a time range and SwiftUI's
 * `Text(timerInterval:pauseTime:countsDown:)` draws the running clock. A new range is only sent
 * when something changes (start, pause, resume, skip, "Çalışıyordum", finish). Every value here
 * is derived from the same timestamps as the in-app clock (`timer.ts`, `pomodoro.ts`) and stays
 * the same between two changes, so repeated syncs send nothing.
 *
 * Apple limits (ActivityKit, "Displaying live data with Live Activities"):
 * - A Live Activity is active for at most 8 hours; then the system ends it (it may stay on the
 *   Lock Screen for up to 4 more hours, frozen).
 * - An app can start a Live Activity only while it is in the foreground (no push here).
 * So a long session gets a fresh Live Activity whenever the student opens the app after
 * `LIVE_ACTIVITY_REFRESH_MS`, or after the system ended the old one at the 8-hour limit.
 */

import { type PomodoroPhase, pomodoroStatus, upcomingPhaseChanges } from './pomodoro';
import { type ActiveSession, elapsedMs, isPaused } from './timer';

const HOUR_MS = 3_600_000;

/** ActivityKit ends a Live Activity after this long. */
export const LIVE_ACTIVITY_MAX_MS = 8 * HOUR_MS;
/** Opened after this age, the app replaces the Live Activity (a new 8-hour window). */
export const LIVE_ACTIVITY_REFRESH_MS = 6 * HOUR_MS;
/** A Live Activity gone before this age was removed by the student: not started again for the session. */
const SYSTEM_END_SLACK_MS = 60_000;
/** Upper end of a count-up range; the clock would stop there (far beyond the 8-hour limit). */
export const COUNT_UP_SPAN_MS = 24 * HOUR_MS;

/**
 * A clock drawn by the system: counts down to `to` or up from `from`, frozen at `pausedAt` when
 * set. Always `from <= to`.
 */
export interface LiveClock {
  from: number;
  to: number;
  countsDown: boolean;
  pausedAt: number | null;
}

export interface LiveTimerView {
  mode: 'stopwatch' | 'pomodoro';
  paused: boolean;
  /** Pomodoro phase shown now; `null` for the stopwatch. */
  phase: PomodoroPhase | null;
  /** Position of the current work block in its set (pomodoro), 1-based. */
  blockInSet: number | null;
  clock: LiveClock;
  /** Pomodoro, while running: the phase after the current one, shown once `staleAt` passes. */
  next: { phase: PomodoroPhase; blockInSet: number; clock: LiveClock } | null;
  /** When the current content stops being right by itself (end of the pomodoro phase). */
  staleAt: number | null;
}

/** Start of the open manual pause, if any. */
function openPauseStart(session: ActiveSession): number | null {
  const last = session.pauses[session.pauses.length - 1];
  return last !== undefined && last.end === null ? last.start : null;
}

export function liveTimerView(session: ActiveSession, now: number): LiveTimerView {
  const paused = isPaused(session);
  // While paused nothing moves: evaluate at the pause start so the values stay the same.
  const at = Math.max(session.startedAt, paused ? (openPauseStart(session) ?? now) : now);

  const status = pomodoroStatus(session, at);
  if (status === null) {
    const from = at - elapsedMs(session, at);
    return {
      mode: 'stopwatch',
      paused,
      phase: null,
      blockInSet: null,
      clock: { from, to: from + COUNT_UP_SPAN_MS, countsDown: false, pausedAt: paused ? at : null },
      next: null,
      staleAt: null,
    };
  }

  const to = at + Math.max(0, status.remainingMs);
  const clock: LiveClock = {
    from: Math.min(to, to - status.phaseMs),
    to,
    countsDown: true,
    pausedAt: paused ? at : null,
  };
  const change = paused ? undefined : upcomingPhaseChanges(session, at, 1)[0];
  return {
    mode: 'pomodoro',
    paused,
    phase: status.phase,
    blockInSet: status.blockInSet,
    clock,
    next:
      change === undefined
        ? null
        : {
            phase: change.next,
            blockInSet: change.nextBlockInSet,
            clock: { from: change.at, to: change.nextEndsAt, countsDown: true, pausedAt: null },
          },
    staleAt: change === undefined ? null : change.at,
  };
}

/** Which Live Activity is ours: the session it shows and when it was started. */
export interface LiveActivityRecord {
  sessionId: string;
  startedAt: number;
  /** The student removed it from the Lock Screen: never started again for this session. */
  dismissed?: boolean;
  /** Started again once after it was found gone at a launch (`retry`); a second loss is a removal. */
  retried?: boolean;
}

/**
 * `dismissed`: do nothing now, but remember that the student removed it (`record.dismissed`).
 * `retry`: like `start`, for one that vanished before this launch (record it as `retried`).
 */
export type LiveActivityAction = 'none' | 'start' | 'retry' | 'update' | 'restart' | 'end' | 'dismissed';

/**
 * What to do with the Live Activity, decided at every sync (foreground or going to the background).
 * `instances` = Live Activities of ours that are still active (any session).
 *
 * A removal is only told apart from the system's 8-hour end if the app syncs before that limit;
 * seen only later, it looks like the system's end and a new one starts. A Live Activity the system
 * ended can stay on the Lock Screen for up to 4 more hours, and expo-widgets does not list ended
 * ones, so the app can neither count nor remove it: next to the new one it may show for a while.
 *
 * A restart of the phone also removes every Live Activity, and it can not be told apart from the
 * student's removal either. But a restart always restarts the app too, while a removal usually
 * happens with the app still alive. `seenThisLaunch` = this app process has seen (or started)
 * this Live Activity. Gone after being seen in this launch: the student removed it. Gone before
 * this launch could see it: maybe a restart, so it is started once more (`retry`); if that one
 * goes too, it counts as removed.
 */
export function liveActivityAction(input: {
  sessionId: string | null;
  instances: number;
  record: LiveActivityRecord | null;
  now: number;
  seenThisLaunch?: boolean;
}): LiveActivityAction {
  const { sessionId, instances, record, now, seenThisLaunch = true } = input;
  if (sessionId === null) return instances > 0 ? 'end' : 'none';
  const ours = record !== null && record.sessionId === sessionId ? record : null;
  if (instances === 0) {
    // Gone before the 8-hour limit: the student removed it from the Lock Screen. Respect that
    // for the rest of this session; otherwise (new session, or ended by the system) start one.
    if (ours?.dismissed === true) return 'none';
    if (ours !== null && now - ours.startedAt < LIVE_ACTIVITY_MAX_MS - SYSTEM_END_SLACK_MS) {
      return seenThisLaunch || ours.retried === true ? 'dismissed' : 'retry';
    }
    return 'start';
  }
  if (instances > 1 || ours === null) return 'restart';
  return now - ours.startedAt >= LIVE_ACTIVITY_REFRESH_MS ? 'restart' : 'update';
}
