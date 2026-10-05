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
  });
  // Refresh tokens only while the app is in the foreground (supabase React Native guidance).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') created.auth.startAutoRefresh();
    else created.auth.stopAutoRefresh();
  });
  client = created;
  return created;
}
