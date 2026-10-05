/**
 * Outgoing queue rules: which finished sessions are sent, under which id, and when a failed
 * send is retried. Sessions are append only and sent with a stable uuid, so a retry can never
 * create a second row (the server answers 'duplicate').
 */

import type { CompletedSession } from './timer';

/**
 * What a finished session sends: times, length and source only. The subject and topic stay on
 * the device (nothing on the server uses them, KVKK m.4/2-ç); only the live status carries the
 * subject while it runs, for the group to see.
 */
export interface SessionPayload {
  clientId: string;
  startedAt: string;
  endedAt: string;
  durationS: number;
  source: 'timer' | 'manual';
}

/** A session deleted on the device that may be on the server too (KVKK m.7: deleted there as well). */
export interface DeletePayload {
  delete: true;
  clientId: string;
}

export type OutboxPayload = SessionPayload | DeletePayload;

export function isDeletePayload(payload: OutboxPayload): payload is DeletePayload {
  return 'delete' in payload && payload.delete === true;
}

const DELETE_PREFIX = 'delete:';

/** Queue key of the delete request for a local session (next to its upload, never replacing it). */
export function deleteQueueId(localId: string): string {
  return `${DELETE_PREFIX}${localId}`;
}

export type DeleteStatus = 'deleted' | 'not_found';

/**
 * Server answers that end an item's life in the queue. 'ignored': nobody could see it (in no
 * group, no pending request, no linked parent), so the server did not store it.
 */
export type SubmitStatus =
  | 'accepted'
  | 'duplicate'
  | 'invalid'
  | 'too_long'
  | 'day_limit'
  | 'overlap'
  | 'future'
  | 'too_old'
  | 'ignored';

/** 'accepted' and 'duplicate' mean "stored"; the others are permanent refusals (no retry). */
export function isStored(status: SubmitStatus): boolean {
  return status === 'accepted' || status === 'duplicate';
}

export function isSubmitStatus(value: unknown): value is SubmitStatus {
  return (
    typeof value === 'string' &&
    ['accepted', 'duplicate', 'invalid', 'too_long', 'day_limit', 'overlap', 'future', 'too_old', 'ignored'].includes(
      value,
    )
  );
}

/** A queue row as the store keeps it, oldest first. */
export interface QueuedItem<T> {
  localId: string;
  nextAt: number;
  item: T;
}

/**
 * Which queued items may go out now. Each item waits for its own retry time, and an upload also
 * waits while an earlier deletion is still waiting: otherwise a corrected entry for the same
 * time ("elle" A deleted, A2 entered) could reach the server before A is gone there and be
 * refused for good as an overlap. `items` must be in queue order (oldest first).
 */
export function selectDue<T>(items: readonly QueuedItem<T>[], now: number, limit: number): T[] {
  const out: T[] = [];
  let deleteWaiting = false;
  for (const q of items) {
    if (out.length >= limit) break;
    const isDelete = q.localId.startsWith(DELETE_PREFIX);
    if (q.nextAt > now) {
      if (isDelete) deleteWaiting = true;
      continue;
    }
    if (!isDelete && deleteWaiting) continue;
    out.push(q.item);
  }
  return out;
}

/** Below one second there is nothing to send. */
export function toPayload(session: CompletedSession): SessionPayload | null {
  const durationS = Math.floor(session.durationMs / 1000);
  if (durationS < 1 || session.endedAt <= session.startedAt) return null;
  return {
    clientId: uuidFromLocalId(session.id),
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(session.endedAt).toISOString(),
    durationS,
    source: session.source,
  };
}

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 60 * 60_000;

/** Exponential back-off after the n-th failed attempt (1-based): 30 s, 1 min, 2 min … 1 h. */
export function retryDelayMs(attempts: number): number {
  const n = Math.max(1, Math.floor(attempts));
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (n - 1));
}

/** 32-bit FNV-1a with a seed. */
function fnv1a(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Stable uuid for a local session id: the heartbeat and the upload of the same session use the
 * same id without storing a mapping, and re-sending is idempotent. Shaped as a version-4 uuid.
 * Uniqueness is only needed per user (the server's key is user + uuid).
 */
export function uuidFromLocalId(localId: string): string {
  const hex = [0x1b873593, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f]
    .map((seed) => fnv1a(`${seed}:${localId}`, seed).toString(16).padStart(8, '0'))
    .join('');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
