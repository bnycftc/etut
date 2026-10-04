/**
 * Adding a study session afterwards ("sayacı açmayı unuttum"). Such sessions are stored with
 * `source = 'manual'` and are labelled "elle" wherever they appear (and later in groups).
 *
 * Limits: whole minutes, at least 1 minute, at most 10 hours per entry, must end by now (no
 * future time) and must not overlap any other session, including the one that is running.
 */

import { type DayKey, dayStartMs } from './istanbul-day';
import type { CompletedSession } from './timer';

const MIN_MS = 60_000;
export const MANUAL_MIN_MS = MIN_MS;
export const MANUAL_MAX_MS = 10 * 60 * MIN_MS;

export type ManualEntryError = 'invalid' | 'too_short' | 'too_long' | 'future' | 'overlap';

export interface ManualEntryInput {
  subjectId: string;
  topicId: string | null;
  startMs: number;
  durationMs: number;
}

export interface TimeSpan {
  startedAt: number;
  endedAt: number;
}

/** Half-open overlap: touching end-to-start is allowed. */
export function overlaps(a: TimeSpan, b: TimeSpan): boolean {
  return a.startedAt < b.endedAt && b.startedAt < a.endedAt;
}

/**
 * `existing` = stored sessions near the entry plus the running session as
 * `{ startedAt, endedAt: now }`.
 */
export function validateManualEntry(
  input: ManualEntryInput,
  existing: readonly TimeSpan[],
  now: number,
): ManualEntryError | null {
  const { startMs, durationMs } = input;
  if (!Number.isFinite(startMs) || !Number.isFinite(durationMs)) return 'invalid';
  if (durationMs % MIN_MS !== 0) return 'invalid';
  if (durationMs < MANUAL_MIN_MS) return 'too_short';
  if (durationMs > MANUAL_MAX_MS) return 'too_long';
  const span = { startedAt: startMs, endedAt: startMs + durationMs };
  if (span.endedAt > now) return 'future';
  if (existing.some((e) => overlaps(span, e))) return 'overlap';
  return null;
}

export function buildManualSession(id: string, input: ManualEntryInput): CompletedSession {
  return {
    id,
    subjectId: input.subjectId,
    topicId: input.topicId,
    startedAt: input.startMs,
    endedAt: input.startMs + input.durationMs,
    pauses: [],
    durationMs: input.durationMs,
    source: 'manual',
  };
}

/** Whole number from a text field; empty is `null`, anything else non-numeric is NaN. */
function parseWhole(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  return /^\d{1,3}$/.test(t) ? Number(t) : Number.NaN;
}

/** Istanbul wall-clock time on `day` → epoch ms; `null` if the fields are not a valid time. */
export function parseStartTime(day: DayKey, hours: string, minutes: string): number | null {
  const h = parseWhole(hours);
  const m = parseWhole(minutes) ?? 0;
  if (h === null || !Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return dayStartMs(day) + h * 60 * MIN_MS + m * MIN_MS;
}

/** Hours + minutes fields → milliseconds; `null` if invalid. Empty fields count as 0. */
export function parseDurationFields(hours: string, minutes: string): number | null {
  const h = parseWhole(hours) ?? 0;
  const m = parseWhole(minutes) ?? 0;
  if (!Number.isInteger(h) || !Number.isInteger(m) || m > 59) return null;
  return (h * 60 + m) * MIN_MS;
}
