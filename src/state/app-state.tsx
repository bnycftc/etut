/**
 * App-wide state: profile and the running study session. Thin glue between the pure domain
 * functions and on-device storage; holds no business rules of its own.
 */

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { istanbulYear } from '../domain/istanbul-day';
import { type Profile, refreshSoloFlag } from '../domain/profile';
import {
  type ActiveSession,
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
  startSession,
} from '../domain/timer';
import { newId } from '../storage/db';
import {
  loadActiveSession,
  loadProfile,
  storeActiveSession,
  storeLastSubject,
  storeProfile,
} from '../storage/kv';
import { saveSession } from '../storage/sessions';
import { wipeAllData } from '../storage/wipe';

interface AppStateValue {
  profile: Profile | null;
  saveProfile: (profile: Profile) => void;
  active: ActiveSession | null;
  start: (subjectId: string) => void;
  pause: () => void;
  resume: () => void;
  finish: () => CompletedSession | null;
  creditAway: () => void;
  dismissAway: () => void;
  /** Increases whenever stored sessions or mock exams change; screens reload on change. */
  dataVersion: number;
  notifyDataChanged: () => void;
  resetAll: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function initialProfile(): Profile | null {
  const stored = loadProfile();
  if (stored === null) return null;
  const refreshed = refreshSoloFlag(stored, istanbulYear(Date.now()));
  if (refreshed !== stored) storeProfile(refreshed);
  return refreshed;
}

/** How often a running timer records `lastSeenAt` (must stay below the 10 s tolerance). */
const HEARTBEAT_MS = 5_000;

/** A persisted session is judged on cold start too (killed in background or foreground). */
function initialActive(): ActiveSession | null {
  const stored = loadActiveSession();
  if (stored === null) return null;
  const next = onAppLaunch(stored, Date.now());
  if (next !== stored) storeActiveSession(next);
  return next;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [active, setActiveState] = useState<ActiveSession | null>(initialActive);
  const [dataVersion, setDataVersion] = useState(0);
  const activeRef = useRef(active);

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

  const notifyDataChanged = () => setDataVersion((v) => v + 1);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      // 'inactive' (Control Center, notification shade, app switcher peek) is not "leaving".
      if (status === 'background') update((s) => onAppBackground(s, Date.now()));
      else if (status === 'active') update((s) => onAppForeground(s, Date.now()));
    });
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

  const value: AppStateValue = {
    profile,
    saveProfile: (p) => {
      storeProfile(p);
      setProfile(p);
    },
    active,
    start: (subjectId) => {
      if (activeRef.current !== null) return;
      storeLastSubject(subjectId);
      setActive(startSession(newId(), subjectId, Date.now()));
    },
    pause: () => update((s) => pauseSession(s, Date.now())),
    resume: () => update((s) => resumeSession(s, Date.now())),
    finish: () => {
      const current = activeRef.current;
      if (current === null) return null;
      const now = Date.now();
      const completed = finishSession(current, now);
      if (completed.durationMs > 0) saveSession(completed, now);
      setActive(null);
      notifyDataChanged();
      return completed;
    },
    creditAway: () => update(creditAway),
    dismissAway: () => update(dismissAway),
    dataVersion,
    notifyDataChanged,
    resetAll: () => {
      wipeAllData();
      activeRef.current = null;
      setActiveState(null);
      setProfile(null);
      notifyDataChanged();
    },
  };

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
