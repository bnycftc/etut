import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

import {
  BACKUP_MAX_BYTES,
  type BackupCounts,
  type BackupFile,
  backupCounts,
  backupFileName,
  canUndoReplace,
  type ImportMode,
  parseBackup,
  replaceUndoExpired,
  serializeBackup,
} from '@/domain/backup';
import { topicName } from '@/domain/curriculum';
import { type CsvLabels, examRows, sessionRows, toCsv } from '@/domain/csv';
import { istanbulDayKey, istanbulTimeOfDay } from '@/domain/istanbul-day';
import { useAppState, useStored } from '@/state/app-state';
import { readBackupData } from '@/storage/backup';
import { pickTextFile, type ShareResult, shareTextFile } from '@/storage/file-io';
import { loadReplaceUndo, storeReplaceUndo } from '@/storage/kv';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label, Screen } from '@/ui/components';
import { formatDay } from '@/ui/format';
import { usePalette } from '@/ui/theme';

const CSV_LABELS: CsvLabels = {
  subject: tr.subject,
  topic: (id) => topicName(id) ?? id,
  source: (s) => (s === 'manual' ? tr.csv.sourceManual : tr.csv.sourceTimer),
  examKind: tr.examKind,
  scope: (s) => (s === 'genel' ? tr.exams.scopeGenel : tr.exams.scopeBrans),
  yesNo: (v) => (v ? tr.csv.yes : tr.csv.no),
};

