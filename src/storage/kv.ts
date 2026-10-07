/**
 * Small synchronous key-value store (expo-sqlite/kv-store, no extra native module).
 * Used for state that must be readable before the first render: profile and the running timer.
 */

import * as SQLite from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

import type { DayKey } from '../domain/istanbul-day';
import type { LiveActivityRecord } from '../domain/live-timer';
import {
  DEFAULT_POMODORO,
  isPomodoroConfig,
  normalizePomodoroConfig,
  type PomodoroConfig,
} from '../domain/pomodoro';
import { type ExamType, isProfile, type Profile } from '../domain/profile';
import { normalizeReminderPrefs, type ReminderPrefs } from '../domain/reminders';
import { clampGoalMinutes } from '../domain/streak';
import { type ActiveSession, type AwayRule, toActiveSession } from '../domain/timer';

const KEYS = {
  profile: 'etut.profile.v1',
  activeSession: 'etut.activeSession.v1',
  lastSubject: 'etut.lastSubject.v1',
  dailyGoal: 'etut.dailyGoalMinutes.v1',
  pomodoroConfig: 'etut.pomodoroConfig.v1',
  timerMode: 'etut.timerMode.v1',
  examDate: 'etut.examDate.v1',
  netTargets: 'etut.netTargets.v1',
  tipsSeen: 'etut.tipsSeen.v1',
  reminderPrefs: 'etut.reminderPrefs.v1',
  remindersConfirmed: 'etut.remindersConfirmed.v1',
  liveActivity: 'etut.liveActivity.v1',
  keepAwake: 'etut.keepAwake.v1',
  awayRule: 'etut.awayRule.v1',
  replaceUndo: 'etut.replaceUndo.v1',
} as const;

export type TimerMode = 'stopwatch' | 'pomodoro';

