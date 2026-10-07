/**
 * App-wide state: profile and the running study session. Thin glue between the pure domain
 * functions and on-device storage; holds no business rules of its own.
 */

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  type BackupCounts,
  backupCounts,
  type BackupData,
  type BackupFile,
  buildBackupFile,
  type ImportMode,
  importedProfile,
  mergeBackup,
  parseBackup,
  replaceUndoExpired,
  serializeBackup,
} from '../domain/backup';
import { canUndoFinish } from '../domain/finish';
import { istanbulYear } from '../domain/istanbul-day';
import type { YksArea } from '../domain/net';
import {
  canDeclareBirthYear,
  changeExam,
  type ExamType,
  guardRecordAfter,
  type Profile,
  refreshSoloFlag,
} from '../domain/profile';
import {
  type ActiveSession,
  capStudyTime,
  type CompletedSession,
  creditAway,
  dismissAway,
  finishSession,
  isPaused,
  markSeen,
  onAppBackground,
  onAppForeground,
  onAppLaunch,
  pauseSession,
  resumeSession,
  skipBreak,
  type StartOptions,
  startSession,
} from '../domain/timer';
import { loadYoungestDeclaredBirthYear, storeYoungestDeclaredBirthYear } from '../storage/age-guard';
import { readBackupData, writeBackupData } from '../storage/backup';
import { newId } from '../storage/db';
import {
  loadActiveSession,
  loadAwayRule,
  loadProfile,
  loadReplaceUndo,
  storeActiveSession,
  storeLastSubject,
  storeProfile,
  storeReplaceUndo,
} from '../storage/kv';
import { deleteSessionForUndo, saveSession } from '../storage/sessions';
import { wipeAllData } from '../storage/wipe';
import { flushPending, isSyncActive, stopSync, syncFinishedSession, syncPresence } from '../sync/session-sync';

export type SaveProfileResult = 'ok' | 'age_blocked';

/** What a `notifyDataChanged` call changed; screens that do not read it skip the reload. */
export type DataKind = 'sessions' | 'exams' | 'topics' | 'settings';
export type DataVersions = Record<DataKind, number>;

export interface FinishOptions {
  /** Save only this much study time (the student said a very long session was not all study). */
  maxStudyMs?: number;
}

interface AppStateValue {
  profile: Profile | null;
  /** Refuses a declaration that would raise the age above the K-17 record. */
  saveProfile: (profile: Profile) => SaveProfileResult;
  /** Changes only the exam and YKS area (never the declared birth year). `false` = incomplete. */
  updateExam: (examType: ExamType, yksArea: YksArea | null) => boolean;
  active: ActiveSession | null;
  start: (subjectId: string, options?: StartOptions) => void;
  pause: () => void;
  resume: () => void;
  skipBreak: () => void;
  finish: (options?: FinishOptions) => CompletedSession | null;
  /**
   * Takes back the last Bitir within the undo window (domain/finish.ts): the record is removed
   * and the session continues as it was. `false` = too late, or nothing to undo.
   */
  undoFinish: () => boolean;
  creditAway: () => void;
  dismissAway: () => void;
  /** Increases whenever stored sessions or mock exams change; screens reload on change. */
  dataVersion: number;
  /** The same per kind of data, for screens that read only some of it. */
  dataVersions: DataVersions;
  /** No `kind` = anything may have changed. */
  notifyDataChanged: (kind?: DataKind) => void;
  resetAll: () => void;
  /** Everything on this device as a backup file (nothing is written or sent). */
  createBackup: (appVersion: string) => BackupFile;
  /**
   * Writes the merged/replaced data and applies the K-17 profile rule. Before a replace, the data
   * on this device is kept as a copy for `undoReplace`.
   */
  importBackup: (file: BackupFile, mode: ImportMode) => BackupCounts;
  /** Puts back the data from before the last replace; `null` = no copy (or an unreadable one). */
  undoReplace: () => BackupCounts | null;
}

const AppStateContext = createContext<AppStateValue | null>(null);

/**
 * Keeps the K-17 record up to date: set for an under-15 declaration, removed once it no
 * longer means "under 15" (also covers profiles created before the record existed).
 */
function recordDeclaration(birthYear: number, currentYear: number): void {
  const previous = loadYoungestDeclaredBirthYear();
  const next = guardRecordAfter(previous, birthYear, currentYear);
  if (next !== previous) storeYoungestDeclaredBirthYear(next);
}

