/**
 * Outbox and heartbeat against the in-memory fake server: offline sessions stay queued and are
 * sent later, re-sending is idempotent, refusals leave the queue, beats only while a session is
 * open (and stop for good when the account is gone), deletions reach the server, and nothing at
 * all happens while the group module is off.
 */

import type { OutboxPayload, SessionPayload } from '../../domain/outbox';
import { startSession, finishSession, pauseSession } from '../../domain/timer';
import { ApiError, isAccountGone, setGroupApiForTests, toApiError } from '../api';
import { flushOutbox, type OutboxStore } from '../outbox';
import { createFakeServer } from '../testing/fake-api';

const queue: { localId: string; payload: OutboxPayload; attempts: number; nextAt: number }[] = [];
const flags = { account: true, enabled: true, member: true };

jest.mock('../../config/features', () => ({
  get GROUPS_ENABLED() {
    return flags.enabled;
  },
}));
jest.mock('../../storage/groups-kv', () => ({
  loadGroupsAccount: () => flags.account,
  storeGroupsAccount: (on: boolean) => {
    flags.account = on;
  },
  loadGroupsMember: () => flags.member,
  storeGroupsMember: (on: boolean) => {
    flags.member = on;
  },
}));
jest.mock('../../storage/outbox', () => ({
  enqueueSession: (localId: string, payload: OutboxPayload, now: number) => {
    if (!queue.some((q) => q.localId === localId)) queue.push({ localId, payload, attempts: 0, nextAt: now });
  },
  dueItems: (now: number, limit: number) => queue.filter((q) => q.nextAt <= now).slice(0, limit),
  removeItem: (localId: string) => {
    const i = queue.findIndex((q) => q.localId === localId);
    if (i >= 0) queue.splice(i, 1);
    return i >= 0;
  },
  scheduleRetry: (localId: string, attempts: number, nextAt: number) => {
    const item = queue.find((q) => q.localId === localId);
    if (item) Object.assign(item, { attempts, nextAt });
  },
  nextAttemptAt: () => (queue.length === 0 ? null : Math.min(...queue.map((q) => q.nextAt))),
  clearOutbox: () => {
    queue.length = 0;
  },
}));

// Imported after the mocks.
import * as outboxStore from '../../storage/outbox';
import {
  endGroupsAccount,
  flushPending,
  stopSync,
  syncFinishedSession,
  syncManualDeleted,
  syncPresence,
} from '../session-sync';

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

/** Lets queued promise callbacks run (also under fake timers). */
async function settle() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

beforeEach(() => {
  queue.length = 0;
  flags.account = true;
  flags.enabled = true;
  flags.member = true;
  syncPresence(null);
});

afterEach(() => {
  stopSync();
  setGroupApiForTests(null);
  jest.useRealTimers();
});

describe('toApiError', () => {
  it('a request without a valid session means the account is gone, not a server error', () => {
    // anon may execute no function; PostgREST refuses an expired or unknown token.
    expect(isAccountGone(toApiError({ code: '42501', message: 'permission denied for function delete_my_account' }))).toBe(true);
    expect(isAccountGone(toApiError({ code: 'PGRST301', message: 'JWT expired' }))).toBe(true);
    expect(isAccountGone(toApiError({ message: 'Invalid Refresh Token: Refresh Token Not Found' }))).toBe(true);
    expect(isAccountGone(toApiError({ message: 'Failed to fetch' }))).toBe(false);
    expect(toApiError({ message: 'parent_locked', code: 'P0001' }).code).toBe('parent_locked');
  });
});

