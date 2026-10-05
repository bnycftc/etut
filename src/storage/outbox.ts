/**
 * On-device outgoing queue (expo-sqlite, migration 5). Holds finished sessions until the group
 * server stored them, and deletions of sessions the server may hold; only used when the group
 * module is on and a group account exists.
 */

import { type OutboxPayload, selectDue } from '../domain/outbox';
import { getDb } from './db';

export interface OutboxItem {
  localId: string;
  payload: OutboxPayload;
  attempts: number;
}

/** Same item twice keeps the first entry (the queue is idempotent too). */
export function enqueueSession(localId: string, payload: OutboxPayload, now: number): void {
  getDb().runSync(
    `INSERT OR IGNORE INTO sync_outbox (local_id, payload, attempts, next_attempt_at, created_at)
     VALUES (?, ?, 0, ?, ?)`,
    localId,
    JSON.stringify(payload),
    now,
    now,
  );
}

/** What may go out now, in queue order (selectDue: an upload waits behind a waiting deletion). */
export function dueItems(now: number, limit: number): OutboxItem[] {
  const rows = getDb()
    .getAllSync<{ local_id: string; payload: string; attempts: number; next_attempt_at: number }>(
      `SELECT local_id, payload, attempts, next_attempt_at FROM sync_outbox ORDER BY created_at, rowid`,
    )
    .flatMap((row) => {
      try {
        const item: OutboxItem = {
          localId: row.local_id,
          payload: JSON.parse(row.payload) as OutboxPayload,
          attempts: row.attempts,
        };
        return [{ localId: row.local_id, nextAt: row.next_attempt_at, item }];
      } catch {
        return [];
      }
    });
  return selectDue(rows, now, limit);
}

/**
 * Removes a waiting item. Returns how often it was already tried (0 = never sent), or null when
 * it was not in the queue (any more).
 */
export function removeItem(localId: string): number | null {
  const db = getDb();
  const row = db.getFirstSync<{ attempts: number }>('SELECT attempts FROM sync_outbox WHERE local_id = ?', localId);
  if (row === null) return null;
  db.runSync('DELETE FROM sync_outbox WHERE local_id = ?', localId);
  return row.attempts;
}

export function scheduleRetry(localId: string, attempts: number, nextAt: number, error: string): void {
  getDb().runSync(
    'UPDATE sync_outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE local_id = ?',
    attempts,
    nextAt,
    error.slice(0, 200),
    localId,
  );
}

/** When the next waiting item becomes due (`null` = queue empty). */
export function nextAttemptAt(): number | null {
  return getDb().getFirstSync<{ at: number | null }>('SELECT MIN(next_attempt_at) AS at FROM sync_outbox')?.at ?? null;
}

/** The group account is gone: nothing queued for it may reach a later account. */
export function clearOutbox(): void {
  getDb().runSync('DELETE FROM sync_outbox');
}

export function pendingCount(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox')?.n ?? 0;
}
