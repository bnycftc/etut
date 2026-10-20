/**
 * KVKK applications and the data export on the group server (supabase/migrations/
 * *_etut_requests.sql). Only for an account that already exists on the server (group profile or
 * parent link): it never signs in by itself. An interface, so the screens can be tested against
 * the fake in src/sync/testing/requests-fake.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AnswerResult, RequestApplicant, RequestKind } from '../domain/dsr';
import { ApiError, toApiError } from './api';
import { getSupabase } from './client';

export interface RequestInput {
  kind: RequestKind;
  applicant: RequestApplicant;
  /** Empty or spaces only = no text (allowed except for complaint / other). */
  body: string;
}

export interface SubmittedRequest {
  id: string;
  /** "Başvuru numarası", 8 characters (shown as ABCD-EFGH). */
  ref: string;
  createdAt: string;
  dueAt: string;
}

export interface DsrRequest extends SubmittedRequest {
  kind: RequestKind;
  applicant: RequestApplicant;
  body: string | null;
  answeredAt: string | null;
  answerResult: AnswerResult | null;
  answerText: string | null;
  /** First time the applicant opened the answer (proof of delivery). */
  seenAt: string | null;
}

export interface RequestsApi {
  /** Errors: 'invalid_input', 'rate_limited' (5 a day), 'not_authenticated' (no server account). */
  submitRequest(input: RequestInput): Promise<SubmittedRequest>;
  /** Own applications, newest first. */
  myRequests(): Promise<DsrRequest[]>;
  /** Keeps the first opening of an answer; returns that time (`null`: no answer yet). */
  markRequestSeen(requestId: string): Promise<string | null>;
  /** Everything the server holds about this account, as a JSON value. */
  exportMyData(): Promise<unknown>;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function createSupabaseRequestsApi(getClient: () => SupabaseClient = getSupabase): RequestsApi {
  async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let result: { data: unknown; error: { message?: string; code?: string } | null };
    try {
      result = await getClient().rpc(fn, args);
    } catch (e) {
      throw toApiError({ message: e instanceof Error ? e.message : 'network' });
    }
    if (result.error) throw toApiError(result.error);
    return result.data as T;
  }

  return {
    async submitRequest(input) {
      const rows = (await call<Row[] | null>('submit_request', {
        p_kind: input.kind,
        p_applicant: input.applicant,
        p_body: input.body.trim() === '' ? null : input.body.trim(),
      })) ?? [];
      const r = rows[0];
      if (r === undefined) throw new ApiError('unknown');
      return { id: str(r.request_id), ref: str(r.ref), createdAt: str(r.created_at), dueAt: str(r.due_at) };
    },
    async myRequests() {
      return ((await call<Row[] | null>('my_requests')) ?? []).map((r) => ({
        id: str(r.request_id),
        ref: str(r.ref),
        kind: str(r.kind) as RequestKind,
        applicant: str(r.applicant) as RequestApplicant,
        body: strOrNull(r.body),
        createdAt: str(r.created_at),
        dueAt: str(r.due_at),
        answeredAt: strOrNull(r.answered_at),
        answerResult: strOrNull(r.answer_result) as AnswerResult | null,
        answerText: strOrNull(r.answer_text),
        seenAt: strOrNull(r.seen_at),
      }));
    },
    async markRequestSeen(requestId) {
      return strOrNull(await call<unknown>('mark_request_seen', { p_request: requestId }));
    },
    async exportMyData() {
      return await call<unknown>('export_my_data');
    },
  };
}

let shared: RequestsApi | null = null;
let override: RequestsApi | null = null;

/** The app-wide API (supabase). Only reachable while GROUPS_ENABLED (getSupabase checks it). */
export function requestsApi(): RequestsApi {
  if (override !== null) return override;
  if (shared === null) shared = createSupabaseRequestsApi();
  return shared;
}

/** Tests replace the server with a fake. */
export function setRequestsApiForTests(api: RequestsApi | null): void {
  override = api;
}
