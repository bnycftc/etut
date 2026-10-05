/**
 * Backup file ("yedek"): every piece of on-device data in one versioned JSON document, so that a
 * phone change does not lose the data (there is no server). Pure rules only: the file format,
 * validation, version compatibility, merging and the K-17 age rule on import. Reading and writing
 * the database is in `storage/backup.ts`, the file itself never leaves the device unless the
 * student shares it.
 *
 * Import guarantees:
 * - All or nothing: one invalid record rejects the whole file (nothing is written).
 * - Idempotent: records are keyed by their ids, so importing the same file twice leaves the same
 *   data as importing it once (no duplicate sessions or exams).
 * - K-17: the age can not be raised by a file. If the file's birth year is a younger age than the
 *   one on this device, the younger one (later year) is kept; never the older one. A year the
 *   birth-year picker could not offer (younger than its minimum age) is ignored.
 * - Everything this app wrote reads back: the checks reject only what the app can not produce.
 */

import { type TopicMark, validateSectionMarks } from './exam-analysis';
import type { DayKey } from './istanbul-day';
import { EXAM_KINDS, EXAM_SECTIONS, type ExamKind, type ExamScope, type SectionScore, validateScore, type YksArea } from './net';
import { isPomodoroConfig, normalizePomodoroConfig, type PomodoroConfig } from './pomodoro';
import { birthYearOptions, EXAM_TYPES, type ExamType, isSoloOnly, type Profile, YKS_AREAS } from './profile';
import { clampGoalMinutes } from './streak';
import type { ClosedPause, CompletedSession, PauseKind } from './timer';
import { isTopicStatus, type TopicStatus } from './topics';

export const BACKUP_FORMAT = 'etut-yedek';
/** Bump when the file layout changes; add an upgrade step in `upgrade()` for the old one. */
export const BACKUP_SCHEMA_VERSION = 1;
/** Larger files are refused before parsing (years of daily use stay far below this). */
export const BACKUP_MAX_BYTES = 20 * 1024 * 1024;

const MAX_RECORDS = 200_000;
const MAX_PAUSES = 5_000;
/**
 * Time bounds instead of a session-length limit. No record of this app is older than this (a
 * device clock reset to 1970 aside), and no file was written after 2100. A session ends at most a
 * day after the file was written (the tolerance covers a clock corrected between the two): a far
 * future end would make every daily total walk day by day up to it.
 */
const MIN_TIME = Date.UTC(2016, 0, 1);
const MAX_TIME = Date.UTC(2100, 0, 1);
const END_TOLERANCE_MS = 24 * 3_600_000;

export type TimerModeSetting = 'stopwatch' | 'pomodoro';

export interface BackupSettings {
  /** Daily goal in minutes; `null` = no goal. */
  dailyGoalMinutes: number | null;
  pomodoro: PomodoroConfig | null;
  timerMode: TimerModeSetting | null;
  /** Exam dates set by the student, per exam type. */
  examDates: Partial<Record<ExamType, DayKey>>;
  /** Target nets keyed by `targetKey(kind, sectionId)`. */
  netTargets: Record<string, number>;
  lastSubject: string | null;
}

export interface BackupExam {
  id: string;
  kind: ExamKind;
  scope: ExamScope;
  bransSectionId: string | null;
  takenOn: DayKey;
  createdAt: number;
  analysisDoneAt: number | null;
  scores: SectionScore[];
  marks: TopicMark[];
}

export interface BackupTopicProgress {
  topicId: string;
  status: TopicStatus;
  updatedAt: number;
}

/** Everything that is restored as data (the profile is handled by `importedProfile`). */
export interface BackupData {
  sessions: CompletedSession[];
  exams: BackupExam[];
  topicProgress: BackupTopicProgress[];
  settings: BackupSettings;
}

export interface BackupProfile {
  birthYear: number;
  examType: ExamType;
  yksArea: YksArea | null;
}

export interface BackupFile extends BackupData {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  /** ms since epoch. */
  exportedAt: number;
  appVersion: string;
  profile: BackupProfile | null;
}

