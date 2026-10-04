import { hoursMinutes } from '../domain/clock';
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
