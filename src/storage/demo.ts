/**
 * Demo mode ("Örnek verilerle gez"): the app runs on example data in files of its own
 * (`etut-demo.db`, `etut-demo-kv`), so the student's own database and data keys are never read,
 * changed or deleted by it. The flag lives in the default kv-store, so a restart reopens the demo
 * files (`getDb` and `kvStore` read it on first use). Leaving demo mode deletes both demo files.
 */

import * as SQLite from 'expo-sqlite';

import { buildDemoData } from '../domain/demo-data';
import type { Profile } from '../domain/profile';
import { writeBackupData } from './backup';
import { closeDb, DEMO_DB_FILE, deleteDatabaseFile, REAL_DB_FILE, selectDatabaseFile } from './db';
import { loadActiveSession } from './kv';
import { closeDemoKvStore, DEMO_KV_FILE, isDemo, setDemoFlag } from './kv-store';

export { isDemo } from './kv-store';

export type EnterDemoResult = 'ok' | 'timer_running';

function deleteDemoFiles(): void {
  closeDemoKvStore();
  deleteDatabaseFile(DEMO_DB_FILE);
  try {
    SQLite.deleteDatabaseSync(DEMO_KV_FILE);
  } catch {
    // Not there (never opened): nothing to delete.
  }
}

/**
 * Switches to example data built for `profile` (its exam and area) at `now`. Refused while the
 * student's own timer runs (that session would be hidden behind the demo). In demo mode already,
 * the example data is built again from scratch.
 */
export function enterDemo(profile: Profile, now: number): EnterDemoResult {
  if (!isDemo() && loadActiveSession() !== null) return 'timer_running';
  // Fresh files: nothing left over from an earlier demo.
  selectDatabaseFile(DEMO_DB_FILE);
  deleteDemoFiles();
  setDemoFlag(true);
  try {
    writeBackupData(buildDemoData(profile, now));
  } catch (error) {
    exitDemo();
    throw error;
  }
  return 'ok';
}

/** Leaves demo mode: deletes the demo files and goes back to the student's own data. */
export function exitDemo(): void {
  closeDb();
  deleteDemoFiles();
  setDemoFlag(false);
  selectDatabaseFile(REAL_DB_FILE);
}
