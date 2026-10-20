/**
 * Feature flags. Changing a flag needs a new build; nothing is fetched remotely.
 */

/**
 * Launch phase of the group module backed by the self-hosted server (src/sync, supabase/):
 * - 'off': no server yet (hukuk/kvkk/00). The app makes no network request at all, the Groups tab
 *   of a 15+ profile only shows the "Yakında" preview (src/ui/groups-teaser.tsx; bny, 2026-10-18,
 *   replacing the 2026-10-11 "no tab" decision) and the supabase client is never even loaded.
 * - 'beta18': closed TestFlight beta from release/0.5.0, adults only; the server refuses 15-17
 *   (app.minor_policy = 'closed').
 * - 'public': the store release.
 * Kept on one line in this exact form: .github/workflows/testflight.yml reads it with sed (and
 * src/config/__tests__/launch-gate.test.ts checks that it still can).
 */
export type GroupsPhase = 'off' | 'beta18' | 'public';
export const GROUPS_PHASE: GroupsPhase = 'off';

/** The group module is on in any phase but 'off'. */
export const GROUPS_ENABLED: boolean = GROUPS_PHASE !== 'off';

export interface LaunchBlocker {
  id: string;
  text: string;
  /** The first phase that may not ship while this item is open ('public' items allow the beta). */
  phase: Exclude<GroupsPhase, 'off'>;
}

/**
 * What must exist before GROUPS_PHASE may move past 'off' (docs/hukuk/03, kvkk/12). Remove an item
 * only when it is done; src/config/__tests__/launch-gate.test.ts fails while an item of the current
 * phase or an earlier one is left here. Not shown to users.
 */
export const GROUPS_LAUNCH_BLOCKERS: readonly LaunchBlocker[] = [
  {
    id: 'K-23',
    text: 'K-23: 15-17 hesabında veli onayı alınana kadar yalnız temel işlevler (nihai akışa avukat karar verir)',
    phase: 'public',
  },
  {
    id: 'K-31/K-38',
    text: 'K-31 / K-38: uygulama içinde görünür iletişim, şikâyet ve KVKK başvuru kanalı',
    phase: 'beta18',
  },
  {
    id: 'K-37',
    text: 'K-37: web üzerinden hesap silme adresi (Google Play "Delete account URL")',
    phase: 'public',
  },
  {
    id: 'K-28/K-29',
    text: 'K-28 / K-29: "danger" raporu ve 24 saati aşan rapor için operatöre yurt içi kanaldan anında uyarı',
    phase: 'beta18',
  },
  {
    id: 'K-25/K-42',
    text: 'K-25 / K-42: web sitesinde aydınlatma metni, çocuk güvenliği sayfası ve iletişim (PRIVACY_NOTICE_URL)',
    phase: 'beta18',
  },
  {
    id: 'K-17',
    text: 'K-17: iOS Declared Age Range sinyali okunur; cihazdaki beyanla çelişirse düşük yaş esas alınır',
    phase: 'beta18',
  },
  {
    id: 'K-44',
    text: 'K-44 / kvkk/11: App Privacy, yaş derecelendirmesi (Parental Controls), Data safety ve inceleme notları grup modülüyle tutarlı ve gönderilen sürümle karşılaştırıldı',
    phase: 'public',
  },
  {
    id: 'hesap-kaybi',
    text: 'Anonim hesap kaybı: GoTrue IP başına sınırları (token yenileme, anonim kayıt) okul/operatör NAT yükünde denendi; uzun vadede Apple/Google hesap bağlama',
    phase: 'beta18',
  },
];

const PHASE_ORDER: readonly GroupsPhase[] = ['off', 'beta18', 'public'];

/** The blockers that keep `phase` from shipping: none for 'off', the beta's for 'beta18', all for 'public'. */
export function blockersFor(phase: GroupsPhase, blockers: readonly LaunchBlocker[] = GROUPS_LAUNCH_BLOCKERS): LaunchBlocker[] {
  const reached = PHASE_ORDER.indexOf(phase);
  return blockers.filter((b) => PHASE_ORDER.indexOf(b.phase) <= reached);
}
