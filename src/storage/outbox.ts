/**
 * On-device outgoing queue (expo-sqlite, migration 5). Holds finished sessions until the group
 * server stored them; only used when the group module is on and a group account exists.
 */

import type { SessionPayload } from '../domain/outbox';
import { getDb } from './db';

export interface OutboxItem {
  localId: string;
  payload: SessionPayload;
  attempts: number;
}

/** Same session twice keeps the first entry (the queue is idempotent too). */
export function enqueueSession(localId: string, payload: SessionPayload, now: number): void {
  getDb().runSync(
    `INSERT OR IGNORE INTO sync_outbox (local_id, payload, attempts, next_attempt_at, created_at)
     VALUES (?, ?, 0, ?, ?)`,
    localId,
    JSON.stringify(payload),
    now,
    now,
  );
}

export function dueItems(now: number, limit: number): OutboxItem[] {
  return getDb()
    .getAllSync<{ local_id: string; payload: string; attempts: number }>(
      `SELECT local_id, payload, attempts FROM sync_outbox
       WHERE next_attempt_at <= ? ORDER BY created_at LIMIT ?`,
      now,
      limit,
    )
    .flatMap((row) => {
      try {
        return [{ localId: row.local_id, payload: JSON.parse(row.payload) as SessionPayload, attempts: row.attempts }];
      } catch {
        return [];
      }
    });
}

export function removeItem(localId: string): void {
  getDb().runSync('DELETE FROM sync_outbox WHERE local_id = ?', localId);
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

export function pendingCount(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox')?.n ?? 0;
}
