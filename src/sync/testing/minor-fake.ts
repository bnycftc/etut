/**
 * In-memory stand-in for the K-23 RPCs, for Jest only. It mirrors what the card and the parent
 * screen depend on (the student's standing, one approval per parent link, an objection removes
 * the student); the real rules are tested with pgTAP in supabase/tests/12_minor_policy.test.sql.
 */

import type { MinorStatus } from '../../domain/minor-policy';
import { ApiError } from '../api';
import type { MinorApi, ParentApproval } from '../minor-api';

export interface FakeMinorServer {
  api: MinorApi;
  calls: string[];
  /** The calling student's standing (myMinorStatus). */
  status: MinorStatus;
  /** The calling parent's linked students (parentApprovals). */
  approvals: ParentApproval[];
  /** Students deleted by an objection. */
  objected: string[];
  /** Time given to the next approval. */
  now: string;
  failNext: ApiError | null;
}

export function createFakeMinorServer(status: Partial<MinorStatus> = {}): FakeMinorServer {
  const s: FakeMinorServer = {
    api: undefined as unknown as MinorApi,
    calls: [],
    status: { policy: 'strict', band: '15_17', linked: false, approved: false, daysSinceSignup: 0, ...status },
    approvals: [],
    objected: [],
    now: '2026-10-20T09:00:00.000Z',
    failNext: null,
  };

  async function step(name: string): Promise<void> {
    s.calls.push(name);
    if (s.failNext !== null) {
      const error = s.failNext;
      s.failNext = null;
      throw error;
    }
  }

  function link(childId: string): ParentApproval {
    const found = s.approvals.find((a) => a.childId === childId);
    if (!found) throw new ApiError('not_parent');
    return found;
  }

  s.api = {
    async myMinorStatus() {
      await step('myMinorStatus');
      return { ...s.status };
    },
    async parentApprovals() {
      await step('parentApprovals');
      return s.approvals.map((a) => ({ ...a }));
    },
    async parentApprove(childId) {
      await step(`parentApprove:${childId}`);
      const a = link(childId);
      if (a.approvedAt === null) a.approvedAt = s.now;
      a.approved = true;
      return a.approvedAt;
    },
    async parentObject(childId) {
      await step(`parentObject:${childId}`);
      link(childId);
      s.approvals = s.approvals.filter((a) => a.childId !== childId);
      s.objected.push(childId);
    },
  };
  return s;
}
