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
  member: 'etut.groups.member.v1',
  parentLinked: 'etut.groups.parent-linked.v1',
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

/**
 * Whether the last group list had any group (pending requests included). Without one the live
 * status is not sent at all (nobody could see it). Unknown (never loaded) counts as yes; the
 * server ignores a heartbeat of someone in no group anyway.
 */
export function loadGroupsMember(): boolean {
  return Storage.getItemSync(KEYS.member) !== '0';
}

export function storeGroupsMember(member: boolean): void {
  Storage.setItemSync(KEYS.member, member ? '1' : '0');
}

/**
 * Whether a parent was linked to this student at the last look (get_me). A linked parent sees
 * the weekly study time, so finished sessions are sent even in no group. Unknown counts as no;
 * the server decides in the end (submit_session answers 'ignored').
 */
export function loadParentLinked(): boolean {
  return Storage.getItemSync(KEYS.parentLinked) === '1';
}

export function storeParentLinked(linked: boolean): void {
  Storage.setItemSync(KEYS.parentLinked, linked ? '1' : '0');
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
