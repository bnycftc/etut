/**
 * Page modules of the public legal web site with the group module (Etüt 0.5).
 * `node scripts/gen-legal-site.mjs --gruplar <out-dir>` turns every module of this folder into one
 * HTML page; files whose name starts with "_" (like this one) hold shared types and text and are
 * never a page.
 *
 * Format. Each page module exports one constant:
 *
 *   export const page: LegalPage = {
 *     slug: 'veli',                       // URL path without .html, see below
 *     title: 'Velilere',                  // <h1> and <title>
 *     updated: LEGAL_PAGES_UPDATED,       // "Son güncelleme" date as shown
 *     nav: { label: 'Velilere', order: 4 }, // optional: entry in the site menu
 *     intro: ['Paragraf…'],               // optional: blocks above the first heading
 *     sections: [{ heading: 'Başlık', blocks: ['Paragraf…', { list: ['…'] }] }],
 *   };
 *
 *   slug    lower-case a–z, 0–9, '-' and '/': 'veli' → veli.html, 'gizlilik/arsiv' →
 *           gizlilik/arsiv.html, 'index' → the home page. Unique across the folder.
 *   blocks  a paragraph (string), { list: string[] } or { table: { head: string[]; rows: string[][] } }.
 *   text    plain text, HTML is escaped. Links: [metin](hedef), hedef = another page's slug
 *           (resolved to a relative .html path; an unknown slug stops the build) or an https: URL.
 *
 * Every sentence is checked against the code (supabase/migrations, src/sync, infra) before it
 * goes in, and only publishable text belongs here: this repository is public. Legal reasoning,
 * open questions and review notes stay in the private documents; scripts/gen-legal-site.test.mjs
 * fails on their markers.
 */

import { DATA_CONTROLLER } from '../../strings';

export type LegalBlock =
  | string
  | { readonly list: readonly string[] }
  | { readonly table: { readonly head: readonly string[]; readonly rows: readonly (readonly string[])[] } };

export interface LegalPageSection {
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalPage {
  readonly slug: string;
  readonly title: string;
  readonly updated: string;
  readonly nav?: { readonly label: string; readonly order: number };
  readonly intro?: readonly LegalBlock[];
  readonly sections: readonly LegalPageSection[];
}

/** "Son güncelleme" of the group-version pages. */
export const LEGAL_PAGES_UPDATED = '19 Ekim 2026';

/**
 * Same values as the app (EXPO_PUBLIC_DATA_CONTROLLER_*; placeholder without them). No postal
 * address: whether one is published (K-42: PK or virtual office) is bny's open decision. Until
 * then contact is by e-mail only; add the address here and on iletisim.ts once it is decided.
 */
export const C = DATA_CONTROLLER;

/**
 * Where the e-mail lands. Written for the domestic mailbox of the plan (bny's step 7: a mailbox on
 * our own .com.tr domain hosted in Türkiye, DATA_CONTROLLER_CONTACT switched to it). Pending: as
 * long as the contact address is still the Gmail one, this sentence and every "yurt dışına
 * aktarım yok" are wrong; do not publish the group pages before that switch.
 */
export const MAILBOX_IN_TURKEY = 'E-posta kutumuz da Türkiye’de barındırılır.';

/** KVKK m.11 rights, (a)–(ğ), the same wording as the device version (src/strings.ts). */
export const KVKK_RIGHTS: readonly string[] = [
  '(a) Hakkında kişisel veri işlenip işlenmediğini öğrenmek.',
  '(b) İşlendiyse bununla ilgili bilgi istemek.',
  '(c) Verilerinin hangi amaçla işlendiğini ve bu amaca uygun kullanılıp kullanılmadığını öğrenmek.',
  '(ç) Verilerinin yurt içinde ya da yurt dışında kimlere aktarıldığını bilmek.',
  '(d) Verilerin eksik ya da yanlış işlendiyse düzeltilmesini istemek.',
  '(e) Verilerinin KVKK m.7’deki şartlarla silinmesini ya da yok edilmesini istemek.',
  '(f) (d) ve (e)’ye göre yapılan düzeltmenin ya da silmenin, verilerinin aktarıldığı kişilere de bildirilmesini istemek.',
  '(g) Verilerinin yalnız otomatik sistemlerle analiz edilmesi sonucunda aleyhine bir sonuç çıkarsa buna itiraz etmek.',
  '(ğ) Verilerinin kanuna aykırı işlenmesi yüzünden zarara uğradıysan zararının giderilmesini istemek.',
];

/** How to apply (KVKK m.13). In-app requests come with WP-C; link them here when it lands. */
export const HOW_TO_APPLY =
  `Başvurunu e-postayla ${C.contact} adresine ya da uygulamada Hakkında → İletişim’den yapabilirsin. ` +
  'Grup hesabı anonim olduğu için, başkasının bilgisini sana vermemek adına hesabını bulmamıza yarayacak ek bilgi isteyebiliriz. ' +
  'En geç 30 gün içinde ücretsiz ve yazılı cevap veririz. Cevabımızdan memnun kalmazsan ya da 30 gün içinde cevap alamazsan Kişisel Verileri Koruma Kurulu’na şikâyet edebilirsin.';

/** How the group account is deleted (public.delete_my_account: at once, cascading). */
export const HOW_TO_DELETE =
  'Grup hesabını istediğin an Gruplar → Grup hesabı → Grup hesabımı sil ile (yalnız sunucudaki grup hesabı) ya da Ayarlar → Tüm verileri sil ile (telefon ve sunucu birlikte) silebilirsin. Silme hemen olur.';

/** What survives an account deletion and for how long (migrations: audit.*, reports, backups). */
export const AFTER_DELETION: readonly string[] = [
  'Güvenlik kayıtları (hesap numarası, işlem, zaman, IP adresi) 395 gün, sunucu erişim kaydı 400 gün saklanır ve süresi dolunca silinir. Bu kayıtlar yalnız yasal bir talep ya da güvenlik incelemesi için açılır.',
  'Senin yaptığın ya da senin hakkında yapılmış bir bildirimin (rapor) kaydı, sana bağlantısı kaldırılarak kalır ve kapandıktan 2 yıl sonra silinir.',
  'Şifreli yedekler 30 günlük bir döngüyle yenilenir; silinen bilgiler yedeklerden de bu döngüyle, en geç 40 gün içinde çıkar.',
];
