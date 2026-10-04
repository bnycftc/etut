import { wipeDatabase } from './db';
import { wipeKeyValueStore } from './kv';

/** "Tüm verileri sil": sessions, mock exams, profile and the running timer. */
export function wipeAllData(): void {
  wipeDatabase();
  wipeKeyValueStore();
}
