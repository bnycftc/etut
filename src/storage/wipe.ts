import { wipeDatabase } from './db';
import { exitDemo, isDemo } from './demo';
import { wipeKeyValueStore } from './kv';

/**
 * "Tüm verileri sil": sessions, mock exams, profile and the running timer. In demo mode it deletes
 * the example data only (leaves demo mode); the student's own data is not touched.
 */
export function wipeAllData(): void {
  if (isDemo()) {
    exitDemo();
    return;
  }
  wipeDatabase();
  wipeKeyValueStore();
}
