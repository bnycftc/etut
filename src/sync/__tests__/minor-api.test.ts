/**
 * src/sync/minor-api.ts with a stubbed supabase client: the RPC names and arguments, the rows read
 * back, and an unknown policy read as the strictest one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from '../api';
import { createSupabaseMinorApi } from '../minor-api';

type Answer = { data: unknown; error: { message?: string; code?: string } | null };

function setup(answers: Answer[]) {
  const rpc = jest.fn(async (_fn: string, _args?: unknown) => answers.shift() ?? { data: null, error: { message: 'unexpected' } });
  const client = { rpc } as unknown as SupabaseClient;
  return { api: createSupabaseMinorApi(() => client), rpc };
}

it('reads the student’s standing', async () => {
  const t = setup([
    { data: [{ policy: 'basic', band: '15_17', linked: true, approved: false, days_since_signup: 14 }], error: null },
    { data: [{ policy: 'nonsense', band: null, linked: false, approved: false, days_since_signup: null }], error: null },
  ]);
  expect(await t.api.myMinorStatus()).toEqual({
    policy: 'basic',
    band: '15_17',
    linked: true,
    approved: false,
    daysSinceSignup: 14,
  });
  expect(await t.api.myMinorStatus()).toEqual({
    policy: 'closed',
    band: null,
    linked: false,
    approved: false,
    daysSinceSignup: null,
  });
  expect(t.rpc).toHaveBeenCalledWith('my_minor_status', undefined);
});

it('reads the parent’s approvals and sends approve / object with the child id', async () => {
  const t = setup([
    {
      data: [
        { child_id: 'c1', approved_at: null, approved: false, policy: 'strict' },
        { child_id: 'c2', approved_at: '2026-10-20T09:00:00+00:00', approved: true, policy: 'strict' },
      ],
      error: null,
    },
    { data: '2026-10-20T10:00:00+00:00', error: null },
    { data: null, error: null },
  ]);
  expect(await t.api.parentApprovals()).toEqual([
    { childId: 'c1', approvedAt: null, approved: false, policy: 'strict' },
    { childId: 'c2', approvedAt: '2026-10-20T09:00:00+00:00', approved: true, policy: 'strict' },
  ]);
  expect(await t.api.parentApprove('c1')).toBe('2026-10-20T10:00:00+00:00');
  await t.api.parentObject('c1');
  expect(t.rpc).toHaveBeenNthCalledWith(2, 'parent_approve', { p_child: 'c1' });
  expect(t.rpc).toHaveBeenNthCalledWith(3, 'parent_object', { p_child: 'c1' });
});

it('turns server errors into ApiError codes', async () => {
  const t = setup([
    { data: null, error: { message: 'not_parent', code: 'P0001' } },
    { data: [], error: null },
  ]);
  await expect(t.api.parentObject('c1')).rejects.toEqual(new ApiError('not_parent'));
  await expect(t.api.myMinorStatus()).rejects.toEqual(new ApiError('unknown'));
});
