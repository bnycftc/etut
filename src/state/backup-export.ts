/**
 * Makes the backup file and hands it to the share sheet: the Yedek screen's "Yedek dosyası
 * oluştur" and "Önce yedek al" in the "Tüm verileri sil" dialog run the same export.
 */

import { type BackupFile, backupFileName, parseBackup, serializeBackup } from '../domain/backup';
import { istanbulDayKey } from '../domain/istanbul-day';
import { shareTextFile } from '../storage/file-io';
import { storeLastBackupAt } from '../storage/kv';
import { tr } from '../strings';

export type BackupExportResult =
  | { kind: 'shared'; skippedSessions: number; skippedExams: number; skippedTargets: number }
  | { kind: 'unavailable' }
  | { kind: 'check_failed' };

/** On `shared` the caller announces the new "Son yedek" (`notifyDataChanged('settings')`). */
export async function shareBackup(file: BackupFile): Promise<BackupExportResult> {
  const today = istanbulDayKey(Date.now());
  const json = serializeBackup(file);
  // The file must read back on the new phone; check it here, not after the old one is reset.
  const check = parseBackup(json);
  if (!check.ok) return { kind: 'check_failed' };
  const result = await shareTextFile(backupFileName(today), json, {
    mimeType: 'application/json',
    uti: 'public.json',
    dialogTitle: tr.backup.shareTitle,
  });
  if (result === 'unavailable') return { kind: 'unavailable' };
  // "Son yedek": the file was made and handed to the share sheet (where it went is not known).
  storeLastBackupAt(Date.now());
  return {
    kind: 'shared',
    skippedSessions: check.skippedSessions,
    skippedExams: check.skippedExams,
    skippedTargets: check.skippedTargets,
  };
}

/** What the screen says after an export (`error` in the danger colour). */
export function backupExportText(result: BackupExportResult): { message: string } | { error: string } {
  switch (result.kind) {
    case 'check_failed':
      return { error: tr.backup.exportCheckFailed };
    case 'unavailable':
      return { error: tr.backup.unavailable };
    case 'shared': {
      const message = result.skippedSessions > 0 ? tr.backup.exportSkipped(result.skippedSessions) : tr.backup.exported;
      // Exams and net targets that no longer fit the exam tables would not load either: say so.
      return result.skippedExams + result.skippedTargets > 0
        ? { message: `${message} ${tr.backupSafety.exportSkipped(result.skippedExams, result.skippedTargets)}` }
        : { message };
    }
  }
}
