/**
 * K-17 age-declaration record. Lives in its own kv-store database file, which "Tüm verileri
 * sil" deliberately does not touch, so that deleting the data cannot be used to raise a
 * declared age. Holds a single number, and only after an under-15 declaration: that birth year
 * (the youngest one declared). It is removed as soon as it no longer means "under 15"
 * (`guardRecordAfter`), and by uninstalling the app. Never leaves the device.
 */

import { SQLiteStorage } from 'expo-sqlite/kv-store';

const GUARD_DB_NAME = 'EtutAgeGuard';
const KEY = 'youngestBirthYear';

let store: SQLiteStorage | null = null;

function guard(): SQLiteStorage {
  if (store === null) store = new SQLiteStorage(GUARD_DB_NAME);
  return store;
}

export function loadYoungestDeclaredBirthYear(): number | null {
  const raw = guard().getItemSync(KEY);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(value) ? value : null;
}

/** `null` removes the record. */
export function storeYoungestDeclaredBirthYear(birthYear: number | null): void {
  if (birthYear === null) guard().removeItemSync(KEY);
  else guard().setItemSync(KEY, String(birthYear));
}
