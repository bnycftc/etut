/**
 * Small local state of the group module (expo-sqlite/kv-store). Cleared with every other key by
 * "Tüm verileri sil" (kv.ts wipeKeyValueStore → Storage.clearSync).
 */

import Storage from 'expo-sqlite/kv-store';

import type { DayKey } from '../domain/istanbul-day';

const KEYS = {
  account: 'etut.groups.account.v1',
  parent: 'etut.groups.parent.v1',
  usage: 'etut.groups.usage.v1',
} as const;

/** True once this device created a group profile on the server (until the account is deleted). */
export function loadGroupsAccount(): boolean {
  return Storage.getItemSync(KEYS.account) === '1';
}

export function storeGroupsAccount(on: boolean): void {
  if (on) Storage.setItemSync(KEYS.account, '1');
  else Storage.removeItemSync(KEYS.account);
}

/** True once this device linked to a student in parent mode (a server account without profile). */
export function loadParentAccount(): boolean {
  return Storage.getItemSync(KEYS.parent) === '1';
}

export function storeParentAccount(on: boolean): void {
  if (on) Storage.setItemSync(KEYS.parent, '1');
  else Storage.removeItemSync(KEYS.parent);
}

/** Time spent on the group screens today (for the parent's daily limit, K-22 c). */
export function loadGroupsUsage(day: DayKey): number {
  const raw = Storage.getItemSync(KEYS.usage);
  if (raw === null) return 0;
  try {
    const value = JSON.parse(raw) as { day?: unknown; ms?: unknown };
    return value.day === day && typeof value.ms === 'number' ? value.ms : 0;
  } catch {
    return 0;
  }
}

export function storeGroupsUsage(day: DayKey, ms: number): void {
  Storage.setItemSync(KEYS.usage, JSON.stringify({ day, ms: Math.max(0, Math.round(ms)) }));
}