/** `7.10.2026 14:30` (Istanbul) */
function formatMoment(ms: number): string {
  const { hours, minutes } = istanbulTimeOfDay(ms);
  return `${formatDay(istanbulDayKey(ms))} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Backup to a JSON file, restore from it (merge or replace), and CSV export. */
export default function BackupScreen() {
  const { createBackup, importBackup, undoReplace, dataVersion, notifyDataChanged } = useAppState();
  const c = usePalette();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [skippedExams, setSkippedExams] = useState({ exams: 0, targets: 0 });
  const [mode, setModeState] = useState<ImportMode>('merge');
  // "Değiştir" asks twice: this is what the second question says will go.
  const [replaceSure, setReplaceSure] = useState<BackupCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const setMode = (m: ImportMode) => {
    setModeState(m);
    setReplaceSure(null);
  };
  const undo = useStored(`undo|${dataVersion}`, loadReplaceUndo);
  const undoable = undo !== null && canUndoReplace(undo.createdAt, Date.now());
  // A copy too old to offer is not kept either (it holds a full copy of the data).
  const expired = undo !== null && replaceUndoExpired(undo.createdAt, Date.now());
  // "Geri al" is a replace too: it asks first, with what will go.
  const [undoSure, setUndoSure] = useState<BackupCounts | null>(null);
  useEffect(() => {
    if (expired) storeReplaceUndo(null);
  }, [expired]);
  const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '';

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await task();
    } catch {
      setError(tr.backup.failed);
    } finally {
      setBusy(false);
    }
  };

  const report = (result: ShareResult, done: string) => {
    if (result === 'unavailable') setError(tr.backup.unavailable);
    else setMessage(done);
  };

  const exportBackup = () =>
    run(async () => {
      const today = istanbulDayKey(Date.now());
      const json = serializeBackup(createBackup(appVersion));
      // The file must read back on the new phone; check it here, not after the old one is reset.
      const check = parseBackup(json);
      if (!check.ok) {
        setError(tr.backup.exportCheckFailed);
        return;
      }
      report(
        await shareTextFile(backupFileName(today), json, {
          mimeType: 'application/json',
          uti: 'public.json',
          dialogTitle: tr.backup.shareTitle,
        }),
        check.skippedSessions > 0 ? tr.backup.exportSkipped(check.skippedSessions) : tr.backup.exported,
      );
    });

  const pick = () =>
    run(async () => {
      setPending(null);
      const picked = await pickTextFile(BACKUP_MAX_BYTES);
      if (picked.kind === 'canceled') return;
      if (picked.kind === 'too_large') {
        setError(tr.backup.errors.too_large);
        return;
      }
      const parsed = parseBackup(picked.text);
      if (!parsed.ok) {
        setError(tr.backup.errors[parsed.error]);
        return;
      }
      setMode('merge');
      setSkipped(parsed.skippedSessions);
      setSkippedExams({ exams: parsed.skippedExams, targets: parsed.skippedTargets });
      setPending(parsed.file);
    });

  const confirmImport = () => {
    if (pending === null) return;
    setError(null);
    if (mode === 'replace' && replaceSure === null) {
      setReplaceSure(backupCounts(readBackupData()));
      return;
    }
    try {
      const counts = importBackup(pending, mode);
      setMessage(tr.backup.done(counts.sessions, counts.exams, counts.topics));
      setPending(null);
      setReplaceSure(null);
    } catch {
      setError(tr.backup.failed);
    }
  };

  const restoreUndo = () => {
    setMessage(null);
    setError(null);
    setUndoSure(null);
    try {
      const counts = undoReplace();
      if (counts === null) setError(tr.backupSafety.undoFailed);
      else setMessage(tr.backupSafety.undone(counts.sessions, counts.exams, counts.topics));
    } catch {
      setError(tr.backup.failed);
    }
    notifyDataChanged();
  };

  const discardUndo = () => {
    storeReplaceUndo(null);
    notifyDataChanged();
  };

  const exportCsv = (which: 'sessions' | 'exams') =>
    run(async () => {
      const today = istanbulDayKey(Date.now());
      const data = readBackupData();
      const csv =
        which === 'sessions'
          ? toCsv(tr.csv.sessionHeader, sessionRows(data.sessions, CSV_LABELS))
          : toCsv(tr.csv.examHeader, examRows(data.exams, CSV_LABELS));
      report(
        await shareTextFile(which === 'sessions' ? tr.csv.sessionsFile(today) : tr.csv.examsFile(today), csv, {
          mimeType: 'text/csv',
          uti: 'public.comma-separated-values-text',
          dialogTitle: tr.backup.csvShareTitle,
        }),
        tr.backup.csvDone,
      );
    });

  const preview = pending === null ? null : backupCounts(pending);

  return (
    <Screen testID="backup-screen">
      <Label variant="muted">{tr.backup.info}</Label>

      {message !== null ? <Label testID="backup-message">{message}</Label> : null}
      {error !== null ? (
        <Label testID="backup-error" style={{ color: c.danger }}>
          {error}
        </Label>
      ) : null}

      {undo !== null && undoable && pending === null ? (
        <Card testID="backup-undo-card">
          <Label variant="heading">{tr.backupSafety.undoTitle}</Label>
          <Label variant="muted">{tr.backupSafety.undoInfo(formatMoment(undo.createdAt))}</Label>
          {undoSure === null ? (
            <>
              <Button
                testID="backup-undo"
                title={tr.backupSafety.undo}
                onPress={() => setUndoSure(backupCounts(readBackupData()))}
              />
              <Button
                testID="backup-undo-discard"
                kind="secondary"
                title={tr.backupSafety.undoDiscard}
                onPress={discardUndo}
              />
            </>
          ) : (
            <>
              <Label testID="backup-undo-sure" style={{ color: c.danger }}>
                {tr.backupSafety.undoSure(undoSure.sessions, undoSure.exams, undoSure.topics)}
              </Label>
              <Button testID="backup-undo-yes" kind="danger" title={tr.backupSafety.undoYes} onPress={restoreUndo} />
              <Button
                testID="backup-undo-no"
                kind="secondary"
                title={tr.backupSafety.replaceNo}
                onPress={() => setUndoSure(null)}
              />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <Button testID="backup-export" title={tr.backup.export} disabled={busy} onPress={exportBackup} />
        <Button testID="backup-import" kind="secondary" title={tr.backup.import} disabled={busy} onPress={pick} />
      </Card>

      {pending !== null && preview !== null ? (
        <Card testID="backup-preview">
          <Label testID="backup-preview-counts">{tr.backup.picked(preview.sessions, preview.exams, preview.topics)}</Label>
          {skipped > 0 ? (
            <Label testID="backup-preview-skipped" variant="small">
              {tr.backup.skipped(skipped)}
            </Label>
          ) : null}
          {skippedExams.exams + skippedExams.targets > 0 ? (
            <Label testID="backup-preview-skipped-exams" variant="small">
              {tr.backupSafety.skipped(skippedExams.exams, skippedExams.targets)}
            </Label>
          ) : null}
          <Label variant="small">{tr.backup.exportedOn(formatDay(istanbulDayKey(pending.exportedAt)))}</Label>
          <Label variant="heading">{tr.backup.modeTitle}</Label>
          <ChipRow>
            <Chip testID="backup-mode-merge" title={tr.backup.merge} selected={mode === 'merge'} onPress={() => setMode('merge')} />
            <Chip
              testID="backup-mode-replace"
              title={tr.backup.replace}
              selected={mode === 'replace'}
              onPress={() => setMode('replace')}
            />
          </ChipRow>
          <Label variant="muted">{mode === 'merge' ? tr.backup.mergeInfo : tr.backup.replaceInfo}</Label>
          <Label variant="small">{tr.backup.ageNote}</Label>
          {replaceSure === null ? (
            <>
              <Button
                testID="backup-confirm"
                kind={mode === 'replace' ? 'danger' : 'primary'}
                title={tr.backup.confirm}
                onPress={confirmImport}
              />
              <Button testID="backup-cancel" kind="secondary" title={tr.backup.cancel} onPress={() => setPending(null)} />
            </>
          ) : (
            <>
              <Label testID="backup-replace-sure" style={{ color: c.danger }}>
                {tr.backupSafety.replaceSure(replaceSure.sessions, replaceSure.exams, replaceSure.topics)}
              </Label>
              <Button testID="backup-replace-yes" kind="danger" title={tr.backupSafety.replaceYes} onPress={confirmImport} />
              <Button
                testID="backup-replace-no"
                kind="secondary"
                title={tr.backupSafety.replaceNo}
                onPress={() => setReplaceSure(null)}
              />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">{tr.backup.csvTitle}</Label>
        <Label variant="muted">{tr.backup.csvInfo}</Label>
        <Button
          testID="csv-sessions"
          kind="secondary"
          title={tr.backup.csvSessions}
          disabled={busy}
          onPress={() => exportCsv('sessions')}
        />
        <Button
          testID="csv-exams"
          kind="secondary"
          title={tr.backup.csvExams}
          disabled={busy}
          onPress={() => exportCsv('exams')}
        />
      </Card>
    </Screen>
  );
}
