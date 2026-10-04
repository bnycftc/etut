/**
 * Sends queued sessions. Offline sessions stay in the queue and go out later; every send uses the
 * session's stable uuid, so a retry after a lost answer is harmless ('duplicate').
 */

import { isStored, retryDelayMs, type SessionPayload, type SubmitStatus } from '../domain/outbox';
import type { GroupApi } from './api';

export interface OutboxStore {
  dueItems(now: number, limit: number): { localId: string; payload: SessionPayload; attempts: number }[];
  removeItem(localId: string): void;
  scheduleRetry(localId: string, attempts: number, nextAt: number, error: string): void;
}

export interface FlushResult {
  stored: number;
  refused: SubmitStatus[];
  retried: number;
}

const BATCH = 20;
let running: Promise<FlushResult> | null = null;

/** One flush at a time; concurrent callers share the running one. */
export function flushOutbox(
  api: Pick<GroupApi, 'submitSession'>,
  store: OutboxStore,
  now: () => number = Date.now,
): Promise<FlushResult> {
  if (running !== null) return running;
  running = (async () => {
    const result: FlushResult = { stored: 0, refused: [], retried: 0 };
    try {
      for (const item of store.dueItems(now(), BATCH)) {
        try {
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
          break;
        }
      }
      return result;
    } finally {
      running = null;
    }
  })();
  return running;
}
