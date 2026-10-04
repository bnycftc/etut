/// <reference types="node" />
/**
 * End-to-end check of the group backend through the real stack (GoTrue anonymous sign-in,
 * PostgREST RPCs, RLS) with supabase-js — the same path the app uses.
 *
 * Run with `npm run test:backend`: scripts/test-backend.mjs finds the local stack
 * (`npx supabase start`), passes its URL and public key in the environment and runs this file
 * with `node --test`. Without Docker / a running stack it reports SKIPPED and runs nothing.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.ETUT_TEST_SUPABASE_URL ?? '';
const key = process.env.ETUT_TEST_SUPABASE_KEY ?? '';

function newClient(): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rpc<T = unknown>(client: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function rpcError(client: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<string> {
  const { error } = await client.rpc(fn, args);
  assert.ok(error, `${fn} should fail`);
  return error.message;
}

async function signedIn(): Promise<SupabaseClient> {
  const client = newClient();
  const { error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`anonymous sign-in: ${error.message}`);
  return client;
}

describe('group backend through supabase-js', () => {
  let founder: SupabaseClient;
  let student: SupabaseClient;
  let groupId: string;
  let inviteCode: string;

  before(async () => {
    assert.ok(url && key, 'ETUT_TEST_SUPABASE_URL / ETUT_TEST_SUPABASE_KEY are set by scripts/test-backend.mjs');
    founder = await signedIn();
    student = await signedIn();
  });

  after(async () => {
    // Leave nothing behind in the local database.
    for (const client of [founder, student]) {
      if (client) await client.rpc('delete_my_account');
    }
  });

  it('refuses an under-15 account on the server (K-16)', async () => {
    assert.equal(await rpcError(founder, 'save_profile', {
      p_nickname: 'Deneme', p_exam_type: 'YKS', p_yks_area: 'sayisal', p_age_band: 'under_15',
    }), 'under_15');
  });

  it('creates profiles with only the age band', async () => {
    await rpc(founder, 'save_profile', { p_nickname: 'Kurucu Kişi', p_exam_type: 'YKS', p_yks_area: 'sayisal', p_age_band: '18_plus' });
    await rpc(student, 'save_profile', { p_nickname: 'Genç Kişi', p_exam_type: 'YKS', p_yks_area: 'sayisal', p_age_band: '15_17' });
    const me = await rpc<{ age_band: string; nickname: string }[]>(student, 'get_me');
    assert.equal(me[0].age_band, '15_17');
    assert.equal(await rpcError(student, 'save_profile', {
      p_nickname: 'or0spu', p_exam_type: 'YKS', p_yks_area: 'sayisal', p_age_band: '15_17',
    }), 'name_banned');
  });

  it('does not expose any table through the Data API', async () => {
    const plain = await founder.from('profiles').select('*');
    assert.ok(plain.error, 'public.profiles must not exist');
    const app = await founder.schema('app').from('profiles').select('*');
    assert.ok(app.error, 'the app schema must not be exposed');
  });

  it('a signed-out client cannot call anything', async () => {
    const anon = newClient();
    const { error } = await anon.rpc('get_me');
    assert.ok(error);
  });

  it('joins a group only with the code and the founder\'s approval (K-03)', async () => {
    const [created] = await rpc<{ group_id: string; invite_code: string }[]>(founder, 'create_group', { p_name: 'Sayısal Ekip' });
    groupId = created.group_id;
    inviteCode = created.invite_code;
    assert.match(inviteCode, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(await rpc(student, 'request_join', { p_code: inviteCode.toLowerCase() }), 'requested');
    assert.equal(await rpcError(student, 'group_board', { p_group: groupId }), 'not_member');
    const requests = await rpc<{ request_id: string }[]>(founder, 'list_join_requests', { p_group: groupId });
    assert.equal(requests.length, 1);
    assert.equal(await rpcError(student, 'decide_join_request', { p_request: requests[0].request_id, p_approve: true }), 'not_owner');
    assert.equal(await rpc(founder, 'decide_join_request', { p_request: requests[0].request_id, p_approve: true }), 'approved');
    const board = await rpc<unknown[]>(student, 'group_board', { p_group: groupId });
    assert.equal(board.length, 2);
  });

  it('shows the live status and stores sessions idempotently with server time', async () => {
    const session = randomUUID();
    assert.equal(await rpc(student, 'beat', { p_session: session, p_subject: 'fizik', p_paused: false }), 'ok');
    const board = await rpc<{ nickname: string; studying: boolean }[]>(founder, 'group_board', { p_group: groupId });
    assert.equal(board.find((m) => m.nickname === 'Genç Kişi')?.studying, true);
    const args = {
      p_client_id: session,
      p_subject: 'fizik',
      p_topic: null,
      p_started_at: new Date(Date.now() - 3_600_000).toISOString(),
      p_ended_at: new Date().toISOString(),
      p_duration_s: 3000,
      p_source: 'timer',
    };
    assert.equal(await rpc(student, 'submit_session', args), 'accepted');
    assert.equal(await rpc(student, 'submit_session', args), 'duplicate');
    const offline = { ...args, p_client_id: randomUUID(), p_started_at: new Date(Date.now() - 6 * 3_600_000).toISOString(), p_ended_at: new Date(Date.now() - 5 * 3_600_000).toISOString() };
    assert.equal(await rpc(student, 'submit_session', offline), 'accepted');
    assert.equal(await rpc(student, 'submit_session', { ...offline, p_client_id: randomUUID() }), 'overlap');
  });

  it('limits reactions to 3 a day per person (K-08)', async () => {
    const board = await rpc<{ user_id: string; is_me: boolean }[]>(founder, 'group_board', { p_group: groupId });
    const target = board.find((m) => !m.is_me)!.user_id;
    for (let i = 0; i < 3; i++) {
      assert.equal(await rpc(founder, 'send_reaction', { p_group: groupId, p_to: target, p_kind: 'tebrik' }), 'sent');
    }
    assert.equal(await rpc(founder, 'send_reaction', { p_group: groupId, p_to: target, p_kind: 'hadi' }), 'limit');
    const received = await rpc<unknown[]>(student, 'take_reactions');
    assert.equal(received.length, 3);
    assert.equal((await rpc<unknown[]>(student, 'take_reactions')).length, 0);
  });

  it('deletes the account and every trace of it in the group', async () => {
    await rpc(student, 'delete_my_account');
    const board = await rpc<unknown[]>(founder, 'group_board', { p_group: groupId });
    assert.equal(board.length, 1);
    student = undefined as unknown as SupabaseClient;
  });
});
