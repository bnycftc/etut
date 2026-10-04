/**
 * Day boundaries in Europe/Istanbul.
 *
 * Türkiye has used a fixed UTC+03:00 offset all year since 2016-09-07 (no DST), so a fixed
 * offset is exact for every timestamp this app can record. It deliberately avoids
 * `Intl`/time-zone databases, which differ between Hermes, JSC and Node.
 * If Türkiye ever reintroduces DST, this is the only place to change.
 */

const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
export const ISTANBUL_OFFSET_MS = 3 * HOUR_MS;

/** Calendar day in Istanbul, formatted `YYYY-MM-DD`. */
export type DayKey = string;

export interface Interval {
  start: number;
  end: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Istanbul calendar day that contains the instant `ms` (epoch milliseconds). */
export function istanbulDayKey(ms: number): DayKey {
  const d = new Date(ms + ISTANBUL_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Istanbul calendar year that contains the instant `ms`. */
export function istanbulYear(ms: number): number {
  return new Date(ms + ISTANBUL_OFFSET_MS).getUTCFullYear();
}

/** Epoch milliseconds of 00:00 Istanbul time on `day`. */
export function dayStartMs(day: DayKey): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Invalid day key: ${day}`);
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) - ISTANBUL_OFFSET_MS;
}

/** Epoch milliseconds of 00:00 Istanbul time on the day containing `ms`. */
export function istanbulDayStartMs(ms: number): number {
  return dayStartMs(istanbulDayKey(ms));
}

export function addDays(day: DayKey, days: number): DayKey {
  return istanbulDayKey(dayStartMs(day) + days * DAY_MS);
}

/** The `count` most recent Istanbul days ending with the day containing `nowMs`, oldest first. */
export function lastDays(nowMs: number, count: number): DayKey[] {
  const today = istanbulDayKey(nowMs);
  const days: DayKey[] = [];
  for (let i = count - 1; i >= 0; i--) days.push(addDays(today, -i));
  return days;
}

/** Splits `[start, end)` at Istanbul midnights. Returns milliseconds per day, in order. */
export function splitByIstanbulDay(interval: Interval): { day: DayKey; ms: number }[] {
  const parts: { day: DayKey; ms: number }[] = [];
  let cursor = interval.start;
  while (cursor < interval.end) {
    const day = istanbulDayKey(cursor);
    const nextMidnight = dayStartMs(day) + DAY_MS;
    const partEnd = Math.min(interval.end, nextMidnight);
    parts.push({ day, ms: partEnd - cursor });
    cursor = partEnd;
  }
  return parts;
}

/** Day-of-week index in Istanbul (0 = Monday … 6 = Sunday). */
export function istanbulWeekday(day: DayKey): number {
  const sundayBased = new Date(dayStartMs(day) + ISTANBUL_OFFSET_MS).getUTCDay();
  return (sundayBased + 6) % 7;
}