function initialProfile(): Profile | null {
  const stored = loadProfile();
  if (stored === null) {
    // No profile (e.g. after "delete all"): only drop a record that has expired.
    const record = loadYoungestDeclaredBirthYear();
    if (record !== null && guardRecordAfter(record, record, istanbulYear(Date.now())) === null) {
      storeYoungestDeclaredBirthYear(null);
    }
    return null;
  }
  recordDeclaration(stored.birthYear, istanbulYear(Date.now()));
  const refreshed = refreshSoloFlag(stored, istanbulYear(Date.now()));
  if (refreshed !== stored) storeProfile(refreshed);
  return refreshed;
}

const NO_CHANGES: DataVersions = { sessions: 0, exams: 0, topics: 0, settings: 0 };

/** How often a running timer records `lastSeenAt` (must stay below the 10 s tolerance). */
const HEARTBEAT_MS = 5_000;

/** A persisted session is judged on cold start too (killed in background or foreground). */
function initialActive(): ActiveSession | null {
  const stored = loadActiveSession();
  if (stored === null) return null;
  const next = onAppLaunch(stored, Date.now(), loadAwayRule());
  if (next !== stored) storeActiveSession(next);
  return next;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [active, setActiveState] = useState<ActiveSession | null>(initialActive);
  const [dataVersions, setDataVersions] = useState<DataVersions>(NO_CHANGES);
  const dataVersion = dataVersions.sessions + dataVersions.exams + dataVersions.topics + dataVersions.settings;
  const activeRef = useRef(active);
  const lastFinish = useRef<{ previous: ActiveSession; completed: CompletedSession; at: number } | null>(null);

  function setActive(next: ActiveSession | null) {
    if (next === activeRef.current) return;
    activeRef.current = next;
    setActiveState(next);
    storeActiveSession(next);
  }

  function update(fn: (s: ActiveSession) => ActiveSession) {
    const current = activeRef.current;
    if (current !== null) setActive(fn(current));
  }

  const notifyDataChanged = (kind?: DataKind) =>
    setDataVersions((v) =>
      kind === undefined
        ? { sessions: v.sessions + 1, exams: v.exams + 1, topics: v.topics + 1, settings: v.settings + 1 }
        : { ...v, [kind]: v[kind] + 1 },
    );

  // The copy kept for "Geri al" holds a full copy of the data: drop it once its day is over,
  // whether or not the backup screen is opened again.
  useEffect(() => {
    const undo = loadReplaceUndo();
    if (undo !== null && replaceUndoExpired(undo.createdAt, Date.now())) storeReplaceUndo(null);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      // 'inactive' (Control Center, notification shade, app switcher peek) is not "leaving".
      if (status === 'background') update((s) => onAppBackground(s, Date.now()));
      else if (status === 'active') {
        update((s) => onAppForeground(s, Date.now(), loadAwayRule()));
        flushPending();
      }
    });
    // Group module only (no-op otherwise): send sessions that were finished offline.
    flushPending();
    return () => subscription.remove();
  }, []);

  // Heartbeat: persisted only (ref + storage), no re-render; the UI never shows lastSeenAt.
  const running = active !== null && !isPaused(active);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const current = activeRef.current;
      if (current === null) return;
      const next = markSeen(current, Date.now());
      if (next !== current) {
        activeRef.current = next;
        storeActiveSession(next);
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [running]);

  // Live status for the group module (no-op unless it is on and an account exists).
  const activeId = active?.id ?? null;
  useEffect(() => {
    syncPresence(activeRef.current);
  }, [activeId, running]);

  const value: AppStateValue = {
    profile,
    saveProfile: (p) => {
      const year = istanbulYear(Date.now());
      if (!canDeclareBirthYear(p.birthYear, loadYoungestDeclaredBirthYear(), year)) {
        return 'age_blocked';
      }
      recordDeclaration(p.birthYear, year);
      storeProfile(p);
      setProfile(p);
      return 'ok';
    },
    updateExam: (examType, yksArea) => {
      const next = profile === null ? null : changeExam(profile, examType, yksArea);
      if (next === null) return false;
      storeProfile(next);
      setProfile(next);
      notifyDataChanged('settings');
      return true;
    },
    active,
    start: (subjectId, options) => {
      if (activeRef.current !== null) return;
      storeLastSubject(subjectId);
      setActive(startSession(newId(), subjectId, Date.now(), options));
    },
    pause: () => update((s) => pauseSession(s, Date.now())),
    resume: () => update((s) => resumeSession(s, Date.now())),
    skipBreak: () => update((s) => skipBreak(s, Date.now())),
    finish: (options) => {
      const current = activeRef.current;
      if (current === null) return null;
      const now = Date.now();
      const finished = finishSession(current, now);
      const completed = options?.maxStudyMs === undefined ? finished : capStudyTime(finished, options.maxStudyMs);
      if (completed.durationMs > 0) {
        saveSession(completed, now);
        syncFinishedSession(completed, now);
      }
      setActive(null);
      // Undo only while nothing left the device (group module off or no account).
      lastFinish.current = isSyncActive() ? null : { previous: current, completed, at: now };
      notifyDataChanged('sessions');
      return completed;
    },
    undoFinish: () => {
      const last = lastFinish.current;
      lastFinish.current = null;
      if (last === null || activeRef.current !== null || !canUndoFinish(last.at, Date.now())) return false;
      if (last.completed.durationMs > 0) deleteSessionForUndo(last.completed.id);
      // Fresh heartbeat: the seconds the summary was shown are not mistaken for time away.
      setActive(markSeen(last.previous, Date.now()));
      notifyDataChanged();
      return true;
    },
    creditAway: () => update(creditAway),
    dismissAway: () => update(dismissAway),
    dataVersion,
    dataVersions,
    notifyDataChanged,
    resetAll: () => {
      // No heartbeat or retry may outlive the data (and the group account) it belongs to.
      stopSync();
      wipeAllData();
      lastFinish.current = null;
      activeRef.current = null;
      setActiveState(null);
      setProfile(null);
      notifyDataChanged();
    },
    createBackup: (appVersion) => buildBackupFile(readBackupData(), profile, Date.now(), appVersion),
    importBackup: (file, mode) => {
      const current = readBackupData();
      if (mode === 'replace') {
        // Everything here is about to go: keep a copy on this device so "Geri al" can bring it back.
        const now = Date.now();
        storeReplaceUndo({ createdAt: now, text: serializeBackup(buildBackupFile(current, profile, now, '')) });
      }
      return importData(current, file, mode);
    },
    undoReplace: () => {
      const undo = loadReplaceUndo();
      if (undo === null) return null;
      // Our own copy: read back exactly, sessions with a wrong-clock time included.
      const parsed = parseBackup(undo.text, { keepWrongClockSessions: true });
      // An unreadable copy is kept (it may still be all there is); a used one is not.
      if (!parsed.ok) return null;
      const counts = importData(readBackupData(), parsed.file, 'replace');
      storeReplaceUndo(null);
      return counts;
    },
  };

  function importData(current: BackupData, file: BackupFile, mode: ImportMode): BackupCounts {
    const merged = mergeBackup(current, file, mode);
    writeBackupData(merged);
    if (profile !== null) {
      // K-17: the declared age can only stay or get younger; the record follows it.
      const year = istanbulYear(Date.now());
      const next = importedProfile(profile, file.profile, mode, year);
      recordDeclaration(next.birthYear, year);
      storeProfile(next);
      setProfile(next);
    }
    notifyDataChanged();
    return backupCounts(merged);
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (value === null) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

/**
 * Reads from storage once per `key` (e.g. `${day}|${dataVersion}`) and caches the result.
 * Storage reads are synchronous, so the new value is available in the same render.
 */
export function useStored<T>(key: string, load: () => T): T {
  const [cache, setCache] = useState(() => ({ key, value: load() }));
  if (cache.key !== key) {
    const value = load();
    setCache({ key, value });
    return value;
  }
  return cache.value;
}

/** Refresh interval of `useNow` when nothing is running (keeps "today" correct after midnight). */
const IDLE_REFRESH_MS = 60_000;

/**
 * Current time for rendering: every `intervalMs` while `fast`, otherwise once a minute, and
 * immediately whenever the app returns to the foreground.
 */
export function useNow(fast: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), fast ? intervalMs : IDLE_REFRESH_MS);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [fast, intervalMs]);
  return now;
}