export type ImportMode = 'merge' | 'replace';
export type BackupError = 'too_large' | 'not_json' | 'not_backup' | 'too_new' | 'invalid';
export type ParseResult = { ok: true; file: BackupFile } | { ok: false; error: BackupError };

export const EMPTY_SETTINGS: BackupSettings = {
  dailyGoalMinutes: null,
  pomodoro: null,
  timerMode: null,
  examDates: {},
  netTargets: {},
  lastSubject: null,
};

export function buildBackupFile(
  data: BackupData,
  profile: Profile | null,
  exportedAt: number,
  appVersion: string,
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    appVersion,
    profile:
      profile === null
        ? null
        : { birthYear: profile.birthYear, examType: profile.examType, yksArea: profile.yksArea },
    ...data,
  };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file);
}

/** `etut-yedek-2026-10-04.json` */
export function backupFileName(today: DayKey): string {
  return `etut-yedek-${today}.json`;
}

// ---------------------------------------------------------------------------------------------
// Validation

class Invalid extends Error {}

function fail(): never {
  throw new Invalid();
}

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : fail();
}

function arr(v: unknown, max = MAX_RECORDS): unknown[] {
  return Array.isArray(v) && v.length <= max ? v : fail();
}

function int(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail();
}

function intOrNull(v: unknown, min = 0): number | null {
  return v === null || v === undefined ? null : int(v, min);
}

function str(v: unknown, pattern: RegExp, maxLength = 120): string {
  return typeof v === 'string' && v.length <= maxLength && pattern.test(v) ? v : fail();
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fail();
}

/** Ids made by `newId()` and curriculum topic ids: ASCII letters, digits, `.`, `_`, `-`. */
const ID = /^[A-Za-z0-9._-]+$/;
const SUBJECT = /^[a-z0-9_]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PAUSE_KINDS: readonly PauseKind[] = ['manual', 'away', 'break'];

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) fail();
    seen.add(k);
  }
  return items;
}

function parseSession(value: unknown, exportedAt: number): CompletedSession {
  const v = obj(value);
  const startedAt = int(v.startedAt, MIN_TIME);
  // No limit on the span: a paused timer left for a week and then finished is a session of this
  // app (`finishSession` does not cap it), so its own backup must read it back. The end is bounded
  // by the time the file was written instead (`END_TOLERANCE_MS`).
  const endedAt = int(v.endedAt, startedAt, exportedAt + END_TOLERANCE_MS);
  // Pauses only shorten a session, so out-of-range ones are clipped to it instead of rejected.
  const clip = (n: number, min: number) => Math.min(endedAt, Math.max(min, n));
  const pauses: ClosedPause[] = arr(v.pauses, MAX_PAUSES).map((p) => {
    const q = obj(p);
    const start = clip(int(q.start), startedAt);
    return {
      start,
      end: clip(int(q.end), start),
      kind: q.kind === undefined ? 'manual' : oneOf(q.kind, PAUSE_KINDS),
    };
  });
  return {
    id: str(v.id, ID, 64),
    subjectId: str(v.subjectId, SUBJECT, 40),
    topicId: v.topicId === null || v.topicId === undefined ? null : str(v.topicId, ID),
    startedAt,
    endedAt,
    pauses,
    durationMs: int(v.durationMs, 0, endedAt - startedAt),
    source: oneOf(v.source, ['timer', 'manual'] as const),
  };
}

