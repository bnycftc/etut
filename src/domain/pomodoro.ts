/**
 * Pomodoro mode as pure data on top of the timestamp timer.
 *
 * Nothing ticks. The schedule runs on a "pomodoro clock": wall time since the start, minus the
 * student's manual pauses (a manual pause freezes the pomodoro), plus skipped break time. Breaks
 * are derived from that clock on demand and turned into wall-time intervals, so the result is
 * the same no matter when (or whether) the app was open. Break time never counts as study.
 *
 * Time away from the app does NOT freeze the pomodoro: a locked phone during a work block is
 * handled by the normal away rule, and being away during a break is expected.
 */

import type { Interval } from './istanbul-day';

const MIN_MS = 60_000;

export interface PomodoroConfig {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** A long break follows every `longEvery`-th work block. */
  longEvery: number;
}

export const DEFAULT_POMODORO: PomodoroConfig = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longEvery: 4,
};

/** Allowed range of each setting (inclusive). */
export const POMODORO_LIMITS: Record<keyof PomodoroConfig, { min: number; max: number }> = {
  workMin: { min: 5, max: 120 },
  shortBreakMin: { min: 1, max: 30 },
  longBreakMin: { min: 1, max: 60 },
  longEvery: { min: 2, max: 8 },
};

/** "Molayı geç": at wall time `at`, the pomodoro clock jumped forward by `ms`. */
export interface PomodoroSkip {
  at: number;
  ms: number;
}

export interface PomodoroState {
  config: PomodoroConfig;
  skips: PomodoroSkip[];
}

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface PomodoroStatus {
  phase: PomodoroPhase;
  /** 1-based number of the work block (during a break: the block that just ended). */
  block: number;
  /** Position inside the current set of `longEvery` blocks, 1-based. */
  blockInSet: number;
  remainingMs: number;
  phaseMs: number;
  completedBlocks: number;
}

/** Minimal view of a running session that the schedule depends on. */
export interface PomodoroSessionView {
  startedAt: number;
  pauses: readonly { start: number; end: number | null; kind: string }[];
  pomodoro: PomodoroState | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Rounds and clamps every field into its allowed range. */
export function normalizePomodoroConfig(value: Partial<PomodoroConfig>): PomodoroConfig {
  const out = { ...DEFAULT_POMODORO };
  for (const key of Object.keys(POMODORO_LIMITS) as (keyof PomodoroConfig)[]) {
    const v = value[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = clamp(Math.round(v), POMODORO_LIMITS[key].min, POMODORO_LIMITS[key].max);
    }
  }
  return out;
}

export function isPomodoroConfig(value: unknown): value is PomodoroConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (Object.keys(POMODORO_LIMITS) as (keyof PomodoroConfig)[]).every(
    (k) => typeof v[k] === 'number' && Number.isFinite(v[k]),
  );
}

export function isPomodoroState(value: unknown): value is PomodoroState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isPomodoroConfig(v.config) &&
    Array.isArray(v.skips) &&
    v.skips.every(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as PomodoroSkip).at === 'number' &&
        typeof (s as PomodoroSkip).ms === 'number',
    )
  );
}

interface Phase {
  phase: PomodoroPhase;
  start: number;
  end: number;
  /** 0-based index of the work block (for a break: the block before it). */
  blockIndex: number;
}

function cycleLength(c: PomodoroConfig): number {
  return (c.longEvery * c.workMin + (c.longEvery - 1) * c.shortBreakMin + c.longBreakMin) * MIN_MS;
}

/** The phase that contains clock time `clock` (phases are half-open `[start, end)`). */
export function phaseAt(config: PomodoroConfig, clock: number): Phase {
  const c = normalizePomodoroConfig(config);
  const len = cycleLength(c);
  const cycle = Math.floor(Math.max(0, clock) / len);
  let offset = cycle * len;
  for (let i = 0; i < c.longEvery; i++) {
    const blockIndex = cycle * c.longEvery + i;
    const workEnd = offset + c.workMin * MIN_MS;
    if (clock < workEnd) return { phase: 'work', start: offset, end: workEnd, blockIndex };
    const isLong = i === c.longEvery - 1;
    const breakEnd = workEnd + (isLong ? c.longBreakMin : c.shortBreakMin) * MIN_MS;
    if (clock < breakEnd) {
      return { phase: isLong ? 'long_break' : 'short_break', start: workEnd, end: breakEnd, blockIndex };
    }
    offset = breakEnd;
  }
  // Unreachable: the loop covers the whole cycle.
  return { phase: 'work', start: offset, end: offset + c.workMin * MIN_MS, blockIndex: (cycle + 1) * c.longEvery };
}

/** Break phases (clock time) that overlap `[from, to)`. */
function breakWindows(config: PomodoroConfig, from: number, to: number): Interval[] {
  const out: Interval[] = [];
  let clock = Math.max(0, from);
  while (clock < to) {
    const p = phaseAt(config, clock);
    if (p.phase !== 'work') out.push({ start: Math.max(p.start, from), end: Math.min(p.end, to) });
    clock = p.end;
  }
  return out;
}

