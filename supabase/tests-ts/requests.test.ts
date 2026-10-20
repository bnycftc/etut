/// <reference types="node" />
/**
 * KVKK applications through the real stack (GoTrue anonymous sign-in, PostgREST RPCs, RLS) with
 * supabase-js, the path of app/basvuru.tsx and app/basvurularim.tsx. The answer itself is written
 * by the operator over SSH (app.answer_request, not reachable through the API); the immutable
 * answer, the 30-day maths and the retention are covered by supabase/tests/09_requests.test.sql.
 *
 * Run with `npm run test:backend` (scripts/test-backend.mjs); skipped without a local stack.
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

interface Submitted {
  request_id: string;
  ref: string;
  created_at: string;
  due_at: string;
}

interface Listed {
  request_id: string;
  ref: string;
  kind: string;
  applicant: string;
  body: string | null;
  due_at: string;
  answered_at: string | null;
  seen_at: string | null;
}

const DAY_MS = 86_400_000;

describe('KVKK applications through supabase-js', () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceRequest: Submitted;

  before(async () => {
    assert.ok(url && key, 'ETUT_TEST_SUPABASE_URL / ETUT_TEST_SUPABASE_KEY are set by scripts/test-backend.mjs');
    alice = await signedIn();
    bob = await signedIn();
    await rpc(alice, 'save_profile', { p_nickname: 'Başvuran Kişi', p_exam_type: 'YKS', p_yks_area: 'sayisal', p_age_band: '18_plus' });
  });

  after(async () => {
    for (const client of [alice, bob]) {
      if (client) await client.rpc('delete_my_account');
    }
  });

  it('a signed-out client can neither apply nor export', async () => {
    const anon = newClient();
    assert.ok((await anon.rpc('submit_request', { p_kind: 'info', p_applicant: 'self', p_body: null })).error);
    assert.ok((await anon.rpc('my_requests')).error);
    assert.ok((await anon.rpc('export_my_data')).error);
  });

  it('submits an application with a number and a deadline 30 days later', async () => {
    const rows = await rpc<Submitted[]>(alice, 'submit_request', {
      p_kind: 'complaint',
      p_applicant: 'self',
      p_body: 'Bir grup adında küfür var.',
    });
    assert.equal(rows.length, 1);
    aliceRequest = rows[0];
    assert.match(aliceRequest.ref, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(Date.parse(aliceRequest.due_at) - Date.parse(aliceRequest.created_at), 30 * DAY_MS);
    const listed = await rpc<Listed[]>(alice, 'my_requests');
    assert.deepEqual(listed.map((r) => [r.ref, r.kind, r.applicant, r.body, r.answered_at, r.seen_at]), [
      [aliceRequest.ref, 'complaint', 'self', 'Bir grup adında küfür var.', null, null],
    ]);
  });

  it('refuses a complaint without text and an unknown kind', async () => {
    assert.equal(await rpcError(alice, 'submit_request', { p_kind: 'complaint', p_applicant: 'self', p_body: ' ' }), 'invalid_input');
    assert.equal(await rpcError(alice, 'submit_request', { p_kind: 'x', p_applicant: 'self', p_body: 'a' }), 'invalid_input');
    assert.equal(await rpcError(alice, 'submit_request', { p_kind: 'other', p_applicant: 'self', p_body: 'a'.repeat(2001) }),
      'invalid_input');
  });

  it('an account without a profile (a parent) can apply too', async () => {
    const rows = await rpc<Submitted[]>(bob, 'submit_request', { p_kind: 'info', p_applicant: 'parent', p_body: null });
    assert.equal(rows.length, 1);
  });

  it('nobody sees or marks another account\'s application', async () => {
    const bobs = await rpc<Listed[]>(bob, 'my_requests');
    assert.equal(bobs.length, 1);
    assert.ok(!bobs.some((r) => r.ref === aliceRequest.ref));
    assert.equal(await rpc(bob, 'mark_request_seen', { p_request: aliceRequest.request_id }), null);
    assert.equal(await rpc(bob, 'mark_request_seen', { p_request: randomUUID() }), null);
    // No answer yet: nothing to mark for the owner either.
    assert.equal(await rpc(alice, 'mark_request_seen', { p_request: aliceRequest.request_id }), null);
    // The table itself is not reachable through the Data API.
    assert.ok((await alice.schema('app').from('dsr_requests').select('*')).error);
  });

  it('the operator function is not part of the API', async () => {
    const { error } = await alice.rpc('answer_request', { p_ref: aliceRequest.ref, p_result: 'accepted', p_text: 'x' });
    assert.ok(error, 'answer_request must not be callable');
    const [still] = await rpc<Listed[]>(alice, 'my_requests');
    assert.equal(still.answered_at, null);
  });

  it('exports only the own server data as JSON', async () => {
    const data = await rpc<Record<string, unknown>>(alice, 'export_my_data');
    assert.equal(data.format, 'etut-sunucu-verileri');
    assert.equal((data.profile as { nickname: string }).nickname, 'Başvuran Kişi');
    const requests = data.requests as { ref: string }[];
    assert.deepEqual(requests.map((r) => r.ref), [aliceRequest.ref]);
    const { data: bobUser } = await bob.auth.getUser();
    assert.ok(bobUser.user);
    assert.ok(!JSON.stringify(data).includes(bobUser.user.id), "no trace of the other account's id");
    const bobs = await rpc<Record<string, unknown>>(bob, 'export_my_data');
    assert.equal(bobs.profile, null, 'an account without a profile exports no profile');
    assert.ok(!JSON.stringify(bobs).includes(aliceRequest.ref));
    assert.ok(!JSON.stringify(bobs).includes('Başvuran Kişi'));
  });
});
