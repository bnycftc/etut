import { hoursMinutes } from '../domain/clock';
import { sharedTopicPaper, topicName } from '../domain/curriculum';
import type { DayKey } from '../domain/istanbul-day';
import { tr } from '../strings';

export function formatDuration(ms: number): string {
  const { hours, minutes } = hoursMinutes(ms);
  return tr.durationHm(hours, minutes);
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
