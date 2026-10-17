import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

import {
  BACKUP_MAX_BYTES,
  type BackupCounts,
  type BackupFile,
  backupCounts,
  canUndoReplace,
  type ImportMode,
  parseBackup,
  replaceUndoExpired,
} from '@/domain/backup';
import { topicName } from '@/domain/curriculum';
import { type CsvLabels, examRows, sessionRows, toCsv } from '@/domain/csv';
import { istanbulDayKey, istanbulTimeOfDay } from '@/domain/istanbul-day';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { backupExportText, shareBackup } from '@/state/backup-export';
import { DATA_KINDS } from '@/state/data-kinds';
import { readBackupData } from '@/storage/backup';
import { pickTextFile, type ShareResult, shareTextFile } from '@/storage/file-io';
import { loadReplaceUndo, storeReplaceUndo } from '@/storage/kv';
import { tr } from '@/strings';
import { LastBackupLabel } from '@/ui/backup-reminder';
import { Button, Card, Chip, ChipRow, Label, Screen, Section } from '@/ui/components';
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
  const { createBackup, importBackup, undoReplace, dataVersions, notifyDataChanged } = useAppState();
  const c = usePalette();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [skippedExams, setSkippedExams] = useState({ exams: 0, targets: 0 });
  const [mode, setModeState] = useState<ImportMode>('merge');
  // "DeÄŸiÅŸtir" asks twice: this is what the second question says will go.
  const [replaceSure, setReplaceSure] = useState<BackupCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const setMode = (m: ImportMode) => {
    setModeState(m);
    setReplaceSure(null);
  };
  const undo = useStored(`undo|${dataVersions.settings}`, loadReplaceUndo);
  // A render clock, not Date.now(): the React Compiler would keep the first result while `undo`
  // stays. Never before the copy itself (it may be newer than the clock's last tick).
  const clock = useNow(false);
  const now = undo === null ? clock : Math.max(clock, undo.createdAt);
  const undoable = undo !== null && canUndoReplace(undo.createdAt, now);
  // A copy too old to offer is not kept either (it holds a full copy of the data).
  const expired = undo !== null && replaceUndoExpired(undo.createdAt, now);
  // "Geri al" is a replace too: it asks first, with what will go.
  const [undoSure, setUndoSure] = useState<BackupCounts | null>(null);
  // "Kopyayı sil" can not be taken back (the copy may be the only one): it asks first too.
  const [discardSure, setDiscardSure] = useState(false);
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
      const result = await shareBackup(createBackup(appVersion));
      if (result.kind === 'shared') notifyDataChanged('settings');
      const shown = backupExportText(result);
      if ('error' in shown) setError(shown.error);
      else setMessage(shown.message);
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
      const result = importBackup(pending, mode);
      setReplaceSure(null);
      if (result.kind === 'copy_unreadable') {
        setError(tr.backupSafety.copyUnreadable);
        return;
      }
      if (result.kind === 'copy_incomplete') {
        setError(tr.backupSafety.copyIncomplete(result.lostExams, result.lostTargets));
        return;
      }
      const { counts } = result;
      setMessage(tr.backup.done(counts.sessions, counts.exams, counts.topics));
      setPending(null);
    } catch {
      setError(tr.backup.failed);
    }
  };

  const restoreUndo = () => {
    setMessage(null);
    setError(null);
    setUndoSure(null);
    try {
      const result = undoReplace();
      if (result === null) setError(tr.backupSafety.undoFailed);
      else {
        const { counts, lostExams, lostTargets } = result;
        setMessage(
          lostExams + lostTargets > 0
            ? tr.backupSafety.undonePartly(counts.sessions, counts.exams, counts.topics, lostExams, lostTargets)
            : tr.backupSafety.undone(counts.sessions, counts.exams, counts.topics),
        );
      }
    } catch {
      setError(tr.backup.failed);
    }
    notifyDataChanged(...DATA_KINDS);
  };

  const discardUndo = () => {
    setDiscardSure(false);
    storeReplaceUndo(null);
    notifyDataChanged('settings');
  };

  const exportCsv = (which: 'sessions' | 'exams') =>
    run(async () => {
      const today = istanbulDayKey(Date.now());
      const data = readBackupData();
      const csv =
        which === 'sessions'
          ? toCsv([...tr.csv.sessionHeader, tr.questions.csvHeader], sessionRows(data.sessions, CSV_LABELS))
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

      {message !== null ? <Label testID="backup-message" live>{message}</Label> : null}
      {error !== null ? (
        <Label testID="backup-error" live style={{ color: c.danger }}>
          {error}
        </Label>
      ) : null}

      {undo !== null && undoable && pending === null ? (
        <Card testID="backup-undo-card">
          <Label variant="heading">{tr.backupSafety.undoTitle}</Label>
          <Label variant="muted">{tr.backupSafety.undoInfo(formatMoment(undo.createdAt))}</Label>
          {discardSure ? (
            <>
              <Label testID="backup-undo-discard-sure" style={{ color: c.danger }}>
                {tr.backupSafety.undoDiscardSure}
              </Label>
              <Button
                testID="backup-undo-discard-yes"
                kind="danger"
                title={tr.backupSafety.undoDiscardYes}
                onPress={discardUndo}
              />
              <Button
                testID="backup-undo-discard-no"
                kind="secondary"
                title={tr.backupSafety.replaceNo}
                onPress={() => setDiscardSure(false)}
              />
            </>
          ) : undoSure === null ? (
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
                onPress={() => setDiscardSure(true)}
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
        <LastBackupLabel testID="backup-last" note />
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
                {undoable
                  ? tr.backupSafety.replaceSureKeepsUndo(
                      replaceSure.sessions,
                      replaceSure.exams,
                      replaceSure.topics,
                      formatMoment(undo.createdAt),
                    )
                  : tr.backupSafety.replaceSure(replaceSure.sessions, replaceSure.exams, replaceSure.topics)}
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

      <Section title={tr.backup.csvTitle}>
        <Card>
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
      </Section>
    </Screen>
  );
}
