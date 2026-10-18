import { hoursMinutes } from '../domain/clock';
import { sharedTopicPaper, topicName } from '../domain/curriculum';
import type { DayKey } from '../domain/istanbul-day';
import { tr } from '../strings';

/**
 * Whole hours and minutes, rounded down: "2 sa 5 dk", "45 dk", "0 dk" under a minute. The home
 * screen widget's one-line total is built with it (`src/system/surface-props.ts`), where
 * "1 dakikadan az" does not fit; screens show study time with `formatStudyTime`.
 */
export function formatDuration(ms: number): string {
  const { hours, minutes } = hoursMinutes(ms);
  return tr.durationHm(hours, minutes);
}

/**
 * A study time on screen. Time that was studied never reads "0 dk": under a minute it is
 * "1 dakikadan az", as in the summary after Bitir (V-11: Geçmiş said "0 dk" for the same record).
 * Zero stays "0 dk"; whole minutes read as in `formatDuration`.
 */
export function formatStudyTime(ms: number): string {
  return ms > 0 && ms < 60_000 ? tr.timer.lessThanMinute : formatDuration(ms);
}

export function formatDay(day: DayKey): string {
  const [y, m, d] = day.split('-').map(Number);
  return tr.longDate(y, m, d);
}

/**
 * Display name of a topic, with TYT/AYT in front where both papers have a topic of that name
 * ("AYT Fonksiyonlar"); `null` for an unknown id.
 */
export function topicLabel(topicId: string | null | undefined): string | null {
  const name = topicName(topicId);
  return name === null ? null : tr.topics.withPaper(name, sharedTopicPaper(topicId));
}
