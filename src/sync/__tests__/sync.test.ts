/**
 * Outbox and heartbeat against the in-memory fake server: offline sessions stay queued and are
 * sent later, re-sending is idempotent, refusals leave the queue, beats only while a session is
 * open, and nothing at all happens while the group module is off.
 */

import type { SessionPayload } from '../../domain/outbox';
import { startSession, finishSession, pauseSession } from '../../domain/timer';
import { ApiError, setGroupApiForTests } from '../api';
import { flushOutbox, type OutboxStore } from '../outbox';
import { createFakeServer } from '../testing/fake-api';

const queue: { localId: string; payload: SessionPayload; attempts: number; nextAt: number }[] = [];
const flags = { account: true, enabled: true };

jest.mock('../../config/features', () => ({
  get GROUPS_ENABLED() {
    return flags.enabled;
  },
}));
jest.mock('../../storage/groups-kv', () => ({
  loadGroupsAccount: () => flags.account,
}));
jest.mock('../../storage/outbox', () => ({
  enqueueSession: (localId: string, payload: SessionPayload, now: number) => {
    if (!queue.some((q) => q.localId === localId)) queue.push({ localId, payload, attempts: 0, nextAt: now });
  },
  dueItems: (now: number, limit: number) => queue.filter((q) => q.nextAt <= now).slice(0, limit),
  removeItem: (localId: string) => {
    const i = queue.findIndex((q) => q.localId === localId);
    if (i >= 0) queue.splice(i, 1);
  },
  scheduleRetry: (localId: string, attempts: number, nextAt: number) => {
    const item = queue.find((q) => q.localId === localId);
    if (item) Object.assign(item, { attempts, nextAt });
  },
}));

// Imported after the mocks.
import * as outboxStore from '../../storage/outbox';
import { syncFinishedSession, syncPresence } from '../session-sync';

const store = outboxStore as unknown as OutboxStore;
const T0 = Date.UTC(2026, 9, 4, 9, 0, 0);

function payload(id: string, durationS = 600): SessionPayload {
  return {
    clientId: id,
    subjectId: 'fizik',
    topicId: null,
    startedAt: new Date(T0).toISOString(),
    endedAt: new Date(T0 + durationS * 1000).toISOString(),
    durationS,
    source: 'timer',
  };
}

beforeEach(() => {
  queue.length = 0;
  flags.account = true;
  flags.enabled = true;
  syncPresence(null);
});

afterEach(() => setGroupApiForTests(null));

describe('flushOutbox', () => {
  it('sends due items and removes them', async () => {
    const server = createFakeServer();
    store.removeItem('x');
    queue.push({ localId: 'a', payload: payload('u-a'), attempts: 0, nextAt: T0 });
    queue.push({ localId: 'b', payload: payload('u-b'), attempts: 0, nextAt: T0 });
    const result = await flushOutbox(server.api, store, () => T0);
    expect(result).toEqual({ stored: 2, refused: [], retried: 0 });
    expect(queue).toHaveLength(0);
    expect(server.submitted.map((p) => p.clientId)).toEqual(['u-a', 'u-b']);
  });

  it('keeps items while offline and retries later with back-off; a resend is a duplicate', async () => {
    const server = createFakeServer();
    queue.push({ localId: 'a', payload: payload('u-a'), attempts: 0, nextAt: T0 });
    queue.push({ localId: 'b', payload: payload('u-b'), attempts: 0, nextAt: T0 });
    server.failNext = new ApiError('network');
    const offline = await flushOutbox(server.api, store, () => T0);
    expect(offline).toEqual({ stored: 0, refused: [], retried: 1 });
    expect(queue.map((q) => [q.localId, q.attempts, q.nextAt])).toEqual([
      ['a', 1, T0 + 30_000],
      ['b', 0, T0],
    ]);
    // Not due yet: only b goes out now.
    await flushOutbox(server.api, store, () => T0 + 1_000);
    expect(queue.map((q) => q.localId)).toEqual(['a']);
    // The server stored "a" earlier but the answer was lost: resending is harmless.
    server.submitted.push(payload('u-a'));
    const later = await flushOutbox(server.api, store, () => T0 + 31_000);
    expect(later.stored).toBe(1);
    expect(queue).toHaveLength(0);
    expect(server.submitted.filter((p) => p.clientId === 'u-a')).toHaveLength(1);
  });

  it('drops refused items instead of retrying them forever', async () => {
    const server = createFakeServer();
    queue.push({ localId: 'long', payload: payload('u-long', 36_001), attempts: 0, nextAt: T0 });
    const result = await flushOutbox(server.api, store, () => T0);
    expect(result.refused).toEqual(['too_long']);
    expect(queue).toHaveLength(0);
  });
});

describe('session sync', () => {
  it('beats while a session is open and uploads it when finished', async () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    const session = startSession('local-1', 'kimya', T0);
    syncPresence(session);
    syncPresence(session); // unchanged: no extra beat
    syncPresence(pauseSession(session, T0 + 60_000));
    await new Promise((r) => setImmediate(r));
    expect(server.beats.map((b) => b.paused)).toEqual([false, true]);
    expect(new Set(server.beats.map((b) => b.sessionId)).size).toBe(1);

    syncFinishedSession(finishSession(session, T0 + 40 * 60_000), T0 + 40 * 60_000);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    expect(server.submitted).toHaveLength(1);
    // Same uuid as the heartbeat, so the server can verify the times.
    expect(server.submitted[0].clientId).toBe(server.beats[0].sessionId);
    // The upload ends the live status; no separate end call races it.
    syncPresence(null);
    expect(server.calls).not.toContain('endPresence');
  });

  it('does nothing without a group account', () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    flags.account = false;
    const session = startSession('local-2', 'fizik', T0);
    syncPresence(session);
    syncFinishedSession(finishSession(session, T0 + 600_000), T0 + 600_000);
    expect(server.calls).toEqual([]);
    expect(queue).toHaveLength(0);
  });

  it('does nothing while the group module is off', () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    flags.enabled = false;
    const session = startSession('local-3', 'fizik', T0);
    syncPresence(session);
    syncFinishedSession(finishSession(session, T0 + 600_000), T0 + 600_000);
    expect(server.calls).toEqual([]);
    expect(queue).toHaveLength(0);
  });
});
