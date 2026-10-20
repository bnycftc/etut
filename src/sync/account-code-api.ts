/**
 * The account code on the group server (supabase/migrations/*_etut_account_code.sql): a permanent
 * 12-character code that identifies the group account when the app is gone (e-mailed to the
 * operator, /hesap-sil). The server keeps only its hash and returns the plain code once, when it
 * is made; this module keeps that copy on the phone (expo-sqlite/kv-store, wiped by "Tüm verileri
 * sil") so the card can show it again. Only for an account that already exists on the server: it
 * never signs in by itself. An interface, so the card can be tested against the fake in
 * src/sync/testing/account-code-fake.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeCode } from '../domain/groups';
import { ApiError, toApiError } from './api';
import { getSupabase } from './client';

export interface AccountCode {
  /** 12 characters; null = made earlier but not saved on this phone (renew to get a new one). */
  code: string | null;
  /** When the server made the current code. */
  createdAt: string;
}

export interface AccountCodeApi {
  /** The account's code; the server makes it on the first call. Errors: 'not_authenticated'. */
  accountCode(): Promise<AccountCode>;
  /** Replaces the code (the old one stops working) and returns the new one. */
  renewAccountCode(): Promise<AccountCode & { code: string }>;
}

/** The phone's copy of the code, tied to the server's date of that code. */
export interface CodeStore {
  load(): string | null;
  save(value: string): void;
}

const STORE_KEY = 'etut.groups.account-code.v1';

/** expo-sqlite/kv-store, loaded on first use only (like the supabase client). */
const kvCodeStore: CodeStore = {
  load() {
    const Storage = (require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store')).default;
    return Storage.getItemSync(STORE_KEY);
  },
  save(value) {
    const Storage = (require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store')).default;
    Storage.setItemSync(STORE_KEY, value);
  },
};

/** "ABCD-EFGH-JKLM" (as typed back, case, spaces and dashes do not matter). */
export function formatAccountCode(code: string): string {
  const c = normalizeCode(code);
  return c.length === 12 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : c;
}

type Row = Record<string, unknown>;

const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function createSupabaseAccountCodeApi(
  getClient: () => SupabaseClient = getSupabase,
  store: CodeStore = kvCodeStore,
): AccountCodeApi {
  async function fetchCode(renew: boolean): Promise<AccountCode> {
    let result: { data: unknown; error: { message?: string; code?: string } | null };
    try {
      result = await getClient().rpc('my_account_code', { p_renew: renew });
    } catch (e) {
      throw toApiError({ message: e instanceof Error ? e.message : 'network' });
    }
    if (result.error) throw toApiError(result.error);
    const r = ((result.data as Row[] | null) ?? [])[0];
    const createdAt = strOrNull(r?.created_at);
    if (createdAt === null) throw new ApiError('unknown');
    return { code: strOrNull(r?.code), createdAt };
  }

  /** The saved copy, if it belongs to the server's current code. */
  function saved(createdAt: string): string | null {
    try {
      const raw = store.load();
      if (raw === null) return null;
      const v = JSON.parse(raw) as { code?: unknown; createdAt?: unknown };
      return v.createdAt === createdAt && typeof v.code === 'string' ? v.code : null;
    } catch {
      return null;
    }
  }

  function keep(code: string, createdAt: string): void {
    try {
      store.save(JSON.stringify({ code, createdAt }));
    } catch {
      // Not saved on the phone: the card still shows it now; next time it offers a new code.
    }
  }

  return {
    async accountCode() {
      const r = await fetchCode(false);
      if (r.code !== null) {
        keep(r.code, r.createdAt);
        return r;
      }
      return { code: saved(r.createdAt), createdAt: r.createdAt };
    },
    async renewAccountCode() {
      const r = await fetchCode(true);
      if (r.code === null) throw new ApiError('unknown');
      keep(r.code, r.createdAt);
      return { code: r.code, createdAt: r.createdAt };
    },
  };
}

let shared: AccountCodeApi | null = null;
let override: AccountCodeApi | null = null;

/** The app-wide API (supabase). Only reachable while GROUPS_ENABLED (getSupabase checks it). */
export function accountCodeApi(): AccountCodeApi {
  if (override !== null) return override;
  if (shared === null) shared = createSupabaseAccountCodeApi();
  return shared;
}

/** Tests replace the server with a fake. */
export function setAccountCodeApiForTests(api: AccountCodeApi | null): void {
  override = api;
}
