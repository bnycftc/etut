import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useState } from 'react';

import {
  BACKUP_MAX_BYTES,
  type BackupFile,
  backupCounts,
  backupFileName,
  type ImportMode,
  parseBackup,
  serializeBackup,
} from '@/domain/backup';
import { topicName } from '@/domain/curriculum';
import { type CsvLabels, examRows, sessionRows, toCsv } from '@/domain/csv';
import { istanbulDayKey } from '@/domain/istanbul-day';
import { useAppState } from '@/state/app-state';
import { readBackupData } from '@/storage/backup';
import { pickTextFile, type ShareResult, shareTextFile } from '@/storage/file-io';
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

/** Backup to a JSON file, restore from it (merge or replace), and CSV export. */
export default function BackupScreen() {
  const { createBackup, importBackup } = useAppState();
  const c = usePalette();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
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
      report(
        await shareTextFile(backupFileName(today), json, {
          mimeType: 'application/json',
          uti: 'public.json',
          dialogTitle: tr.backup.shareTitle,
        }),
        tr.backup.exported,
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
      setPending(parsed.file);
    });

  const confirmImport = () => {
    if (pending === null) return;
    setError(null);
    try {
      const counts = importBackup(pending, mode);
      setMessage(tr.backup.done(counts.sessions, counts.exams, counts.topics));
      setPending(null);
    } catch {
      setError(tr.backup.failed);
    }
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

      <Card>
        <Button testID="backup-export" title={tr.backup.export} disabled={busy} onPress={exportBackup} />
        <Button testID="backup-import" kind="secondary" title={tr.backup.import} disabled={busy} onPress={pick} />
      </Card>

      {pending !== null && preview !== null ? (
        <Card testID="backup-preview">
          <Label testID="backup-preview-counts">{tr.backup.picked(preview.sessions, preview.exams, preview.topics)}</Label>
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
          <Button
            testID="backup-confirm"
            kind={mode === 'replace' ? 'danger' : 'primary'}
            title={tr.backup.confirm}
            onPress={confirmImport}
          />
          <Button testID="backup-cancel" kind="secondary" title={tr.backup.cancel} onPress={() => setPending(null)} />
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
