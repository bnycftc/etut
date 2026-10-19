/**
 * The supabase mapping of the KVKK application RPCs: parameter names as the SQL functions take
 * them (supabase/migrations/*_etut_requests.sql), rows turned into the app's shape, server error
 * messages into codes. The server rules themselves: supabase/tests/09_requests.test.sql.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import { REQUEST_KINDS } from '../../domain/dsr';
import { ApiError } from '../api';
import { createSupabaseRequestsApi } from '../requests-api';

function clientReturning(results: Record<string, { data: unknown; error: { message: string } | null }>) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args?: unknown) => {
      calls.push({ fn, args });
      return results[fn] ?? { data: null, error: { message: 'unknown function' } };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('requests api (supabase)', () => {
  it('submits with the SQL parameter names and no text for spaces only', async () => {
    const { client, calls } = clientReturning({
      submit_request: {
        data: [{ request_id: 'u-1', ref: 'ABCDEFGH', created_at: '2026-10-19T09:00:00+00:00', due_at: '2026-11-18T09:00:00+00:00' }],
        error: null,
      },
    });
    const api = createSupabaseRequestsApi(() => client);
    await expect(api.submitRequest({ kind: 'deletion', applicant: 'self', body: '   ' })).resolves.toEqual({
      id: 'u-1',
      ref: 'ABCDEFGH',
      createdAt: '2026-10-19T09:00:00+00:00',
      dueAt: '2026-11-18T09:00:00+00:00',
    });
    expect(calls).toEqual([{ fn: 'submit_request', args: { p_kind: 'deletion', p_applicant: 'self', p_body: null } }]);
  });

  it('maps the list, the first opening and the export', async () => {
    const { client, calls } = clientReturning({
      my_requests: {
        data: [
          {
            request_id: 'u-1', ref: 'ABCDEFGH', kind: 'complaint', applicant: 'parent', body: 'Metin',
            created_at: 'c', due_at: 'd', answered_at: 'a', answer_result: 'rejected', answer_text: 'Cevap', seen_at: null,
          },
        ],
        error: null,
      },
      mark_request_seen: { data: '2026-10-20T10:00:00+00:00', error: null },
      export_my_data: { data: { format: 'etut-sunucu-verileri' }, error: null },
    });
    const api = createSupabaseRequestsApi(() => client);
    await expect(api.myRequests()).resolves.toEqual([
      {
        id: 'u-1', ref: 'ABCDEFGH', kind: 'complaint', applicant: 'parent', body: 'Metin', createdAt: 'c', dueAt: 'd',
        answeredAt: 'a', answerResult: 'rejected', answerText: 'Cevap', seenAt: null,
      },
    ]);
    await expect(api.markRequestSeen('u-1')).resolves.toBe('2026-10-20T10:00:00+00:00');
    await expect(api.exportMyData()).resolves.toEqual({ format: 'etut-sunucu-verileri' });
    expect(calls.map((c) => c.fn)).toEqual(['my_requests', 'mark_request_seen', 'export_my_data']);
    expect(calls[1].args).toEqual({ p_request: 'u-1' });
  });

  it('turns server refusals into error codes', async () => {
    const { client } = clientReturning({
      submit_request: { data: null, error: { message: 'rate_limited' } },
      my_requests: { data: null, error: { message: 'invalid_input' } },
    });
    const api = createSupabaseRequestsApi(() => client);
    await expect(api.submitRequest({ kind: 'info', applicant: 'self', body: '' })).rejects.toEqual(new ApiError('rate_limited'));
    await expect(api.myRequests()).rejects.toEqual(new ApiError('invalid_input'));
  });

  it('the server accepts exactly the kinds the form offers', () => {
    const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
    const file = readdirSync(dir).find((f) => f.endsWith('_etut_requests.sql'));
    if (file === undefined) throw new Error('requests migration not found');
    const sql = readFileSync(join(dir, file), 'utf8');
    const block = /kind text not null check \(kind in \(([\s\S]*?)\)\)/.exec(sql);
    if (block === null) throw new Error('kind check not found');
    expect([...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...REQUEST_KINDS]);
  });
});
