/// <reference types="node" />
/**
 * An anonymous group account carries no e-mail address (kvkk/08 #11 "e-posta saklanmaz"):
 * neither in the sign-in answer nor in what GoTrue returns for the user later, also after a
 * token refresh (the account a student keeps behind a shared NAT, src/sync/client.ts).
 *
 * Run with `npm run test:backend` (scripts/test-backend.mjs passes the local stack's URL and key).
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.ETUT_TEST_SUPABASE_URL ?? '';
const key = process.env.ETUT_TEST_SUPABASE_KEY ?? '';

describe('anonymous account', () => {
  let client: SupabaseClient | undefined;

  after(async () => {
    if (client) await client.rpc('delete_my_account');
  });

  it('has an empty e-mail, before and after a token refresh', async () => {
    assert.ok(url && key, 'ETUT_TEST_SUPABASE_URL / ETUT_TEST_SUPABASE_KEY are set by scripts/test-backend.mjs');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const signIn = await client.auth.signInAnonymously();
    assert.equal(signIn.error, null);
    const user = signIn.data.user;
    assert.ok(user);
    assert.equal(user.is_anonymous, true);
    assert.equal(user.email ?? '', '');
    assert.equal(user.phone ?? '', '');

    const fromServer = await client.auth.getUser();
    assert.equal(fromServer.error, null);
    assert.equal(fromServer.data.user?.email ?? '', '');

    const refreshed = await client.auth.refreshSession();
    assert.equal(refreshed.error, null);
    assert.equal(refreshed.data.user?.id, user.id);
    assert.equal(refreshed.data.user?.email ?? '', '');
  });
});
