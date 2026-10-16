/**
 * When Etüt last asked for the App Store rating dialog (domain/review-prompt.ts). This phone only:
 * not in the backup file. Cleared with every other key by "Tüm verileri sil"
 * (kv.ts wipeKeyValueStore → Storage.clearSync).
 */

import Storage from 'expo-sqlite/kv-store';

const KEY = 'etut.reviewAskedAt.v1';

/** `null` = never asked (or an unreadable value). */
export function loadReviewAskedAt(): number | null {
  const raw = Storage.getItemSync(KEY);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function storeReviewAskedAt(ms: number): void {
  Storage.setItemSync(KEY, String(ms));
}
