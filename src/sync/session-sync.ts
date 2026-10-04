/**
 * Glue between the local timer and the group server: the live-status heartbeat while a session is
 * open and the upload of finished sessions. Everything here is a no-op unless the group module is
 * on (GROUPS_ENABLED) and this device has a group account; then nothing touches the network.
 */

import { AppState } from 'react-native';

import { GROUPS_ENABLED } from '../config/features';
import { HEARTBEAT_INTERVAL_MS } from '../domain/groups';
import { toPayload, uuidFromLocalId } from '../domain/outbox';
import { type ActiveSession, type CompletedSession, isPaused } from '../domain/timer';
import { loadGroupsAccount } from '../storage/groups-kv';
import * as outboxStore from '../storage/outbox';
import { groupApi as api } from './api';
import { flushOutbox } from './outbox';

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

function sendBeat(): void {
  if (beatSession === null) return;
  api().beat(uuidFromLocalId(beatSession.id), beatSession.subjectId, beatSession.paused).catch(ignore);
}

function stopBeats(): void {
  if (beatTimer !== null) clearInterval(beatTimer);
  beatTimer = null;
  appStateSub?.remove();
  appStateSub = null;
}

/**
 * Called whenever the open session (or its paused state) changes. Beats only while a session is
 * open: immediately, every 5 minutes, and when the app returns to the foreground.
 */
export function syncPresence(session: ActiveSession | null): void {
  if (!isSyncActive()) return;
  if (session === null) {
    const ended = beatSession;
    beatSession = null;
    stopBeats();
    // Abandoned without a saved session (e.g. under a minute): clear the live status.
    if (ended !== null) api().endPresence(uuidFromLocalId(ended.id)).catch(ignore);
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
  if (!isSyncActive()) return;
  if (beatSession?.id === session.id) {
    // The upload itself ends the live status on the server (and needs it to verify the times),
    // so no separate "end" call may race it.
    beatSession = null;
    stopBeats();
  }
  const payload = toPayload(session);
  if (payload === null) return;
  try {
    outboxStore.enqueueSession(session.id, payload, now);
  } catch {
    return;
  }
  flushPending();
}

/**
 * A manual ("elle") entry was deleted on the device: drop it from the queue if it was not sent
 * yet. Sessions already on the server stay there (append only, see README "Gruplar").
 */
export function syncManualDeleted(localId: string): void {
  if (!isSyncActive()) return;
  try {
    outboxStore.removeItem(localId);
  } catch {
    // Nothing queued.
  }
}

/** Sends whatever is due (app start, foreground, after a new session). */
export function flushPending(): void {
  if (!isSyncActive()) return;
  flushOutbox(api(), outboxStore).catch(ignore);
}
