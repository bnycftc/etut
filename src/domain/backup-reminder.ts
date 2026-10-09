/**
 * The quiet backup reminder on the timer screen and the "Son yedek" line.
 *
 * Every record lives only on this phone, so a lost phone or a deleted app loses it all. The app
 * says so once in a while, in the app and never as a notification (hukuk/03 K-34: no pressure,
 * no marketing):
 * - only after the student has study time on at least `BACKUP_NUDGE_MIN_STUDY_DAYS` days (there
 *   is something worth keeping),
 * - only when no backup file was made in the last `BACKUP_NUDGE_AFTER_DAYS` days,
 * - "Şimdi değil" hides it for `BACKUP_NUDGE_SNOOZE_DAYS` days.
 * A time in the future (the phone clock was moved back) counts as "just now": the card stays
 * quiet rather than nag because of a wrong clock.
 */

import { DAY_MS, dayStartMs, istanbulDayKey } from './istanbul-day';

export const BACKUP_NUDGE_MIN_STUDY_DAYS = 7;
export const BACKUP_NUDGE_AFTER_DAYS = 30;
export const BACKUP_NUDGE_SNOOZE_DAYS = 30;

function olderThan(at: number | null, days: number, now: number): boolean {
  return at === null || now - at >= days * DAY_MS;
}

export interface BackupNudgeInput {
  /** Days with any study time (sayaç or elle). */
  studyDays: number;
  /** Last backup file made; `null` = never. */
  lastBackupAt: number | null;
  /** Last "Şimdi değil"; `null` = never. */
  dismissedAt: number | null;
  now: number;
}

/** No backup for a while and not snoozed; says nothing about the study days. */
export function backupNudgeDue(lastBackupAt: number | null, dismissedAt: number | null, now: number): boolean {
  return (
    olderThan(lastBackupAt, BACKUP_NUDGE_AFTER_DAYS, now) && olderThan(dismissedAt, BACKUP_NUDGE_SNOOZE_DAYS, now)
  );
}

export function shouldShowBackupNudge({ studyDays, lastBackupAt, dismissedAt, now }: BackupNudgeInput): boolean {
  return studyDays >= BACKUP_NUDGE_MIN_STUDY_DAYS && backupNudgeDue(lastBackupAt, dismissedAt, now);
}

/** Istanbul calendar days since `at` (0 = today, 1 = yesterday); never negative. */
export function daysSince(at: number, now: number): number {
  const days = Math.round((dayStartMs(istanbulDayKey(now)) - dayStartMs(istanbulDayKey(at))) / DAY_MS);
  return Math.max(0, days);
}
