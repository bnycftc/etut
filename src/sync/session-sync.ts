/**
 * Glue between the local timer and the group server: the live-status heartbeat while a session is
 * open and the upload of finished sessions. Everything here is a no-op unless the group module is
 * on (GROUPS_ENABLED) and this device has a group account; then nothing touches the network.
 */

import { AppState } from 'react-native';

import { GROUPS_ENABLED } from '../config/features';
import { HEARTBEAT_INTERVAL_MS } from '../domain/groups';
import { deleteQueueId, toPayload, uuidFromLocalId } from '../domain/outbox';
import { type ActiveSession, type CompletedSession, isPaused } from '../domain/timer';
import { loadGroupsAccount, loadGroupsMember, storeGroupsAccount, storeGroupsMember } from '../storage/groups-kv';
import * as outboxStore from '../storage/outbox';
import { groupApi as api } from './api';
import { flushOutbox, isFlushing } from './outbox';

export function isSyncActive(): boolean {
  return GROUPS_ENABLED && loadGroupsAccount();
}

function ignore(): void {
  // Network errors are expected offline; the heartbeat simply tries again later.
}

// ------------------------------------------------------------------ heartbeat

let beatTimer: ReturnType<typeof setInterval> | null = null;
let beatSession: { id: string; subjectId: string; paused: boolean } | null = null;
let appStateSub: { remove: () => void } | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function stopBeats(): void {
  if (beatTimer !== null) clearInterval(beatTimer);
  beatTimer = null;
  appStateSub?.remove();
  appStateSub = null;
}

function sendBeat(): void {
  if (beatSession === null) return;
  if (!isSyncActive()) {
    // The account went away while a session was open (deleted, data wiped): stop for good.
    beatSession = null;
    stopBeats();
    return;
  }
  api().beat(uuidFromLocalId(beatSession.id), beatSession.subjectId, beatSession.paused).catch(ignore);
}

/**
 * Called whenever the open session (or its paused state) changes. Beats only while a session is
 * open and the student is in a group: immediately, every 5 minutes, and when the app returns to
 * the foreground.
 */
export function syncPresence(session: ActiveSession | null): void {
  if (session === null) {
    const ended = beatSession;
    // Stopping is always safe, also after the account is gone.
    beatSession = null;
    stopBeats();
    // Abandoned without a saved session (e.g. under a minute): clear the live status.
    if (ended !== null && isSyncActive()) api().endPresence(uuidFromLocalId(ended.id)).catch(ignore);
    return;
  }
  // No account, or in no group: nobody could see the live status, so nothing is sent (KVKK m.4).
  if (!isSyncActive() || !loadGroupsMember()) {
    beatSession = null;
    stopBeats();
    return;
  }
  const next = { id: session.id, subjectId: session.subjectId, paused: isPaused(session) };
  const changed =
    beatSession === null ||
    beatSession.id !== next.id ||
    beatSession.paused !== next.paused ||
    beatSession.subjectId !== next.subjectId;
  beatSession = next;
  if (!changed) return;
  sendBeat();
  if (beatTimer === null) {
    beatTimer = setInterval(sendBeat, HEARTBEAT_INTERVAL_MS);
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sendBeat();
    });
  }
}

// ------------------------------------------------------------------ finished sessions

/** Queues a finished (timer or "elle") session and tries to send it right away. */
export function syncFinishedSession(session: CompletedSession, now: number): void {
  const wasLive = beatSession?.id === session.id;
  if (wasLive) {
    // The upload itself ends the live status on the server (and needs it to verify the times),
    // so no separate "end" call may race it.
    beatSession = null;
    stopBeats();
  }
  if (!isSyncActive()) return;
  const payload = toPayload(session);
  if (payload === null) {
    // Under a second: nothing to store, but the live status must not linger.
    if (wasLive) api().endPresence(uuidFromLocalId(session.id)).catch(ignore);
    return;
  }
  try {
    outboxStore.enqueueSession(session.id, payload, now);
  } catch {
    return;
  }
  flushPending();
}

/**
 * A session was deleted on the device: drop its upload if it is still queued, otherwise delete it
 * on the server too (queued, so it also works offline; KVKK m.7).
 */
export function syncManualDeleted(localId: string, now: number = Date.now()): void {
  if (!isSyncActive()) return;
  try {
    const waiting = outboxStore.removeItem(localId) === true;
    // Never sent: nothing to delete there. While a flush runs it may be on its way, though.
    if (waiting && !isFlushing()) return;
    outboxStore.enqueueSession(deleteQueueId(localId), { delete: true, clientId: uuidFromLocalId(localId) }, now);
  } catch {
    return;
  }
  flushPending();
}

/** A failed send is retried when it is due, not only at the next app start or foreground. */
function scheduleNextFlush(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  if (!isSyncActive()) return;
  let next: number | null;
  try {
    next = outboxStore.nextAttemptAt();
  } catch {
    return;
  }
  if (next === null) return;
  // Something due but not sent (e.g. an unreadable row) must not cause a tight loop.
  const delay = Math.max(30_000, next - Date.now());
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flushPending();
  }, delay);
}

/** Sends whatever is due (app start, foreground, after a new session, retry timer). */
export function flushPending(): void {
  if (!isSyncActive()) return;
  flushOutbox(api(), outboxStore).then(scheduleNextFlush, ignore);
}

// ------------------------------------------------------------------ account end

/** Stops every timer and listener of the sync ("Tüm verileri sil", account deleted). */
export function stopSync(): void {
  beatSession = null;
  stopBeats();
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

/**
 * The server account is gone (deleted here, or no longer reachable): stop, forget it on the
 * device and drop the queue, so nothing queued for it ever reaches a later account.
 */
export function endGroupsAccount(): void {
  stopSync();
  storeGroupsAccount(false);
  storeGroupsMember(false);
  try {
    outboxStore.clearOutbox();
  } catch {
    // No database (tests) or already empty.
  }
}
