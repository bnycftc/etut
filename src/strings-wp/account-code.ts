/**
 * Texts of the account code card (WP-D: src/ui/account-code-card.tsx). Moved into src/strings.ts
 * by the integration step (WP-J). Wording follows docs/hukuk/kvkk/07 A Yol 2 and the /hesap-sil
 * page (src/legal/pages/hesap-sil.ts): the code is how a group account is deleted once the app
 * is gone.
 */

export const accountCodeTr = {
  title: 'Hesap kodu',
  info: (contact: string) =>
    `Uygulamayı silersen ya da telefonunu kaybedersen grup hesabına bir daha giremezsin. O zaman bu kodu ${contact} adresine e-postayla gönder; grup hesabını biz sileriz. Kodu bir yere not et ya da kaydet.`,
  secret:
    'Kodu kimseyle paylaşma: kodu bilen herkes hesabının silinmesini isteyebilir. Sunucuda kodun kendisi değil, yalnız ondan türetilen bir özet tutulur; kodu yalnız bu telefon gösterir.',
  codeLabel: (spoken: string) => `Hesap kodun: ${spoken}`,
  loading: 'Hesap kodu yükleniyor…',
  copy: 'Kopyala ya da kaydet',
  copyMessage: (code: string) => `Etüt hesap kodum: ${code}`,
  missing:
    'Hesap kodun daha önce oluşturuldu ama bu telefonda kayıtlı değil. Bir yere not ettiysen o kod geçerli. Bulamıyorsan yeni bir kod oluştur; eski kod o an geçersiz olur.',
  renew: 'Yeni kod oluştur',
  renewConfirm: 'Yeni kod oluşturulunca eski kod geçersiz olur ve silme isteğinde kullanılamaz. Devam edilsin mi?',
  renewYes: 'Evet, yeni kod oluştur',
  renewed: 'Yeni hesap kodun oluşturuldu. Bir yere not et.',
  retry: 'Yeniden dene',
} as const;
