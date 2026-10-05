/**
 * Feature flags. Changing a flag needs a new build; nothing is fetched remotely.
 */

/**
 * Group module backed by the self-hosted server (src/sync, supabase/). Off until the server in
 * Turkey exists (hukuk/kvkk/00). While false the app makes no network request at all and the
 * Groups tab shows the "Yakında" card; the supabase client is never even loaded.
 */
export const GROUPS_ENABLED: boolean = false;

/**
 * What must exist before GROUPS_ENABLED may be switched on (docs/hukuk/03, kvkk/12). Remove an
 * item only when it is done; src/config/__tests__/launch-gate.test.ts fails while the flag is on
 * and anything is left here. Not shown to users.
 */
export const GROUPS_LAUNCH_BLOCKERS: readonly string[] = [
  'K-23: 15-17 hesabında veli onayı alınana kadar yalnız temel işlevler (nihai akışa avukat karar verir)',
  'K-31 / K-38: uygulama içinde görünür iletişim, şikâyet ve KVKK başvuru kanalı',
  'K-37: web üzerinden hesap silme adresi (Google Play "Delete account URL")',
  'K-28 / K-29: "danger" raporu ve 24 saati aşan rapor için operatöre yurt içi kanaldan anında uyarı',
  'K-25 / K-42: web sitesinde aydınlatma metni, çocuk güvenliği sayfası ve iletişim (PRIVACY_NOTICE_URL)',
];