function parseExam(value: unknown): BackupExam {
  const v = obj(value);
  const kind = oneOf(v.kind, EXAM_KINDS);
  const scope = oneOf(v.scope, ['genel', 'brans'] as const);
  const sections = EXAM_SECTIONS[kind];
  const bransSectionId =
    scope === 'brans' ? oneOf(v.bransSectionId, sections.map((s) => s.id)) : v.bransSectionId == null ? null : fail();
  const scores: SectionScore[] = unique(
    arr(v.scores, sections.length).map((s) => {
      const q = obj(s);
      const section = sections.find((x) => x.id === q.sectionId) ?? fail();
      const score = { sectionId: section.id, questions: int(q.questions), correct: int(q.correct), wrong: int(q.wrong) };
      if (score.questions !== section.questions || validateScore(score) !== null) fail();
      return score;
    }),
    (s) => s.sectionId,
  );
  const expected = scope === 'genel' ? sections.map((s) => s.id) : [bransSectionId];
  if (scores.length !== expected.length || !scores.every((s) => expected.includes(s.sectionId))) fail();
  const marks: TopicMark[] = unique(
    arr(v.marks ?? []).map((m) => {
      const q = obj(m);
      const sectionId = scores.find((s) => s.sectionId === q.sectionId)?.sectionId ?? fail();
      return { sectionId, topicId: str(q.topicId, ID), wrong: int(q.wrong), blank: int(q.blank) };
    }),
    (m) => `${m.sectionId}|${m.topicId}`,
  );
  if (scores.some((s) => validateSectionMarks(s, marks) !== null)) fail();
  return {
    id: str(v.id, ID, 64),
    kind,
    scope,
    bransSectionId,
    takenOn: str(v.takenOn, DAY, 10),
    createdAt: int(v.createdAt),
    analysisDoneAt: intOrNull(v.analysisDoneAt),
    scores,
    marks,
  };
}

function parseTopicProgress(value: unknown): BackupTopicProgress {
  const v = obj(value);
  if (!isTopicStatus(v.status)) fail();
  return { topicId: str(v.topicId, ID), status: v.status, updatedAt: int(v.updatedAt) };
}

function parseNetTargets(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, target] of Object.entries(obj(value ?? {}))) {
    const [kind, sectionId, extra] = key.split(':');
    if (extra !== undefined) fail();
    const section = EXAM_SECTIONS[oneOf(kind, EXAM_KINDS)].find((s) => s.id === sectionId) ?? fail();
    if (typeof target !== 'number' || !(target > 0) || target > section.questions || target * 4 !== Math.round(target * 4)) {
      fail();
    }
    out[key] = target;
  }
  return out;
}

function parseSettings(value: unknown): BackupSettings {
  const v = obj(value ?? {});
  const examDates: Partial<Record<ExamType, DayKey>> = {};
  for (const [type, day] of Object.entries(obj(v.examDates ?? {}))) {
    examDates[oneOf(type, EXAM_TYPES)] = str(day, DAY, 10);
  }
  const goal = v.dailyGoalMinutes;
  return {
    dailyGoalMinutes:
      goal === null || goal === undefined ? null : clampGoalMinutes(int(goal, 1, 24 * 60)),
    pomodoro:
      v.pomodoro === null || v.pomodoro === undefined
        ? null
        : isPomodoroConfig(v.pomodoro)
          ? normalizePomodoroConfig(v.pomodoro)
          : fail(),
    timerMode:
      v.timerMode === null || v.timerMode === undefined ? null : oneOf(v.timerMode, ['stopwatch', 'pomodoro'] as const),
    examDates,
    netTargets: parseNetTargets(v.netTargets),
    lastSubject: v.lastSubject === null || v.lastSubject === undefined ? null : str(v.lastSubject, SUBJECT, 40),
  };
}

function parseProfile(value: unknown): BackupProfile | null {
  if (value === null || value === undefined) return null;
  const v = obj(value);
  const examType = oneOf(v.examType, EXAM_TYPES);
  const yksArea = examType === 'YKS' ? oneOf(v.yksArea, YKS_AREAS) : null;
  return { birthYear: int(v.birthYear, 1900, 2200), examType, yksArea };
}

/** Older layouts are upgraded here, one step per version (none yet: version 1 is the first). */
function upgrade(file: Obj, version: number): Obj {
  if (version !== BACKUP_SCHEMA_VERSION) fail();
  return file;
}

