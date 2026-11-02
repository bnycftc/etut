/**
 * Which key-value store holds the student's data: the default expo-sqlite/kv-store file, or a
 * separate file while the app shows example data (demo mode, `storage/demo.ts`). The demo flag
 * itself always lives in the default store, so it survives a restart and is the one thing demo
 * mode writes outside its own files.
 */

import Storage, { SQLiteStorage } from 'expo-sqlite/kv-store';

/** kv-store database file of demo mode (deleted when demo mode ends). */
export const DEMO_KV_FILE = 'etut-demo-kv';

const DEMO_FLAG_KEY = 'etut.demoMode.v1';

/** Cached flag (read once from the default store). */
let demoFlag: boolean | null = null;
let demoStorage: SQLiteStorage | null = null;

/** True while the app shows example data instead of the student's own. */
export function isDemo(): boolean {
  if (demoFlag === null) demoFlag = Storage.getItemSync(DEMO_FLAG_KEY) === '1';
  return demoFlag;
}

/** Sets or clears the flag in the default store (only `storage/demo.ts` calls this). */
export function setDemoFlag(on: boolean): void {
  if (on) Storage.setItemSync(DEMO_FLAG_KEY, '1');
  else Storage.removeItemSync(DEMO_FLAG_KEY);
  demoFlag = on;
}

/** The demo store, opened on first use. */
export function demoKvStore(): SQLiteStorage {
  if (demoStorage === null) demoStorage = new SQLiteStorage(DEMO_KV_FILE);
  return demoStorage;
}

/** Closes the demo store's database file, so it can be deleted. */
export function closeDemoKvStore(): void {
  if (demoStorage === null) return;
  try {
    demoStorage.closeSync();
  } finally {
    demoStorage = null;
  }
}

/** Store for the student's data: the demo file in demo mode, else the default store. */
export function kvStore(): SQLiteStorage {
  return isDemo() ? demoKvStore() : Storage;
}
