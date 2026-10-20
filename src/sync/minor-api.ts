/**
 * K-23 on the group server (supabase/migrations/*_etut_minor_policy.sql): the student's standing
 * under the minor policy (the explanation card and the day-14 reminder), and the parent's
 * approval or objection on the parent screen. An interface, so the card and app/veli.tsx can be
 * tested against the fake in src/sync/testing/minor-fake.ts.
 *
 * Server error codes of this package that the app does not know yet ('minor_closed',
 * 'minor_pending', raised by save_profile, create_group, request_join, …) arrive as 'unknown'
 * through src/sync/api.ts until the integration step adds them (texts: src/strings-wp/minor.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AgeBand } from '../domain/groups';
import { type MinorPolicy, type MinorStatus, toMinorPolicy } from '../domain/minor-policy';
import { ApiError, toApiError } from './api';
import { getSupabase } from './client';

/** One linked student, as the parent sees the approval. */
export interface ParentApproval {
  childId: string;
  /** This parent's own approval; null = not given. */
  approvedAt: string | null;
  /** Any linked parent approved. */
  approved: boolean;
  policy: MinorPolicy;
}

export interface MinorApi {
  /** Errors: 'not_authenticated'. */
  myMinorStatus(): Promise<MinorStatus>;
  parentApprovals(): Promise<ParentApproval[]>;
  /** "Onaylıyorum": returns the time of the (first) approval. Errors: 'not_parent'. */
  parentApprove(childId: string): Promise<string>;
  /** "İtiraz ediyorum": deletes the student's group account. Errors: 'not_parent'. */
  parentObject(childId: string): Promise<void>;
}

type Row = Record<string, unknown>;

const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const band = (v: unknown): AgeBand | null => (v === '15_17' || v === '18_plus' ? v : null);

export function createSupabaseMinorApi(getClient: () => SupabaseClient = getSupabase): MinorApi {
  async function call(fn: string, args?: Record<string, unknown>): Promise<unknown> {
    let result: { data: unknown; error: { message?: string; code?: string } | null };
    try {
      result = await getClient().rpc(fn, args);
    } catch (e) {
      throw toApiError({ message: e instanceof Error ? e.message : 'network' });
    }
    if (result.error) throw toApiError(result.error);
    return result.data;
  }
  const rows = async (fn: string, args?: Record<string, unknown>) => ((await call(fn, args)) as Row[] | null) ?? [];

  return {
    async myMinorStatus() {
      const [r] = await rows('my_minor_status');
      if (!r) throw new ApiError('unknown');
      return {
        policy: toMinorPolicy(r.policy),
        band: band(r.band),
        linked: r.linked === true,
        approved: r.approved === true,
        daysSinceSignup: typeof r.days_since_signup === 'number' ? r.days_since_signup : null,
      };
    },
    async parentApprovals() {
      return (await rows('parent_approvals')).map((r) => ({
        childId: String(r.child_id ?? ''),
        approvedAt: strOrNull(r.approved_at),
        approved: r.approved === true,
        policy: toMinorPolicy(r.policy),
      }));
    },
    async parentApprove(childId) {
      const at = strOrNull(await call('parent_approve', { p_child: childId }));
      if (at === null) throw new ApiError('unknown');
      return at;
    },
    async parentObject(childId) {
      await call('parent_object', { p_child: childId });
    },
  };
}

let shared: MinorApi | null = null;
let override: MinorApi | null = null;

/** The app-wide API (supabase). Only reachable while GROUPS_ENABLED (getSupabase checks it). */
export function minorApi(): MinorApi {
  if (override !== null) return override;
  if (shared === null) shared = createSupabaseMinorApi();
  return shared;
}

/** Tests replace the server with a fake. */
export function setMinorApiForTests(api: MinorApi | null): void {
  override = api;
}
