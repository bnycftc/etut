/**
 * The supabase client, created on first use only and only when the group module is on. Both the
 * library and the localStorage shim are loaded lazily (require), so a build with the flag off
 * never runs them and never opens a connection.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { GROUPS_ENABLED } from '../config/features';
import { serverConfig } from './config';

let client: SupabaseClient | null = null;

export class SyncUnavailableError extends Error {
  constructor(reason: 'disabled' | 'not_configured') {
    super(reason);
    this.name = 'SyncUnavailableError';
  }
}

const isTokenRefresh = (input: RequestInfo | URL): boolean => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return url.includes('/auth/v1/token?') && url.includes('grant_type=refresh_token');
};

/**
 * Many students share one IP behind school Wi-Fi or carrier NAT, so GoTrue's per-IP limit can
 * refuse a token refresh with 429. auth-js treats a 429 as final: when the access token has
 * already expired it removes the session (GoTrueClient _callRefreshToken), and an anonymous
 * account cannot be signed into again. A 5xx is retried and keeps the session, so a refused
 * refresh is passed on as 503 with GoTrue's body ("Request rate limit reached"). Every other
 * request is untouched.
 */
const keepSessionOn429: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status !== 429 || !isTokenRefresh(input)) return response;
  return new Response(await response.text(), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: response.headers,
  });
};

export function getSupabase(): SupabaseClient {
  if (!GROUPS_ENABLED) throw new SyncUnavailableError('disabled');
  if (client !== null) return client;
  const config = serverConfig();
  if (config === null) throw new SyncUnavailableError('not_configured');
  // Persists the auth session on the device (expo-sqlite kv-store), per the Expo guide.
  require('expo-sqlite/localStorage/install');
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  const created = createClient(config.url, config.key, {
    auth: {
      storage: globalThis.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: { fetch: keepSessionOn429 },
  });
  // Refresh tokens only while the app is in the foreground (supabase React Native guidance).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') created.auth.startAutoRefresh();
    else created.auth.stopAutoRefresh();
  });
  client = created;
  return created;
}
