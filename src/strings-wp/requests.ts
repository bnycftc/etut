/**
 * Texts of the in-app KVKK application channel (WP-C: app/basvuru.tsx, app/basvurularim.tsx,
 * src/ui/requests-entry.tsx). Moved into src/strings.ts by the integration step (WP-J).
 * Wording follows docs/hukuk/kvkk/07 C1, C2, C4, C5.
 */

import type { AnswerResult, RequestApplicant, RequestInputError, RequestKind } from '../domain/dsr';

export const requestsTr = {
  form: {
    title: 'KVKK başvurusu',
    intro:
      'KVKK’nın 11. maddesindeki haklarını kullanmak ya da bir şikâyeti bildirmek için buradan yazabilirsin. Başvurun hesabından geldiği için kimliğini ayrıca kanıtlaman gerekmez. Ücretsizdir; cevabımız en geç 30 gün içinde yazılı olarak Başvurularım ekranına gelir.',
    kind: 'Talep türü',
    kinds: {
      processed: 'Kişisel verilerim işleniyor mu?',
      info: 'İşlenen verilerim hakkında bilgi istiyorum',
      purpose: 'Verilerimin hangi amaçla işlendiğini ve amacına uygun kullanılıp kullanılmadığını öğrenmek istiyorum',
      recipients: 'Verilerimin yurt içinde ya da yurt dışında kimlere aktarıldığını öğrenmek istiyorum',
      correction: 'Eksik ya da yanlış işlenen verilerimin düzeltilmesini istiyorum',
      deletion: 'Verilerimin silinmesini ya da yok edilmesini istiyorum',
      notify_recipients: 'Düzeltme ya da silmenin verilerimin aktarıldığı kişilere bildirilmesini istiyorum',
      automated_decision: 'Yalnız otomatik sistemlerle yapılan bir değerlendirmenin aleyhime sonucuna itiraz ediyorum',
      damages: 'Hukuka aykırı işleme yüzünden uğradığım zararın giderilmesini istiyorum',
      complaint: 'Şikâyet / bildirim',
      other: 'Diğer',
    } as Record<RequestKind, string>,
    applicant: 'Başvuran',
    applicants: {
      self: 'Kendim',
      parent: 'Velisi olduğum çocuğum adına',
    } as Record<RequestApplicant, string>,
    parentNote:
      'Çocuğun adına başvuruyorsan açıklamaya çocuğunun takma adını yaz. Veli modunda bağlı olduğun hesabı doğrularız; bağlantı yoksa yalnız genel bilgi verebiliriz.',
    body: 'Açıklama',
    bodyRequired: 'Açıklama (bu talep türünde gerekli)',
    bodyHint: 'Adını, T.C. kimlik numaranı ya da telefonunu yazmana gerek yok.',
    bodyCount: (n: number, max: number) => `${n}/${max}`,
    submit: 'Başvuruyu gönder',
    errors: {
      body_required: 'Bu talep türünde birkaç cümleyle ne olduğunu yazman gerekiyor.',
      body_too_long: 'Açıklama en fazla 2.000 karakter olabilir.',
    } as Record<RequestInputError, string>,
    invalid: 'Başvuru kaydedilemedi. Talep türünü ve açıklamayı kontrol et.',
    rateLimited: 'Bugün en fazla 5 başvuru gönderebilirsin. Yarın yeniden dene ya da bize e-postayla yaz.',
    received: (ref: string, date: string, due: string) =>
      `Başvurun alındı. Başvuru numaran: ${ref} · Tarih: ${date}. En geç ${due} tarihine kadar cevap vereceğiz.`,
    openList: 'Başvurularım',
    noAccount:
      'Bu cihazın sunucuda bir hesabı yok; verilerin yalnız bu telefonda duruyor. Başvuru ya da şikâyet için bize e-postayla yazabilirsin.',
    mail: 'E-posta gönder',
    mailFailed: 'E-posta uygulaması açılamadı.',
  },

  list: {
    title: 'Başvurularım',
    empty: 'Henüz başvurun yok.',
    newRequest: 'Yeni başvuru',
    number: (ref: string) => `Başvuru no: ${ref}`,
    submitted: (date: string) => `Başvuru tarihi: ${date}`,
    open: (due: string) => `Cevap bekleniyor · son gün ${due}`,
    overdue: (due: string) => `Cevap bekleniyor · son gün ${due} geçti; en kısa sürede yazacağız.`,
    answered: (date: string) => `Cevaplandı · ${date}`,
    newAnswer: 'Yeni cevap',
    read: 'Cevabı oku',
    hide: 'Cevabı gizle',
    seenAt: (when: string) => `Cevabı ilk açtığın zaman: ${when}`,
    loadFailed: 'Başvurular yüklenemedi.',
  },

  /** kvkk/07 C4: the answer as the applicant sees it. The answer text itself never changes. */
  answer: {
    title: 'KVKK Başvurusuna Cevap',
    controller: (name: string, contact: string) => `Veri sorumlusu: ${name}, ${contact}`,
    applicant: 'Başvuru sahibi: bu uygulamadaki hesabın',
    numberDate: (ref: string, date: string) => `Başvuru no / tarihi: ${ref} / ${date}`,
    subject: (kind: string) => `Talep konusu: ${kind}`,
    explanations: 'Açıklamalarımız',
    result: (result: string) => `Sonuç: ${result}`,
    results: {
      accepted: 'Kabul edildi',
      partial: 'Kısmen kabul edildi',
      rejected: 'Reddedildi',
    } as Record<AnswerResult, string>,
    date: (date: string) => `Cevap tarihi: ${date}`,
    objection:
      'Bu cevaba itiraz etmek istersen, cevabı öğrendiğin tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu’na şikâyette bulunabilirsin (KVKK m.14).',
  },

  export: {
    title: 'Sunucudaki verilerim',
    info: 'Sunucuda senin hakkında tutulan her şeyi (profilin, grupların, oturumların, tepkiler, başvuruların ve güvenlik kaydındaki işlemlerin) bir JSON dosyası olarak alabilirsin. IP adresleri bu dosyada yok. Telefonundaki kayıtlar da yok; onları Yedekle ekranından alırsın.',
    button: 'Verilerimi indir',
    fileName: (day: string) => `etut-sunucu-verilerim-${day}.json`,
    dialogTitle: 'Sunucudaki verilerim',
    done: 'Dosya hazır.',
    unavailable: 'Bu cihazda paylaşma ekranı açılamadı.',
  },

  entry: {
    title: 'KVKK başvurusu ve şikâyet',
    info: 'Verilerinle ilgili haklarını kullanmak ya da bir şikâyeti bildirmek için yaz. En geç 30 gün içinde yazılı cevap veririz.',
    apply: 'Başvuru yap',
    list: 'Başvurularım',
  },
};
