/**
 * src/sync/account-code-api.ts with a stubbed supabase client and an in-memory phone store: the
 * plain code comes from the server only once, so the phone's copy is what shows it again, and
 * only while it belongs to the server's current code.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { type CodeStore, createSupabaseAccountCodeApi, formatAccountCode } from '../account-code-api';
import { ApiError } from '../api';

type Answer = { data: unknown; error: { message?: string; code?: string } | null };

function setup(answers: Answer[]) {
  const rpc = jest.fn(async () => answers.shift() ?? { data: null, error: { message: 'unexpected' } });
  const client = { rpc } as unknown as SupabaseClient;
  let saved: string | null = null;
  const store: CodeStore = { load: () => saved, save: (v) => void (saved = v) };
  const api = createSupabaseAccountCodeApi(() => client, store);
  return { api, rpc, saved: () => saved, setSaved: (v: string | null) => void (saved = v) };
}

const made = (code: string | null, createdAt: string): Answer => ({ data: [{ code, created_at: createdAt }], error: null });

it('keeps the code the server makes and shows that copy later', async () => {
  const t = setup([made('ABCDEFGHJKLM', '2026-10-20T09:00:00+00:00'), made(null, '2026-10-20T09:00:00+00:00')]);
  expect(await t.api.accountCode()).toEqual({ code: 'ABCDEFGHJKLM', createdAt: '2026-10-20T09:00:00+00:00' });
  expect(await t.api.accountCode()).toEqual({ code: 'ABCDEFGHJKLM', createdAt: '2026-10-20T09:00:00+00:00' });
  expect(t.rpc).toHaveBeenCalledWith('my_account_code', { p_renew: false });
});

it('does not show a copy of another code (an older account, a lost answer)', async () => {
  const t = setup([made(null, '2026-10-21T10:00:00+00:00')]);
  t.setSaved(JSON.stringify({ code: 'ABCDEFGHJKLM', createdAt: '2026-10-20T09:00:00+00:00' }));
  expect(await t.api.accountCode()).toEqual({ code: null, createdAt: '2026-10-21T10:00:00+00:00' });
});

it('treats an unreadable copy as none', async () => {
  const t = setup([made(null, '2026-10-20T09:00:00+00:00')]);
  t.setSaved('{not json');
  expect((await t.api.accountCode()).code).toBeNull();
});

it('renews: the new code replaces the copy', async () => {
  const t = setup([made('NPQRSTUVWXYZ', '2026-10-22T08:00:00+00:00'), made(null, '2026-10-22T08:00:00+00:00')]);
  expect(await t.api.renewAccountCode()).toEqual({ code: 'NPQRSTUVWXYZ', createdAt: '2026-10-22T08:00:00+00:00' });
  expect(t.rpc).toHaveBeenCalledWith('my_account_code', { p_renew: true });
  expect((await t.api.accountCode()).code).toBe('NPQRSTUVWXYZ');
});

it('maps server errors like the other APIs', async () => {
  const t = setup([{ data: null, error: { message: 'not_authenticated' } }, { data: [], error: null }]);
  await expect(t.api.accountCode()).rejects.toEqual(new ApiError('not_authenticated'));
  await expect(t.api.accountCode()).rejects.toEqual(new ApiError('unknown'));
  expect(t.saved()).toBeNull();
});

it('formats the code in three groups of four', () => {
  expect(formatAccountCode('abcd efgh-jklm')).toBe('ABCD-EFGH-JKLM');
  expect(formatAccountCode('ABC')).toBe('ABC');
});
