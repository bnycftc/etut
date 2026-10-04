/**
 * K-17 age-declaration record. Lives in its own kv-store database file, which "Tüm verileri
 * sil" deliberately does not touch, so that deleting the data cannot be used to raise a
 * declared age. Holds a single number: the latest birth year ever declared on this device
 * (= the youngest age). Never leaves the device; removed only by uninstalling the app.
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

export function storeYoungestDeclaredBirthYear(birthYear: number): void {
  guard().setItemSync(KEY, String(birthYear));
}
