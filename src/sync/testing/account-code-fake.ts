/**
 * In-memory stand-in for the account code RPC and the phone's copy of the code, for Jest only.
 * It mirrors what the card depends on (made on the first call, shown again only from the phone's
 * copy, renewing replaces it); the real rules are tested with pgTAP in
 * supabase/tests/10_account_code.test.sql.
 */

import { ApiError } from '../api';
import type { AccountCodeApi } from '../account-code-api';

export interface FakeAccountCodeServer {
  api: AccountCodeApi;
  calls: string[];
  /** The account's current code as the server knows it (really only its hash); null = none yet. */
  serverCode: string | null;
  createdAt: string | null;
  /** The copy saved on this phone; null = lost (e.g. never saved, or another phone). */
  phoneCopy: string | null;
  /** Codes handed out, in order (the next one is `codes[n]`, else a generated one). */
  codes: string[];
  failNext: ApiError | null;
}

export function createFakeAccountCodeServer(): FakeAccountCodeServer {
  let seq = 0;
  const s: FakeAccountCodeServer = {
    api: undefined as unknown as AccountCodeApi,
    calls: [],
    serverCode: null,
    createdAt: null,
    phoneCopy: null,
    codes: ['ABCDEFGHJKLM', 'NPQRSTUVWXYZ'],
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

  function make(): { code: string; createdAt: string } {
    const n = seq++;
    const code = s.codes[n] ?? `CODE${String(n).padStart(8, '2')}`;
    const createdAt = new Date(Date.UTC(2026, 9, 20, 9, 0, n)).toISOString();
    s.serverCode = code;
    s.createdAt = createdAt;
    s.phoneCopy = code;
    return { code, createdAt };
  }

  s.api = {
    async accountCode() {
      await step('accountCode');
      if (s.serverCode === null || s.createdAt === null) return make();
      return { code: s.phoneCopy, createdAt: s.createdAt };
    },
    async renewAccountCode() {
      await step('renewAccountCode');
      return make();
    },
  };
  return s;
}