/** Wall-time stretches of `[startedAt, now)` where the pomodoro clock runs (no manual pause). */
function runningSegments(view: PomodoroSessionView, now: number): Interval[] {
  const manual = view.pauses
    .filter((p) => p.kind === 'manual')
    .map((p) => ({ start: Math.max(p.start, view.startedAt), end: Math.min(p.end ?? now, now) }))
    .filter((p) => p.end > p.start)
    .sort((a, b) => a.start - b.start);
  const segments: Interval[] = [];
  let cursor = view.startedAt;
  for (const p of manual) {
    if (p.start > cursor) segments.push({ start: cursor, end: p.start });
    cursor = Math.max(cursor, p.end);
  }
  if (now > cursor) segments.push({ start: cursor, end: now });
  return segments;
}

interface Piece {
  wallStart: number;
  wallEnd: number;
  clockStart: number;
}

/** Splits the running segments at skips and assigns each piece its pomodoro clock offset. */
function clockPieces(view: PomodoroSessionView, now: number): { pieces: Piece[]; clockNow: number } {
  const skips = [...(view.pomodoro?.skips ?? [])].filter((s) => s.ms > 0).sort((a, b) => a.at - b.at);
  const pieces: Piece[] = [];
  let clock = 0;
  let si = 0;
  for (const seg of runningSegments(view, now)) {
    let cursor = seg.start;
    while (cursor < seg.end) {
      while (si < skips.length && skips[si].at <= cursor) clock += skips[si++].ms;
      const nextSkip = si < skips.length ? skips[si].at : Number.POSITIVE_INFINITY;
      const end = Math.min(seg.end, nextSkip);
      pieces.push({ wallStart: cursor, wallEnd: end, clockStart: clock });
      clock += end - cursor;
      cursor = end;
    }
  }
  while (si < skips.length && skips[si].at <= now) clock += skips[si++].ms;
  return { pieces, clockNow: clock };
}

/** Pomodoro clock reading at `now`. */
export function pomodoroClock(view: PomodoroSessionView, now: number): number {
  return clockPieces(view, now).clockNow;
}

/** Break periods up to `now`, as wall-time intervals. Empty when pomodoro mode is off. */
export function pomodoroBreaks(view: PomodoroSessionView, now: number): Interval[] {
  const state = view.pomodoro;
  if (state === null || now <= view.startedAt) return [];
  const out: Interval[] = [];
  for (const piece of clockPieces(view, now).pieces) {
    const len = piece.wallEnd - piece.wallStart;
    for (const w of breakWindows(state.config, piece.clockStart, piece.clockStart + len)) {
      out.push({
        start: piece.wallStart + (w.start - piece.clockStart),
        end: piece.wallStart + (w.end - piece.clockStart),
      });
    }
  }
  return out;
}

export function pomodoroStatus(view: PomodoroSessionView, now: number): PomodoroStatus | null {
  const state = view.pomodoro;
  if (state === null) return null;
  const config = normalizePomodoroConfig(state.config);
  const clock = pomodoroClock(view, Math.max(now, view.startedAt));
  const p = phaseAt(config, clock);
  return {
    phase: p.phase,
    block: p.blockIndex + 1,
    blockInSet: (p.blockIndex % config.longEvery) + 1,
    remainingMs: p.end - clock,
    phaseMs: p.end - p.start,
    completedBlocks: p.phase === 'work' ? p.blockIndex : p.blockIndex + 1,
  };
}

/** A future switch from one pomodoro phase to the next, in wall time. */
export interface PhaseChange {
  at: number;
  /** The phase that ends at `at`. */
  ended: PomodoroPhase;
  /** The phase that starts at `at`. */
  next: PomodoroPhase;
  /** When `next` ends, if nothing changes in between. */
  nextEndsAt: number;
  /** Position of `next` (work) or of the block before it (break) inside its set, 1-based. */
  nextBlockInSet: number;
}

/**
 * The next `count` phase changes after `now`, assuming the student neither pauses nor skips a
 * break from now on (the pomodoro clock then runs at wall speed). Empty when pomodoro mode is off
 * or a manual pause is open (a manual pause freezes the pomodoro).
 */
export function upcomingPhaseChanges(view: PomodoroSessionView, now: number, count: number): PhaseChange[] {
  const state = view.pomodoro;
  if (state === null || count <= 0) return [];
  if (view.pauses.some((p) => p.kind === 'manual' && p.end === null)) return [];
  const config = normalizePomodoroConfig(state.config);
  const from = Math.max(now, view.startedAt);
  const clock = pomodoroClock(view, from);
  // While nothing is paused, wall time = clock + offset.
  const offset = from - clock;
  const out: PhaseChange[] = [];
  let phase = phaseAt(config, clock);
  for (let i = 0; i < count; i++) {
    const next = phaseAt(config, phase.end);
    out.push({
      at: phase.end + offset,
      ended: phase.phase,
      next: next.phase,
      nextEndsAt: next.end + offset,
      nextBlockInSet: (next.blockIndex % config.longEvery) + 1,
    });
    phase = next;
  }
  return out;
}

/**
 * "Molayı geç": ends the current break now and starts the next work block. Does nothing during
 * a work block or while the student has paused manually.
 */
export function skipBreak<S extends PomodoroSessionView>(session: S, now: number, paused: boolean): S {
  const state = session.pomodoro;
  if (state === null || paused) return session;
  const status = pomodoroStatus(session, now);
  if (status === null || status.phase === 'work' || status.remainingMs <= 0) return session;
  return {
    ...session,
    pomodoro: { ...state, skips: [...state.skips, { at: now, ms: status.remainingMs }] },
  };
}
