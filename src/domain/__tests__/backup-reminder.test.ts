import {
  BACKUP_NUDGE_AFTER_DAYS,
  BACKUP_NUDGE_MIN_STUDY_DAYS,
  BACKUP_NUDGE_SNOOZE_DAYS,
  backupNudgeDue,
  daysSince,
  shouldShowBackupNudge,
} from '../backup-reminder';
import { contactEmail, feedbackMailUrl } from '../contact';
import { DAY_MS } from '../istanbul-day';

const NOW = Date.parse('2026-10-07T09:00:00Z'); // 12:00 in Istanbul

describe('backup reminder rule', () => {
  const base = { studyDays: 7, lastBackupAt: null, dismissedAt: null, now: NOW };

  it('the numbers the guide and the card talk about', () => {
    expect([BACKUP_NUDGE_MIN_STUDY_DAYS, BACKUP_NUDGE_AFTER_DAYS, BACKUP_NUDGE_SNOOZE_DAYS]).toEqual([7, 30, 30]);
  });

  it('needs at least 7 study days: there is something worth keeping', () => {
    expect(shouldShowBackupNudge({ ...base, studyDays: 6 })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, studyDays: 7 })).toBe(true);
    expect(shouldShowBackupNudge({ ...base, studyDays: 0 })).toBe(false);
  });

  it('a backup in the last 30 days keeps it quiet', () => {
    expect(shouldShowBackupNudge({ ...base, lastBackupAt: NOW - 29 * DAY_MS })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, lastBackupAt: NOW - 30 * DAY_MS + 1 })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, lastBackupAt: NOW - 30 * DAY_MS })).toBe(true);
    expect(shouldShowBackupNudge({ ...base, lastBackupAt: NOW - 400 * DAY_MS })).toBe(true);
  });

  it('"Şimdi değil" hides it for 30 days, then it may come back', () => {
    expect(shouldShowBackupNudge({ ...base, dismissedAt: NOW - DAY_MS })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, dismissedAt: NOW - 29 * DAY_MS })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, dismissedAt: NOW - 30 * DAY_MS })).toBe(true);
  });

  it('both must allow it: an old backup does not override a recent "Şimdi değil"', () => {
    expect(backupNudgeDue(NOW - 90 * DAY_MS, NOW - 2 * DAY_MS, NOW)).toBe(false);
    expect(backupNudgeDue(NOW - 2 * DAY_MS, NOW - 90 * DAY_MS, NOW)).toBe(false);
    expect(backupNudgeDue(NOW - 90 * DAY_MS, NOW - 90 * DAY_MS, NOW)).toBe(true);
    expect(backupNudgeDue(null, null, NOW)).toBe(true);
  });

  it('a time in the future (clock moved back) counts as just now: no nagging', () => {
    expect(shouldShowBackupNudge({ ...base, lastBackupAt: NOW + 5 * DAY_MS })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, dismissedAt: NOW + 5 * DAY_MS })).toBe(false);
  });
});

describe('days since the last backup (Istanbul days)', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysSince(NOW - 60_000, NOW)).toBe(0);
    // 23:30 in Istanbul the day before, read at 00:10: "dün".
    expect(daysSince(Date.parse('2026-10-06T20:30:00Z'), Date.parse('2026-10-06T21:10:00Z'))).toBe(1);
    expect(daysSince(NOW - 3 * DAY_MS, NOW)).toBe(3);
  });

  it('never negative', () => {
    expect(daysSince(NOW + 2 * DAY_MS, NOW)).toBe(0);
  });
});

describe('contact e-mail', () => {
  it('the [DOLDURULACAK] placeholder is not an address: no link is made', () => {
    expect(contactEmail('[DOLDURULACAK]')).toBeNull();
    expect(contactEmail('')).toBeNull();
    expect(contactEmail('https://etut.example')).toBeNull();
    expect(contactEmail('iki kelime@ornek.com')).toBeNull();
    expect(contactEmail('a@b')).toBeNull();
  });

  it('a plain address is used as is', () => {
    expect(contactEmail(' destek@ornek.com.tr ')).toBe('destek@ornek.com.tr');
  });

  it('the link carries only the subject, encoded', () => {
    expect(feedbackMailUrl('destek@ornek.com', 'Etüt geri bildirim · sürüm 0.3.0 (12) · iOS 26.1')).toBe(
      'mailto:destek@ornek.com?subject=Et%C3%BCt%20geri%20bildirim%20%C2%B7%20s%C3%BCr%C3%BCm%200.3.0%20(12)%20%C2%B7%20iOS%2026.1',
    );
  });
});
