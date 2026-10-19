/**
 * In-memory stand-in for the KVKK application RPCs, for Jest only. It mirrors what the screens
 * depend on (5 a day, text rules, 30-day deadline, first opening kept, answer written once); the
 * real rules are tested with pgTAP in supabase/tests/09_requests.test.sql.
 */

import { type AnswerResult, checkRequestInput, dueAtMs } from '../../domain/dsr';
import { ApiError } from '../api';
import type { DsrRequest, RequestsApi } from '../requests-api';

export interface FakeRequestsServer {
  api: RequestsApi;
  calls: string[];
  requests: DsrRequest[];
  /** What exportMyData returns. */
  exportData: unknown;
  failNext: ApiError | null;
  /** Server clock (ms). */
  now: () => number;
  /** The operator answers (app.answer_request); a second answer throws like the server. */
  answer(ref: string, result: AnswerResult, text: string): void;
}

export function createFakeRequestsServer(): FakeRequestsServer {
  let seq = 0;
  const s: FakeRequestsServer = {
    api: undefined as unknown as RequestsApi,
    calls: [],
    requests: [],
    exportData: { format: 'etut-sunucu-verileri', version: 1 },
    failNext: null,
    now: () => Date.now(),
    answer(ref, result, text) {
      const r = s.requests.find((x) => x.ref === ref);
      if (r === undefined || r.answeredAt !== null) throw new Error(`request ${ref} does not exist or is already answered`);
      r.answeredAt = new Date(s.now()).toISOString();
      r.answerResult = result;
      r.answerText = text;
    },
  };

  async function step(name: string): Promise<void> {
    s.calls.push(name);
    if (s.failNext !== null) {
      const error = s.failNext;
      s.failNext = null;
      throw error;
    }
  }

  s.api = {
    async submitRequest(input) {
      await step('submitRequest');
      if (checkRequestInput(input.kind, input.body) !== null) throw new ApiError('invalid_input');
      const today = s.requests.filter((r) => Date.parse(r.createdAt) > s.now() - 86_400_000);
      if (today.length >= 5) throw new ApiError('rate_limited');
      const n = ++seq;
      const created = s.now();
      const body = input.body.trim();
      const request: DsrRequest = {
        id: `req-${n}`,
        ref: `ABCDEFG${'HJKLMNPQRS'[n % 10]}`,
        createdAt: new Date(created).toISOString(),
        dueAt: new Date(dueAtMs(created)).toISOString(),
        kind: input.kind,
        applicant: input.applicant,
        body: body === '' ? null : body,
        answeredAt: null,
        answerResult: null,
        answerText: null,
        seenAt: null,
      };
      s.requests.push(request);
      return { id: request.id, ref: request.ref, createdAt: request.createdAt, dueAt: request.dueAt };
    },
    async myRequests() {
      await step('myRequests');
      return [...s.requests].reverse().map((r) => ({ ...r }));
    },
    async markRequestSeen(requestId) {
      await step('markRequestSeen');
      const r = s.requests.find((x) => x.id === requestId);
      if (r === undefined || r.answeredAt === null) return null;
      if (r.seenAt === null) r.seenAt = new Date(s.now()).toISOString();
      return r.seenAt;
    },
    async exportMyData() {
      await step('exportMyData');
      return s.exportData;
    },
  };
  return s;
}
