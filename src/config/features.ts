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
    text: 'K-23: 15-17 hesabında veli onayı alınana kadar yalnız temel işlevler. Kod tamam (WP-I: app.settings.minor_policy closed/strict/basic/open, parent_approve/parent_object, veli ekranı, MinorStatusCard; WP-J: kartın Gruplar ekranına yerleşimi ve minor_closed/minor_pending hata metinleri). Kalan: avukatın nihai akış görüşü, sunucuda minor_policy değerinin ona göre seçilmesi (betada closed kalır) ve /veli metninin o karara göre güncellenmesi',
    phase: 'public',
  },
  {
    id: 'K-31/K-38',
    text: 'K-31 / K-38: uygulama içinde görünür iletişim, şikâyet ve KVKK başvuru kanalı. Kod tamam (WP-C: app.dsr_requests, submit_request/my_requests/export_my_data, Başvuru ve Başvurularım ekranları, infra/scripts/requests.sh; WP-J: giriş kartı Gruplar ekranında ve Ayarlar → Gizlilik’te). Kalan: üretim sunucusunda göçün uygulanması ve bir deneme başvurusunun requests.sh ile cevaplanıp uygulamada görülmesi',
    phase: 'beta18',
  },
  {
    id: 'K-37',
    text: 'K-37: web üzerinden hesap silme adresi (Google Play "Delete account URL"). Kod tamam (WP-D: hesap kodu, app.delete_account, delete_by_account_code, infra/scripts/delete-by-code.sh, /hesap-sil sayfası; WP-J: AccountCodeCard Gruplar → Grup hesabı altında, ana sayfadan /hesap-sil bağlantısı). Kalan: gruplu sitenin web yayını (bny izni), yurt içi posta kutusu, sunucuda delete-by-code.sh ile bir deneme silmesi',
    phase: 'public',
  },
  {
    id: 'K-28/K-29',
    text: 'K-28 / K-29: "danger" raporu ve 24 saati aşan rapor için operatöre yurt içi kanaldan anında uyarı. Kod tamam (WP-B: ntfy (upstream kapalı) + msmtp, alert.sh 2 dakikalık zamanlayıcı, reports.sh, app.report_alert_counts). Kalan: sunucuda 09-ntfy.sh ve 08-timers.sh kurulumu, alert.sh --test ile iki kanalın denenmesi, bny’nin telefonuna ntfy aboneliği ve posta',
    phase: 'beta18',
  },
  {
    id: 'K-25/K-42',
    text: 'K-25 / K-42: web sitesinde aydınlatma metni, çocuk güvenliği sayfası ve iletişim (PRIVACY_NOTICE_URL). Kod tamam (WP-E: src/legal/pages, gen-legal-site.mjs --gruplar; WP-J: saklama, ana sayfa ve /veli düzeltmeleri, uygulama içinde gruplu şartlar ve gizlilik). Kalan: bny’nin metinleri okuyup onaylaması ve web yayını, src/config/legal.ts PRIVACY_NOTICE_URL’in doldurulması, yurt içi posta kutusu (MAILBOX_IN_TURKEY doğru olmadan yayın yok), K-42 posta adresi kararı, avukatın 18+ beta görüşü',
    phase: 'beta18',
  },
  {
    id: 'K-17',
    text: 'K-17: iOS Declared Age Range sinyali okunur; cihazdaki beyanla çelişirse düşük yaş esas alınır. Kod tamam (WP-F: expo-age-range, yetki eklentisi, resolveBand; WP-J: Gruplar kaydı açılınca sinyal istenir, 15 altı → yalnız cihaz modu ve yaş kaydı, 15–17 → beyan edilen yıl düşürülür). Kalan: Developer Portal’da App ID için Declared Age Range yeteneğinin açılması (yoksa beta18 derlemesinin imzası testflight.yml denetiminde düşer) ve iOS 26 cihazda paylaş / reddet / 15–17 denemesi (bny)',
    phase: 'beta18',
  },
  {
    id: 'K-44',
    text: 'K-44 / kvkk/11: App Privacy, yaş derecelendirmesi (Parental Controls), Data safety ve inceleme notları grup modülüyle tutarlı ve gönderilen sürümle karşılaştırıldı. Dosyalar hazır (WP-G: store/app-store/groups, demo grup; WP-J: Customer Support satırı app-privacy.md’de ve privacy manifest’te (plugins/with-age-range.js)). Kalan: herkese açık sürümden önce App Privacy’nin elle girilmesi, asc-metadata apply, gönderilen derlemeyle karşılaştırma (bny)',
    phase: 'public',
  },
  {
    id: 'hesap-kaybi',
    text: 'Anonim hesap kaybı: GoTrue IP başına sınırları (token yenileme, anonim kayıt) okul/operatör NAT yükünde denendi. Kod tamam (WP-H: 429’da oturum silinmez, config.toml ve üretim sınırları aynı, anonim kayıt 300/saat, scripts/nat-load.mjs). Kalan: üretim sunucusunda nat-load.mjs --onay ile yük denemesi ve sonucun infra/yuk-testi.md’ye yazılması. Uzun vadede Apple/Google hesap bağlama (bu engelin parçası değil)',
    phase: 'beta18',
  },
];

const PHASE_ORDER: readonly GroupsPhase[] = ['off', 'beta18', 'public'];

/** The blockers that keep `phase` from shipping: none for 'off', the beta's for 'beta18', all for 'public'. */
export function blockersFor(phase: GroupsPhase, blockers: readonly LaunchBlocker[] = GROUPS_LAUNCH_BLOCKERS): LaunchBlocker[] {
  const reached = PHASE_ORDER.indexOf(phase);
  return blockers.filter((b) => PHASE_ORDER.indexOf(b.phase) <= reached);
}