function readJson(key: string): unknown {
  const raw = Storage.getItemSync(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadProfile(): Profile | null {
  const value = readJson(KEYS.profile);
  return isProfile(value) ? value : null;
}

export function storeProfile(profile: Profile): void {
  Storage.setItemSync(KEYS.profile, JSON.stringify(profile));
}

export function loadActiveSession(): ActiveSession | null {
  return toActiveSession(readJson(KEYS.activeSession));
}

export function storeActiveSession(session: ActiveSession | null): void {
  if (session === null) Storage.removeItemSync(KEYS.activeSession);
  else Storage.setItemSync(KEYS.activeSession, JSON.stringify(session));
}

export function loadLastSubject(): string | null {
  return Storage.getItemSync(KEYS.lastSubject);
}

export function storeLastSubject(subjectId: string): void {
  Storage.setItemSync(KEYS.lastSubject, subjectId);
}

/** Daily study goal in minutes; `null` = no goal. */
export function loadDailyGoal(): number | null {
  const value = readJson(KEYS.dailyGoal);
  return typeof value === 'number' && Number.isFinite(value) ? clampGoalMinutes(value) : null;
}

export function storeDailyGoal(minutes: number | null): void {
  if (minutes === null) Storage.removeItemSync(KEYS.dailyGoal);
  else Storage.setItemSync(KEYS.dailyGoal, JSON.stringify(clampGoalMinutes(minutes)));
}

export function loadPomodoroConfig(): PomodoroConfig {
  const value = readJson(KEYS.pomodoroConfig);
  return isPomodoroConfig(value) ? normalizePomodoroConfig(value) : DEFAULT_POMODORO;
}

export function storePomodoroConfig(config: PomodoroConfig): void {
  Storage.setItemSync(KEYS.pomodoroConfig, JSON.stringify(normalizePomodoroConfig(config)));
}

export function loadTimerMode(): TimerMode {
  return Storage.getItemSync(KEYS.timerMode) === 'pomodoro' ? 'pomodoro' : 'stopwatch';
}

export function storeTimerMode(mode: TimerMode): void {
  Storage.setItemSync(KEYS.timerMode, mode);
}

/** Exam date set by the student, per exam type (overrides the built-in estimate). */
export function loadCustomExamDate(examType: ExamType): DayKey | null {
  const value = readJson(KEYS.examDate);
  if (typeof value !== 'object' || value === null) return null;
  const day = (value as Record<string, unknown>)[examType];
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function storeCustomExamDate(examType: ExamType, day: DayKey | null): void {
  const current = readJson(KEYS.examDate);
  const next: Record<string, unknown> =
    typeof current === 'object' && current !== null ? { ...(current as Record<string, unknown>) } : {};
  if (day === null) delete next[examType];
  else next[examType] = day;
  Storage.setItemSync(KEYS.examDate, JSON.stringify(next));
}

/** Target nets keyed by `targetKey(kind, sectionId)`. */
export function loadNetTargets(): Record<string, number> {
  const value = readJson(KEYS.netTargets);
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function storeNetTarget(key: string, target: number | null): void {
  const next = loadNetTargets();
  if (target === null) delete next[key];
  else next[key] = target;
  Storage.setItemSync(KEYS.netTargets, JSON.stringify(next));
}

/** Replaces every target net (backup restore). */
export function storeNetTargets(targets: Record<string, number>): void {
  Storage.setItemSync(KEYS.netTargets, JSON.stringify(targets));
}

/** Pomodoro lengths as stored; `null` = never changed (the defaults apply). */
export function loadStoredPomodoroConfig(): PomodoroConfig | null {
  const value = readJson(KEYS.pomodoroConfig);
  return isPomodoroConfig(value) ? normalizePomodoroConfig(value) : null;
}

/** Timer mode as stored; `null` = never chosen. */
export function loadStoredTimerMode(): TimerMode | null {
  const value = Storage.getItemSync(KEYS.timerMode);
  return value === 'pomodoro' || value === 'stopwatch' ? value : null;
}

/** `null` removes the stored values (backup restore). */
export function restoreTimerSettings(mode: TimerMode | null, pomodoro: PomodoroConfig | null): void {
  if (mode === null) Storage.removeItemSync(KEYS.timerMode);
  else Storage.setItemSync(KEYS.timerMode, mode);
  if (pomodoro === null) Storage.removeItemSync(KEYS.pomodoroConfig);
  else storePomodoroConfig(pomodoro);
}

export function clearLastSubject(): void {
  Storage.removeItemSync(KEYS.lastSubject);
}

/** The short first-use tips were shown and closed. */
export function loadTipsSeen(): boolean {
  return Storage.getItemSync(KEYS.tipsSeen) === '1';
}

export function storeTipsSeen(): void {
  Storage.setItemSync(KEYS.tipsSeen, '1');
}

export function loadReminderPrefs(): ReminderPrefs {
  return normalizeReminderPrefs(readJson(KEYS.reminderPrefs));
}

export function storeReminderPrefs(prefs: ReminderPrefs): void {
  Storage.setItemSync(KEYS.reminderPrefs, JSON.stringify(normalizeReminderPrefs(prefs)));
}

/** The student turned reminders on through the explanation screen (cleared by "Tüm verileri sil"). */
export function loadRemindersConfirmed(): boolean {
  return readJson(KEYS.remindersConfirmed) === true;
}

export function storeRemindersConfirmed(): void {
  Storage.setItemSync(KEYS.remindersConfirmed, 'true');
}

/** The Live Activity the app last started (iOS); `null` = none. */
export function loadLiveActivityRecord(): LiveActivityRecord | null {
  const value = readJson(KEYS.liveActivity);
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.sessionId !== 'string' || typeof v.startedAt !== 'number') return null;
  return v.dismissed === true
    ? { sessionId: v.sessionId, startedAt: v.startedAt, dismissed: true }
    : { sessionId: v.sessionId, startedAt: v.startedAt };
}

export function storeLiveActivityRecord(record: LiveActivityRecord | null): void {
  if (record === null) Storage.removeItemSync(KEYS.liveActivity);
  else Storage.setItemSync(KEYS.liveActivity, JSON.stringify(record));
}

/** Keep the screen on while the timer runs on the timer screen (default on). */
export function loadKeepAwake(): boolean {
  return Storage.getItemSync(KEYS.keepAwake) !== '0';
}

export function storeKeepAwake(on: boolean): void {
  Storage.setItemSync(KEYS.keepAwake, on ? '1' : '0');
}

/** What leaving the app while the timer runs means; default 'ask'. */
export function loadAwayRule(): AwayRule {
  return Storage.getItemSync(KEYS.awayRule) === 'count' ? 'count' : 'ask';
}

export function storeAwayRule(rule: AwayRule): void {
  Storage.setItemSync(KEYS.awayRule, rule);
}

/** Copy of this device's data taken right before a "Değiştir" restore (for "Geri al"). */
export interface ReplaceUndo {
  createdAt: number;
  /** The data as a backup file (`serializeBackup`). */
  text: string;
}

export function loadReplaceUndo(): ReplaceUndo | null {
  const value = readJson(KEYS.replaceUndo);
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  return typeof v.createdAt === 'number' && typeof v.text === 'string' ? { createdAt: v.createdAt, text: v.text } : null;
}

export function storeReplaceUndo(undo: ReplaceUndo | null): void {
  if (undo === null) Storage.removeItemSync(KEYS.replaceUndo);
  else Storage.setItemSync(KEYS.replaceUndo, JSON.stringify(undo));
}

/** expo-sqlite/kv-store keeps its rows in this database file (expo-sqlite src/Storage.ts). */
const KV_DB_NAME = 'ExpoSQLiteStorage';

/** Deletes every key and compacts the kv-store file so deleted values do not linger on disk. */
export function wipeKeyValueStore(): void {
  Storage.clearSync();
  // Compaction is best effort: the rows are already deleted at this point.
  try {
    // A separate native connection, so closing it cannot close the one kv-store keeps open.
    const kvDb = SQLite.openDatabaseSync(KV_DB_NAME, { useNewConnection: true });
    try {
      kvDb.execSync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
    } finally {
      kvDb.closeSync();
    }
  } catch {
    // Ignore: a locked file only means the free pages are reused later instead of now.
  }
}
