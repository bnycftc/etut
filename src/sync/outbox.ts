/**
 * Sends queued sessions (and deletions). Offline items stay in the queue and go out later; every
 * send uses the session's stable uuid, so a retry after a lost answer is harmless ('duplicate',
 * 'not_found').
 */

import {
  isDeletePayload,
  isStored,
  type OutboxPayload,
  retryDelayMs,
  type SubmitStatus,
} from '../domain/outbox';
import type { GroupApi } from './api';

export interface OutboxStore {
  dueItems(now: number, limit: number): { localId: string; payload: OutboxPayload; attempts: number }[];
  removeItem(localId: string): unknown;
  scheduleRetry(localId: string, attempts: number, nextAt: number, error: string): void;
}

export interface FlushResult {
  stored: number;
  deleted: number;
  refused: SubmitStatus[];
  retried: number;
}

const BATCH = 20;
let running: Promise<FlushResult> | null = null;
let again = false;

export function isFlushing(): boolean {
  return running !== null;
}

async function flushOnce(
  api: Pick<GroupApi, 'submitSession' | 'deleteSession'>,
  store: OutboxStore,
  now: () => number,
  result: FlushResult,
): Promise<boolean> {
  for (const item of store.dueItems(now(), BATCH)) {
    try {
      if (isDeletePayload(item.payload)) {
        // 'deleted' or 'not_found' (never stored, or already deleted): done either way.
        await api.deleteSession(item.payload.clientId);
        store.removeItem(item.localId);
        result.deleted += 1;
        continue;
      }
      const status = await api.submitSession(item.payload);
      // Stored, or refused for good (implausible values): either way it leaves the queue.
      store.removeItem(item.localId);
      if (isStored(status)) result.stored += 1;
      else result.refused.push(status);
    } catch (error) {
      const attempts = item.attempts + 1;
      store.scheduleRetry(
        item.localId,
        attempts,
        now() + retryDelayMs(attempts),
        error instanceof Error ? error.message : 'error',
      );
      result.retried += 1;
      // Offline: the rest would fail the same way.
      return false;
    }
  }
  return true;
}

/**
 * One flush at a time. A call while one is running is not lost: the running flush makes one more
 * pass afterwards, so a session finished meanwhile goes out in the same flush.
 */
export function flushOutbox(
  api: Pick<GroupApi, 'submitSession' | 'deleteSession'>,
  store: OutboxStore,
  now: () => number = Date.now,
): Promise<FlushResult> {
  if (running !== null) {
    again = true;
    return running;
  }
  running = (async () => {
    const result: FlushResult = { stored: 0, deleted: 0, refused: [], retried: 0 };
    try {
      let online = true;
      do {
        again = false;
        online = await flushOnce(api, store, now, result);
      } while (online && again);
      return result;
    } finally {
      again = false;
      running = null;
    }
  })();
  return running;
}
