/**
 * Weekly target per subject (`domain/subject-targets.ts`), kept in the small key-value store next
 * to the daily goal. Deleted with "Tüm verileri sil" (the whole store is cleared) and part of the
 * backup file.
 */

import Storage from 'expo-sqlite/kv-store';

import { normalizeSubjectTarget, normalizeSubjectTargets, type SubjectTargets } from '../domain/subject-targets';

const KEY = 'etut.subjectWeeklyTargets.v1';

export function loadSubjectTargets(): SubjectTargets {
  const raw = Storage.getItemSync(KEY);
  if (raw === null) return {};
  try {
    return normalizeSubjectTargets(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** `null` removes the subject's target. */
export function storeSubjectTarget(subjectId: string, minutes: number | null): void {
  const next = loadSubjectTargets();
  const target = normalizeSubjectTarget(minutes);
  if (target === null) delete next[subjectId];
  else next[subjectId] = target;
  storeSubjectTargets(next);
}

/** Replaces every target (backup restore). */
export function storeSubjectTargets(targets: SubjectTargets): void {
  const clean = normalizeSubjectTargets(targets);
  if (Object.keys(clean).length === 0) Storage.removeItemSync(KEY);
  else Storage.setItemSync(KEY, JSON.stringify(clean));
}
