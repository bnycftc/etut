/**
 * Behind school Wi-Fi or carrier NAT many students share one IP, and GoTrue's per-IP limit can
 * refuse a token refresh with 429. Real supabase-js / auth-js against a fake server (fetch):
 * auth-js alone drops the session then (why src/sync/client.ts wraps fetch); the app client
 * keeps it, the next refresh succeeds with the same account, and the API layer reports
 * "biraz sonra dene" instead of "account gone" or a new anonymous account.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const SERVER = 'https://etut.test';
const STORAGE_KEY = 'sb-etut-auth-token';
const mockStore = new Map<string, string>();
// expo-sqlite's localStorage, in memory.
const mockStorage = {
  getItem: (k: string) => mockStore.get(k) ?? null,
  setItem: (k: string, v: string) => void mockStore.set(k, v),
  removeItem: (k: string) => void mockStore.delete(k),
};

jest.mock('../../config/features', () => ({ GROUPS_ENABLED: true }));
jest.mock('../config', () => ({ serverConfig: () => ({ url: 'https://etut.test', key: 'public-key' }) }));
jest.mock('expo-sqlite/localStorage/install', () => {
  (globalThis as { localStorage?: unknown }).localStorage = mockStorage;
  return {};
});

// The clock auth-js sees (expiry, retry window, failure cooldown).
let now = Date.UTC(2026, 9, 19, 8, 0, 0);
/**
 * Answers for the next refresh requests: 'busy' is a 429 that lasts past auth-js's 30 s retry
 * window (the clock jumps), 429 a single refusal, 200 a new token pair.
 */
let refreshAnswers: ('busy' | 429 | 200)[] = [];
let signupStatus = 200;
let issued = 0;
const requests: string[] = [];

const RATE_LIMITED = { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function newSession() {
  issued += 1;
  const exp = Math.floor(now / 1000) + 3600;
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'student-1', exp, role: 'authenticated' })}.sig`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: `refresh-${issued}`,
    user: { id: 'student-1', aud: 'authenticated', role: 'authenticated', email: '', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: '2026-10-19T08:00:00Z' },
  };
}

async function fakeServer(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  requests.push(url.replace(SERVER, ''));
  if (url.startsWith(`${SERVER}/auth/v1/signup`)) {
    return signupStatus === 429 ? json(429, RATE_LIMITED) : json(200, newSession());
  }
  if (url.startsWith(`${SERVER}/auth/v1/token?grant_type=refresh_token`)) {
    const answer = refreshAnswers.shift() ?? 200;
    if (answer === 200) return json(200, newSession());
    if (answer === 'busy') now += 31_000;
    return json(429, RATE_LIMITED);
  }
  if (url.startsWith(`${SERVER}/rest/v1/rpc/`)) {
    // Sent with the public key only (no fresh access token): anon may run no function.
    return json(401, { code: '42501', message: 'permission denied for function get_me', details: null, hint: null });
  }
  throw new Error(`unexpected request ${url}`);
}

const stored = (): { refresh_token: string; user: { id: string } } | null => {
  const raw = mockStore.get(STORAGE_KEY);
  return raw === undefined ? null : JSON.parse(raw);
};

let appClient: () => SupabaseClient;
let createSupabaseApi: typeof import('../api').createSupabaseApi;

/**
 * The app runs auth-js's refresh ticker only in the foreground (client.ts, AppState); here the
 * tests trigger every refresh themselves, so the ticker of each client is stopped.
 */
async function withoutTicker(client: SupabaseClient): Promise<SupabaseClient> {
  await client.auth.initialize();
  await client.auth.stopAutoRefresh();
  return client;
}

beforeEach(async () => {
  jest.resetModules();
  now = Date.UTC(2026, 9, 19, 8, 0, 0);
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  globalThis.fetch = jest.fn(fakeServer) as typeof fetch;
  mockStore.clear();
  refreshAnswers = [];
  signupStatus = 200;
  issued = 0;
  requests.length = 0;
  appClient = require('../client').getSupabase;
  createSupabaseApi = require('../api').createSupabaseApi;
  await withoutTicker(appClient());
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Signs in anonymously, then lets the access token expire (the app was closed for hours). */
async function signedInAndExpired(client: SupabaseClient) {
  const { error } = await client.auth.signInAnonymously();
  expect(error).toBeNull();
  expect(stored()?.refresh_token).toBe('refresh-1');
  now += 2 * 60 * 60 * 1000;
}

it('auth-js alone removes the session on a refresh 429 (why client.ts wraps fetch)', async () => {
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  const plain = await withoutTicker(
    createClient(SERVER, 'public-key', {
      auth: { storage: mockStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    }),
  );
  await signedInAndExpired(plain);
  refreshAnswers = ['busy'];
  const { data, error } = await plain.auth.getSession();
  expect(data.session).toBeNull();
  expect(error).toMatchObject({ name: 'AuthApiError', status: 429 });
  expect(stored()).toBeNull();
});

it('keeps the session after a refresh 429, and the next refresh succeeds for the same account', async () => {
  const client = appClient();
  await signedInAndExpired(client);
  const events: string[] = [];
  client.auth.onAuthStateChange((event) => void events.push(event));

  refreshAnswers = ['busy'];
  const first = await client.auth.getSession();
  expect(first.data.session).toBeNull();
  expect(first.error).toMatchObject({ name: 'AuthRetryableFetchError', status: 503 });
  expect(stored()?.refresh_token).toBe('refresh-1');

  // After auth-js's failure cooldown (60 s) the next refresh goes out and works.
  now += 61_000;
  refreshAnswers = [200];
  const second = await client.auth.getSession();
  expect(second.error).toBeNull();
  expect(second.data.session?.refresh_token).toBe('refresh-2');
  expect(second.data.session?.user.id).toBe('student-1');
  expect(stored()?.refresh_token).toBe('refresh-2');
  expect(events).not.toContain('SIGNED_OUT');
});

it('retries a single refresh 429 at once', async () => {
  const client = appClient();
  await signedInAndExpired(client);
  refreshAnswers = [429, 200];
  const { data, error } = await client.auth.getSession();
  expect(error).toBeNull();
  expect(data.session?.refresh_token).toBe('refresh-2');
  expect(requests.filter((r) => r.includes('grant_type=refresh_token'))).toHaveLength(2);
});

it('passes a 429 on any other request through unchanged', async () => {
  signupStatus = 429;
  const { error } = await appClient().auth.signInAnonymously();
  expect(error).toMatchObject({ name: 'AuthApiError', status: 429 });
});

describe('API layer', () => {
  it('a refused anonymous sign-up is "biraz sonra dene"', async () => {
    signupStatus = 429;
    await expect(createSupabaseApi(appClient).ensureSignedIn()).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('a refused refresh is "biraz sonra dene": no new account, not "account gone"', async () => {
    const api = createSupabaseApi(appClient);
    await signedInAndExpired(appClient());
    refreshAnswers = ['busy'];
    await expect(api.getMe()).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(api.ensureSignedIn()).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(api.hasSession()).rejects.toMatchObject({ code: 'rate_limited' });
    expect(requests.filter((r) => r.startsWith('/auth/v1/signup'))).toHaveLength(1);
    expect(stored()?.refresh_token).toBe('refresh-1');
  });

  it('a session that is really gone still means "account gone"', async () => {
    const api = createSupabaseApi(appClient);
    await expect(api.getMe()).rejects.toMatchObject({ code: 'not_authenticated' });
    await expect(api.hasSession()).resolves.toBe(false);
  });
});