describe('flushOutbox', () => {
  it('sends due items and removes them', async () => {
    const server = createFakeServer();
    store.removeItem('x');
    queue.push({ localId: 'a', payload: payload('u-a'), attempts: 0, nextAt: T0 });
    queue.push({ localId: 'b', payload: payload('u-b'), attempts: 0, nextAt: T0 });
    const result = await flushOutbox(server.api, store, () => T0);
    expect(result).toEqual({ stored: 2, deleted: 0, refused: [], retried: 0 });
    expect(queue).toHaveLength(0);
    expect(server.submitted.map((p) => p.clientId)).toEqual(['u-a', 'u-b']);
  });

  it('keeps items while offline and retries later with back-off; a resend is a duplicate', async () => {
    const server = createFakeServer();
    queue.push({ localId: 'a', payload: payload('u-a'), attempts: 0, nextAt: T0 });
    queue.push({ localId: 'b', payload: payload('u-b'), attempts: 0, nextAt: T0 });
    server.failNext = new ApiError('network');
    const offline = await flushOutbox(server.api, store, () => T0);
    expect(offline).toEqual({ stored: 0, deleted: 0, refused: [], retried: 1 });
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

  it('an item queued while a flush runs goes out in the same flush', async () => {
    const server = createFakeServer();
    queue.push({ localId: 'a', payload: payload('u-a'), attempts: 0, nextAt: T0 });
    const first = flushOutbox(server.api, store, () => T0);
    // Finished while the first send is on its way.
    queue.push({ localId: 'b', payload: payload('u-b'), attempts: 0, nextAt: T0 });
    const second = flushOutbox(server.api, store, () => T0);
    expect(second).toBe(first);
    expect((await first).stored).toBe(2);
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

  it('no heartbeat at all once the group account is gone mid-session', () => {
    jest.useFakeTimers();
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    const session = startSession('local-4', 'fizik', T0);
    syncPresence(session);
    expect(server.calls.filter((c) => c === 'beat')).toHaveLength(1);
    // "Grup hesabını sil" / "Tüm verileri sil" while the timer runs.
    flags.account = false;
    syncFinishedSession(finishSession(session, T0 + 600_000), T0 + 600_000);
    syncPresence(null);
    jest.advanceTimersByTime(15 * 60_000);
    expect(server.calls.filter((c) => c === 'beat')).toHaveLength(1);
    expect(server.calls).toEqual(['beat']);
  });

  it('the interval itself stops when the account disappears without a session change', () => {
    jest.useFakeTimers();
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    syncPresence(startSession('local-5', 'fizik', T0));
    flags.account = false;
    jest.advanceTimersByTime(30 * 60_000);
    expect(server.calls.filter((c) => c === 'beat')).toHaveLength(1);
  });

  it('a session under a second clears the live status instead of leaving it for 7 minutes', async () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    const session = startSession('local-6', 'fizik', T0);
    syncPresence(session);
    syncFinishedSession(finishSession(session, T0 + 600), T0 + 600);
    syncPresence(null);
    await settle();
    expect(server.calls).toEqual(['beat', 'endPresence']);
    expect(queue).toHaveLength(0);
  });

  it('sends no heartbeat while the student is in no group (KVKK m.4)', () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    flags.member = false;
    syncPresence(startSession('local-7', 'fizik', T0));
    expect(server.calls).toEqual([]);
  });

  it('a failed upload is retried by a timer when it is due', async () => {
    jest.useFakeTimers({ now: T0 });
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    server.failNext = new ApiError('network');
    const session = startSession('local-8', 'fizik', T0 - 600_000);
    syncFinishedSession(finishSession(session, T0), T0);
    await settle();
    expect(queue).toHaveLength(1);
    expect(server.submitted).toHaveLength(0);
    jest.advanceTimersByTime(31_000);
    await settle();
    expect(server.submitted).toHaveLength(1);
    expect(queue).toHaveLength(0);
  });

  it('a deleted session leaves the queue, or is deleted on the server once it was sent', async () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    const now = Date.now();
    // Still queued (offline): just dropped, nothing reaches the server.
    queue.push({ localId: 'm-1', payload: { ...payload('u-m1'), source: 'manual' }, attempts: 1, nextAt: now + 3_600_000 });
    syncManualDeleted('m-1', now);
    await settle();
    expect(queue).toHaveLength(0);
    expect(server.calls).not.toContain('deleteSession');

    // Already on the server: a delete request goes out (queued, so it survives being offline).
    const sent = finishSession(startSession('m-2', 'tarih', now - 3_600_000), now - 60_000);
    syncFinishedSession(sent, now - 60_000);
    await settle();
    expect(server.submitted).toHaveLength(1);
    syncManualDeleted('m-2', now);
    await settle();
    expect(server.calls).toContain('deleteSession');
    expect(server.submitted).toHaveLength(0);
    expect(queue).toHaveLength(0);
  });

  it('ending the account drops the queue, so nothing reaches a later account', async () => {
    queue.push({ localId: 'old', payload: payload('u-old'), attempts: 2, nextAt: T0 });
    endGroupsAccount();
    expect(queue).toHaveLength(0);
    expect(flags.account).toBe(false);
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    flags.account = true; // a new group account later
    flushPending();
    await settle();
    expect(server.calls).toEqual([]);
  });

  it('does nothing without a group account', () => {
    const server = createFakeServer();
    setGroupApiForTests(server.api);
    flags.account = false;
    const session = startSession('local-2', 'fizik', T0);
    syncPresence(session);
    syncFinishedSession(finishSession(session, T0 + 600_000), T0 + 600_000);
    syncManualDeleted('local-2', T0);
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