/** Text of a picked file → a validated backup, or why it can not be imported. */
export function parseBackup(text: string): ParseResult {
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, error: 'too_large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return { ok: false, error: 'not_json' };
  }
  if (typeof raw !== 'object' || raw === null || (raw as Obj).format !== BACKUP_FORMAT) {
    return { ok: false, error: 'not_backup' };
  }
  const version = (raw as Obj).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'invalid' };
  }
  if (version > BACKUP_SCHEMA_VERSION) return { ok: false, error: 'too_new' };
  try {
    const v = upgrade(raw as Obj, version);
    const exportedAt = int(v.exportedAt, MIN_TIME, MAX_TIME);
    const file: BackupFile = {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt,
      appVersion: typeof v.appVersion === 'string' ? v.appVersion.slice(0, 40) : '',
      profile: parseProfile(v.profile),
      sessions: unique(arr(v.sessions).map((s) => parseSession(s, exportedAt)), (s) => s.id),
      exams: unique(arr(v.exams).map(parseExam), (e) => e.id),
      topicProgress: unique(arr(v.topicProgress).map(parseTopicProgress), (t) => t.topicId),
      settings: parseSettings(v.settings),
    };
    return { ok: true, file };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: 'invalid' };
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Merging

function byId<T>(current: T[], incoming: T[], key: (item: T) => string): T[] {
  const have = new Set(current.map(key));
  return [...current, ...incoming.filter((item) => !have.has(key(item)))];
}

/**
 * The data to keep after importing `incoming` into `current`.
 * - `replace`: exactly the file's data (this device's sessions, exams, topics and settings go).
 * - `merge`: this device wins wherever both have the same record (same id, same topic, a setting
 *   that is set here); records and settings only the file has are added. A setting that is empty
 *   here (no daily goal, no own exam date) is filled from the file, the merge text says so
 *   (`tr.backup.mergeInfo`). Topic progress keeps the newer mark. Applying the same file again
 *   changes nothing.
 */
export function mergeBackup(current: BackupData, incoming: BackupData, mode: ImportMode): BackupData {
  if (mode === 'replace') {
    return {
      sessions: incoming.sessions,
      exams: incoming.exams,
      topicProgress: incoming.topicProgress,
      settings: incoming.settings,
    };
  }
  const progress = new Map(current.topicProgress.map((t) => [t.topicId, t]));
  for (const t of incoming.topicProgress) {
    const mine = progress.get(t.topicId);
    if (mine === undefined || t.updatedAt > mine.updatedAt) progress.set(t.topicId, t);
  }
  const c = current.settings;
  const i = incoming.settings;
  return {
    sessions: byId(current.sessions, incoming.sessions, (s) => s.id),
    exams: byId(current.exams, incoming.exams, (e) => e.id),
    topicProgress: [...progress.values()],
    settings: {
      dailyGoalMinutes: c.dailyGoalMinutes ?? i.dailyGoalMinutes,
      pomodoro: c.pomodoro ?? i.pomodoro,
      timerMode: c.timerMode ?? i.timerMode,
      examDates: { ...i.examDates, ...c.examDates },
      netTargets: { ...i.netTargets, ...c.netTargets },
      lastSubject: c.lastSubject ?? i.lastSubject,
    },
  };
}

/**
 * K-17. The profile after an import: the age declared on this device can only stay or become
 * younger. The file's birth year is used only when it is a younger age (a later year) that the
 * birth-year picker offers in `currentYear`; any other year in the file (e.g. 2200 in an edited
 * file, which would lock the age guard for decades) is ignored. The solo flag (under 15 → no
 * group features) is never switched off by an import. `replace` also takes the file's exam and
 * area (they are settings, not age data); `merge` keeps this device's.
 */
export function importedProfile(
  device: Profile,
  incoming: BackupProfile | null,
  mode: ImportMode,
  currentYear: number,
): Profile {
  const fileYear =
    incoming !== null && birthYearOptions(currentYear).includes(incoming.birthYear) ? incoming.birthYear : null;
  const birthYear = fileYear === null ? device.birthYear : Math.max(device.birthYear, fileYear);
  const exam = mode === 'replace' && incoming !== null ? incoming : device;
  return {
    birthYear,
    examType: exam.examType,
    yksArea: exam.examType === 'YKS' ? exam.yksArea : null,
    soloOnly: device.soloOnly || isSoloOnly(birthYear, currentYear),
    createdAt: device.createdAt,
  };
}

export interface BackupCounts {
  sessions: number;
  exams: number;
  topics: number;
}

export function backupCounts(data: BackupData): BackupCounts {
  return { sessions: data.sessions.length, exams: data.exams.length, topics: data.topicProgress.length };
}
