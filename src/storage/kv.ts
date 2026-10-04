/**
 * Small synchronous key-value store (expo-sqlite/kv-store, no extra native module).
 * Used for state that must be readable before the first render: profile and the running timer.
 */

import * as SQLite from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

import { type ActiveSession, isActiveSession } from '../domain/timer';
import { isProfile, type Profile } from '../domain/profile';

const KEYS = {
  profile: 'etut.profile.v1',
  activeSession: 'etut.activeSession.v1',
  lastSubject: 'etut.lastSubject.v1',
} as const;

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
  const value = readJson(KEYS.activeSession);
  return isActiveSession(value) ? value : null;
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
