/**
 * Texts of K-23 (WP-I): the student's card (src/ui/minor-status-card.tsx), the parent's approval
 * and objection (app/veli.tsx) and the two new server error codes. Moved into src/strings.ts by
 * the integration step (WP-J), which also adds `errors` to tr.groupErrors. The parent screen
 * says "sen" like the rest of tr.parent. Calm on both sides: nothing on the student's phone is
 * lost, the limits are explained, the parent decides without pressure.
 */

import type { MinorPolicy } from '../domain/minor-policy';

export const minorTr = {
  card: {
    title: 'Gruplar ve velin',
    closed:
      'Gruplar şimdilik yalnız 18 yaş ve üstüne açık. Sayaç, netler ve çalışma kayıtların her zamanki gibi çalışır; hepsi telefonunda kalır.',
    strict:
      'Gruplar, velin onay verince açılır. O zamana kadar sayaç, netler ve çalışma kayıtların her zamanki gibi çalışır.',
    basic:
      'Velin onay verene kadar gruplara katılabilirsin; yalnız görünmez çalışırsın, hazır tepki gönderip alamazsın ve yeni grup kuramazsın. Sayaç ve netlerin her zamanki gibi çalışır.',
    why: '18 yaşından küçükler için grup özelliklerini velinin haberiyle ve onayıyla tam açıyoruz.',
    notLinked:
      'Onay için velin kendi telefonunda Etüt’ü açıp Ayarlar → Veli modu’na senin veli kodunu yazar, sonra “Onaylıyorum”a dokunur. Veli kodunu Gruplar → Veli bağlantısı’ndan oluşturursun.',
    waiting: 'Velin bağlı; onayı bekleniyor. Velin Veli modu ekranında “Onaylıyorum”a dokununca bu sınırlar kalkar.',
    reminder: 'Velinin onayı hâlâ bekleniyor. Uygun bir anda ona hatırlatabilirsin.',
  },
  parent: {
    title: 'Veli onayı',
    approveInfo: (policy: Extract<MinorPolicy, 'strict' | 'basic'>) =>
      `${
        policy === 'strict'
          ? 'Onay verene kadar çocuğun gruplara katılamaz; yalnız hesabı ve seninle bağlantısı çalışır.'
          : 'Onay verene kadar çocuğun gruplara katılabilir ama görünmez çalışır, hazır tepki gönderemez ve grup kuramaz.'
      } Onaylarsan bu sınırlar kalkar; yukarıdaki ayarlarla grupları yine istediğin gibi sınırlayabilirsin. Onayın tarihiyle kaydedilir.`,
    approve: 'Onaylıyorum',
    approvedOn: (day: string) => `${day} tarihinde onay verdin.`,
    approvedByOther: 'Bağlı diğer veli onay verdi.',
    approvedNotice: 'Onayın kaydedildi.',
    objectInfo:
      'Çocuğunun Etüt’te grup hesabı olmasını istemiyorsan itiraz edebilirsin; o zaman grup hesabı silinir.',
    object: 'İtiraz ediyorum',
    objectConfirm: (nickname: string) =>
      `İtiraz edersen “${nickname}” adlı grup hesabı ve sunucudaki bilgileri (takma ad, grup üyelikleri, çalışma süreleri gibi) hemen silinir; bu geri alınamaz. Uygulama çocuğunun telefonunda grupsuz çalışmaya devam eder, oradaki kayıtlar silinmez. İstersen önce çocuğunla konuş.`,
    objectYes: 'Evet, grup hesabını sil',
    objected: 'İtirazın kaydedildi; grup hesabı silindi.',
  },
  errors: {
    minor_closed: 'Gruplar şimdilik yalnız 18 yaş ve üstüne açık.',
    minor_pending: 'Bu özellik velin onay verince açılır.',
  },
} as const;
