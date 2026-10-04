/**
 * Feature flags. Changing a flag needs a new build; nothing is fetched remotely.
 */

/**
 * Group module backed by the self-hosted server (src/sync, supabase/). Off until the server in
 * Turkey exists (hukuk/kvkk/00). While false the app makes no network request at all and the
 * Groups tab shows the "Yakında" card; the supabase client is never even loaded.
 */
export const GROUPS_ENABLED: boolean = false;
