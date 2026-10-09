/**
 * CSV export of study sessions and mock exams (KVKK m.11 data portability: a common,
 * machine-readable format). Semicolon separated with a UTF-8 BOM and decimal commas, which is
 * what spreadsheet programs expect for Turkish settings. Column titles and display names are
 * passed in by the caller (they live in strings.ts).
 */

import { blankCount } from './exam-analysis';
import { ISTANBUL_OFFSET_MS, istanbulDayKey } from './istanbul-day';
import { net } from './net';
import { normalizeQuestions } from './questions';
import type { BackupExam } from './backup';
import type { CompletedSession } from './timer';

export const CSV_SEPARATOR = ';';
export const CSV_BOM = '﻿';

export type CsvValue = string | number | null;

/**
 * One field. Text that starts like a spreadsheet formula (`=`, `+`, `-`, `@`, tab, CR) gets a
 * leading apostrophe so that opening the file can not run it; numbers are written as they are.
 * Fields with the separator, quotes or line breaks are quoted, inner quotes doubled.
 */
export function csvField(value: CsvValue): string {
  if (value === null) return '';
  let text: string;
  if (typeof value === 'number') {
    text = Number.isFinite(value) ? String(value).replace('.', ',') : '';
  } else {
    text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header + rows → CSV text with BOM and CRLF line ends (RFC 4180). */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/** `2026-10-04 14:05` in Istanbul time. */
export function istanbulDateTime(ms: number): string {
  const d = new Date(ms + ISTANBUL_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${istanbulDayKey(ms)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export interface CsvLabels {
  subject: (id: string) => string;
  /** Topic display name; unknown ids may return the id. */
  topic: (id: string) => string;
  source: (source: CompletedSession['source']) => string;
  examKind: (kind: BackupExam['kind']) => string;
  scope: (scope: BackupExam['scope']) => string;
  yesNo: (value: boolean) => string;
}

/**
 * Columns: day, start, end, subject, topic, source, study minutes, study seconds, solved questions
 * (empty when not given).
 */
export function sessionRows(sessions: readonly CompletedSession[], labels: CsvLabels): CsvValue[][] {
  return [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => [
      istanbulDayKey(s.startedAt),
      istanbulDateTime(s.startedAt),
      istanbulDateTime(s.endedAt),
      labels.subject(s.subjectId),
      s.topicId === null ? null : labels.topic(s.topicId),
      labels.source(s.source),
      Math.floor(s.durationMs / 60_000),
      Math.floor(s.durationMs / 1000),
      normalizeQuestions(s.questions),
    ]);
}

/**
 * One row per exam section. Columns: day, paper, type, section, questions, correct, wrong,
 * blank, net, exam total net, analysis done.
 */
export function examRows(exams: readonly BackupExam[], labels: CsvLabels): CsvValue[][] {
  return [...exams]
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.createdAt - b.createdAt)
    .flatMap((e) => {
      const total = e.scores.reduce((sum, s) => sum + net(s.correct, s.wrong, e.kind), 0);
      return e.scores.map((s) => [
        e.takenOn,
        labels.examKind(e.kind),
        labels.scope(e.scope),
        labels.subject(s.sectionId),
        s.questions,
        s.correct,
        s.wrong,
        blankCount(s),
        net(s.correct, s.wrong, e.kind),
        total,
        labels.yesNo(e.analysisDoneAt !== null),
      ]);
    });
}
