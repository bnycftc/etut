import { router } from 'expo-router';
import { useState } from 'react';

import { BACKUP_NUDGE_SNOOZE_DAYS, daysSince, shouldShowBackupNudge } from '../domain/backup-reminder';
import { istanbulDayKey } from '../domain/istanbul-day';
import { useAppState, useStored } from '../state/app-state';
import { loadBackupNudgeDismissedAt, loadLastBackupAt, storeBackupNudgeDismissedAt } from '../storage/kv';
import { tr } from '../strings';
import { Button, Card, Label, ResponsiveRow } from './components';
import { formatDay } from './format';

/** "Son yedek: 3 gün önce (4 Ekim 2026)" or "Hiç yedek alınmadı". */
export function lastBackupText(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return tr.backupReminder.never;
  return tr.backupReminder.last(daysSince(lastBackupAt, now), formatDay(istanbulDayKey(lastBackupAt)));
}

/**
 * The "Son yedek" line (Yedek screen, Ayarlar), re-read after a backup (`notifyDataChanged('settings')`).
 * `note`: also say what the date means (the file was made; where it was saved is not known).
 */
export function LastBackupLabel({ testID, note = false }: { testID?: string; note?: boolean }) {
  const { dataVersions } = useAppState();
  const last = useStored(`lastBackup|${dataVersions.settings}`, loadLastBackupAt);
  return (
    <>
      <Label testID={testID} variant="small">
        {lastBackupText(last, Date.now())}
      </Label>
      {note && last !== null ? <Label variant="small">{tr.backupReminder.lastNote}</Label> : null}
    </>
  );
}

/**
 * Quiet card on the timer screen when the data is worth keeping and no backup was made for a
 * while (rule: domain/backup-reminder.ts). In the app only, never a notification; "Şimdi değil"
 * hides it for a month.
 */
export function BackupNudge({ studyDays, now }: { studyDays: number; now: number }) {
  const { dataVersions } = useAppState();
  const stored = useStored(`backupNudge|${dataVersions.settings}`, () => ({
    last: loadLastBackupAt(),
    dismissed: loadBackupNudgeDismissedAt(),
  }));
  const [dismissedNow, setDismissedNow] = useState<number | null>(null);
  const dismissedAt = dismissedNow ?? stored.dismissed;
  if (!shouldShowBackupNudge({ studyDays, lastBackupAt: stored.last, dismissedAt, now })) return null;
  const days = stored.last === null ? null : daysSince(stored.last, now);
  return (
    <Card testID="backup-nudge">
      <Label variant="heading">{tr.backupReminder.cardTitle(days)}</Label>
      <Label variant="muted">{tr.backupReminder.cardBody}</Label>
      <ResponsiveRow>
        <Button compact testID="backup-nudge-open" title={tr.backupReminder.open} onPress={() => router.push('/yedek')} />
        <Button
          compact
          testID="backup-nudge-dismiss"
          kind="secondary"
          title={tr.backupReminder.dismiss}
          accessibilityHint={tr.backupReminder.dismissHint(BACKUP_NUDGE_SNOOZE_DAYS)}
          onPress={() => {
            const at = Date.now();
            storeBackupNudgeDismissedAt(at);
            setDismissedNow(at);
          }}
        />
      </ResponsiveRow>
    </Card>
  );
}
