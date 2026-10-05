/**
 * Every user-facing text of the app. Turkish only for now.
 * Keep wording neutral: no age hints on the birth-year screen (hukuk/03 K-15),
 * no "sosyal ağ / sohbet / topluluk" positioning (K-13).
 */

import type { MarkError } from './domain/exam-analysis';
import type { ReactionKind, ReportReason } from './domain/groups';
import type { ManualEntryError } from './domain/manual-entry';
import type { ExamKind, ScoreError, YksArea } from './domain/net';
import type { ExamType } from './domain/profile';

const subjects: Record<string, string> = {
  matematik: 'Matematik',
  geometri: 'Geometri',
  turkce: 'Türkçe',
  edebiyat: 'Türk Dili ve Edebiyatı',
  fizik: 'Fizik',
  kimya: 'Kimya',
  biyoloji: 'Biyoloji',
  tarih: 'Tarih',
  tarih1: 'Tarih-1',
  tarih2: 'Tarih-2',
  cografya: 'Coğrafya',
  cografya1: 'Coğrafya-1',
  cografya2: 'Coğrafya-2',
  felsefe: 'Felsefe',
  felsefe_grubu: 'Felsefe Grubu',
  din: 'Din Kültürü',
  yabanci_dil: 'Yabancı Dil',
  fen: 'Fen Bilimleri',
  inkilap: 'İnkılap Tarihi',
  vatandaslik: 'Vatandaşlık',
  guncel: 'Güncel Bilgiler',
  egitim_bilimleri: 'Eğitim Bilimleri',
  genel: 'Genel',
  diger: 'Diğer',
};

const examTypes: Record<ExamType, string> = {
  YKS: 'YKS',
  LGS: 'LGS',
  KPSS: 'KPSS',
  DIGER: 'Diğer',
};

const yksAreas: Record<YksArea, string> = {
  sayisal: 'Sayısal',
  esit_agirlik: 'Eşit Ağırlık',
  sozel: 'Sözel',
  dil: 'Dil',
};

const examKinds: Record<ExamKind, string> = {
  TYT: 'TYT',
  AYT_SAY: 'AYT Sayısal',
  AYT_EA: 'AYT Eşit Ağırlık',
  AYT_SOZ: 'AYT Sözel',
  YDT: 'AYT Dil (YDT)',
};

const scoreErrors: Record<ScoreError, string> = {
  not_integer: 'Tam sayı gir.',
  negative: 'Negatif olamaz.',
  too_many: 'Doğru + yanlış soru sayısını aşıyor.',
};

const weekdaysShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const months = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export const tr = {
  appName: 'Etüt',
  // An unknown id (e.g. sent by someone else's modified app) is never shown as text (K-09).
  subject: (id: string) => subjects[id] ?? 'Ders',
  examType: (t: ExamType) => examTypes[t],
  yksArea: (a: YksArea) => yksAreas[a],
  examKind: (k: ExamKind) => examKinds[k],
  scoreError: (e: ScoreError) => scoreErrors[e],
  weekdayShort: (index: number) => weekdaysShort[index] ?? '',
  /** `4 Ekim 2026` */
  longDate: (y: number, m: number, d: number) => `${d} ${months[m - 1] ?? ''} ${y}`,
  durationHm: (hours: number, minutes: number) =>
    hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`,

  common: {
    back: 'Geri',
    cancel: 'Vazgeç',
    save: 'Kaydet',
    delete: 'Sil',
    continue: 'Devam',
  },

  tabs: {
    timer: 'Sayaç',
    exams: 'Denemeler',
    groups: 'Gruplar',
    settings: 'Ayarlar',
  },

  onboarding: {
    title: 'Etüt’e hoş geldin',
    intro: 'Birkaç soruyla başlayalım. Cevapların yalnız bu cihazda saklanır.',
    birthYearTitle: 'Doğum yılın',
    birthYearHint: 'Yalnız yılı soruyoruz.',
    examTitle: 'Hazırlandığın sınav',
    areaTitle: 'Alanın',
    start: 'Başla',
    ageBlocked: 'Bu doğum yılı bu cihazda kaydedilemiyor. Seçimini kontrol edip yeniden dene.',
  },

  timer: {
    title: 'Sayaç',
    today: 'Bugün',
    history: 'Geçmiş',
    pickSubject: 'Ders seç',
    start: 'Başla',
    pause: 'Mola',
    resume: 'Devam',
    finish: 'Bitir',
    running: 'Çalışıyorsun',
    paused: 'Moladasın',
    awayTitle: (duration: string) => `${duration} uygulamanın dışındaydın.`,
    awayBody: 'Bu süre mola sayıldı.',
    awayCredit: 'Çalışıyordum, süreye ekle',
    awayDismiss: 'Tamam, mola kalsın',
    lessThanMinute: '1 dakikadan az',
    saved: (duration: string) => `Kaydedildi: ${duration}`,
    topics: 'Konular',
    addManual: 'Elle ekle',
    manualPart: (duration: string) => `${duration} elle eklendi`,
  },

  manual: {
    title: 'Elle süre ekle',
    intro:
      'Sayacı açmayı unuttuysan çalıştığın süreyi sonradan ekle. Bu kayıtlar her yerde “elle” etiketiyle görünür.',
    subject: 'Ders',
    day: 'Gün',
    start: 'Başlangıç',
    duration: 'Süre',
    hour: 'Saat',
    minute: 'Dakika',
    hours: 'Saat',
    minutes: 'Dakika',
    add: 'Ekle',
    added: (duration: string) => `Eklendi: ${duration} (elle)`,
    limits:
      'Yalnız son 7 gün (bugün dahil) için; tek kayıt en fazla 10 saat; gelecekteki ya da başka kayıtla çakışan zaman eklenemez.',
    placeholders: { startHour: '14', startMinute: '00', durationHours: '0', durationMinutes: '45' },
    errors: {
      invalid: 'Başlangıç saatini ve süreyi kontrol et.',
      too_old: 'Yalnız son 7 gün için süre eklenebilir.',
      too_short: 'Süre en az 1 dakika olmalı.',
      too_long: 'Tek kayıt en fazla 10 saat olabilir.',
      future: 'Henüz gelmemiş bir zaman eklenemez.',
      overlap: 'Bu saatlerde başka bir çalışma kaydın var.',
    } satisfies Record<ManualEntryError, string>,
    recent: 'Son elle eklediklerin',
    empty: 'Henüz elle eklenmiş süre yok.',
    deleteConfirm: 'Bu kayıt silinsin mi?',
    /** `4 Ekim 2026 · 14:30` */
    when: (date: string, hours: number, minutes: number) =>
      `${date} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  },

  /** Label of sessions added afterwards (`source = 'manual'`). */
  manualTag: 'elle',

  goal: {
    title: 'Günlük hedef',
    progress: (goal: string, percent: number) => `Hedef ${goal} · %${percent}`,
    met: 'Bugünkü hedefini tutturdun.',
    set: 'Günlük hedef koy',
    streak: (days: number) => `Seri: ${days} gün`,
    restUsed: 'Bu haftaki dinlenme günün kullanıldı.',
    restFree: 'Bu hafta 1 dinlenme günü hakkın var.',
    off: 'Kapalı',
    turnOff: 'Hedefi kapat',
    turnOn: 'Hedef koy',
    info: 'Hedefini tutturduğun ardışık günler seriyi oluşturur. Haftada 1 gün hedefin altında kalırsan seri bozulmaz; o gün dinlenme günü sayılır.',
  },

  countdown: {
    /** "YKS'ye 258 gün" — every built-in exam name ends in "S", so the suffix is "'ye". */
    days: (examType: ExamType, days: number) =>
      examType === 'DIGER' ? `Sınavına ${days} gün` : `${examTypes[examType]}’ye ${days} gün`,
    today: 'Sınav günü bugün. Başarılar!',
    estimated: 'tahmini',
    custom: 'senin girdiğin tarih',
    settingsTitle: 'Sınav tarihi',
    settingsInfo:
      'ÖSYM ve MEB 2027 takvimini henüz açıklamadı; gösterilen tarih tahminidir. Kesin tarih açıklanınca buradan düzeltebilirsin.',
    none: 'Tarih yok',
    input: 'Tarih (GG.AA.YYYY)',
    placeholder: 'GG.AA.YYYY',
    save: 'Tarihi kaydet',
    reset: 'Tahmini tarihe dön',
    invalid: 'Bugün ya da sonrası için GG.AA.YYYY biçiminde bir tarih gir.',
  },

  compare: {
    title: 'Kendinle kıyas',
    yesterday: 'Dün bu saate kadar',
    thisWeek: 'Bu hafta',
    lastWeek: 'Geçen hafta bu zamana kadar',
    weekly: 'Haftalık özet',
  },

  weekly: {
    title: 'Haftalık özet',
    range: (from: string, to: string) => `${from} – ${to}`,
    prev: '‹ Önceki hafta',
    next: 'Sonraki hafta ›',
    total: 'Toplam',
    previousWeek: (duration: string) => `Önceki hafta: ${duration}`,
    subjects: 'Ders dağılımı',
    longest: 'En uzun oturum',
    streak: 'Seri',
    goalDays: (n: number) => `Hedefi tutturduğun gün: ${n}/7`,
    activeDays: (n: number) => `Çalıştığın gün: ${n}/7`,
    manual: (duration: string) => `Elle eklenen: ${duration}`,
    empty: 'Bu hafta kayıtlı çalışma yok.',
    percent: (p: number) => `%${p}`,
  },

  pomodoro: {
    mode: 'Sayaç türü',
    stopwatch: 'Kronometre',
    pomodoro: 'Pomodoro',
    summary: (work: number, short: number, long: number, every: number) =>
      `${work} dk çalışma · ${short} dk mola · her ${every} turda bir ${long} dk uzun mola`,
    work: (block: number, of: number) => `Çalışma ${block}/${of}`,
    shortBreak: 'Kısa mola',
    longBreak: 'Uzun mola',
    paused: 'Duraklatıldı',
    studied: (clock: string) => `Toplam çalışma: ${clock}`,
    skip: 'Molayı geç',
    breakNote: 'Mola süresi çalışma süresine sayılmaz.',
    settingsTitle: 'Pomodoro',
    workLabel: 'Çalışma',
    shortLabel: 'Kısa mola',
    longLabel: 'Uzun mola',
    everyLabel: 'Uzun mola sıklığı',
    minutes: (n: number) => `${n} dk`,
    every: (n: number) => `${n} turda bir`,
    reset: 'Varsayılana dön',
  },

  topicPicker: {
    title: 'Konu (isteğe bağlı)',
    none: 'Konu seçilmedi',
    pick: 'Konu seç',
    change: 'Değiştir',
    close: 'Kapat',
    clear: 'Konusuz çalış',
  },

  topics: {
    title: 'Konular',
    pickSubject: 'Ders',
    progress: (percent: number, done: number, total: number) => `%${percent} · ${done}/${total} konu bitti`,
    percent: (p: number) => `%${p}`,
    reviewCount: (n: number) => `${n} konu tekrar bekliyor`,
    done: 'Bitti',
    review: 'Tekrar lazım',
    noTime: 'Henüz süre yok',
    noTopics: 'Bu ders için konu listesi yok.',
    unsupported: 'Konu listeleri YKS, LGS ve KPSS için var.',
  },

  history: {
    title: 'Geçmiş',
    last7: 'Son 7 gün',
    days: 'Günler',
    manualLine: (duration: string) => `Elle eklenen: ${duration}`,
    empty: 'Henüz kayıtlı çalışma yok.',
    todayLabel: 'Bugün',
    /** Short label above a bar: `2:05` (hours) or `45 dk`. */
    barValue: (hours: number, minutes: number) =>
      hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}` : `${minutes} dk`,
  },

  exams: {
    title: 'Denemeler',
    add: 'Deneme ekle',
    chartTitle: (kind: string) => `${kind} genel deneme netleri`,
    chartEmpty: 'Bu tür için henüz genel deneme yok.',
    listTitle: 'Tüm denemeler',
    empty: 'Henüz deneme eklemedin.',
    onlyYksNote: 'Şimdilik yalnız YKS (TYT/AYT) denemeleri destekleniyor.',
    net: 'net',
    totalNet: 'Toplam net',
    scopeGenel: 'Genel',
    scopeBrans: 'Branş',
    bransLabel: (subject: string) => `Branş: ${subject}`,
    newTitle: 'Yeni deneme',
    detailTitle: 'Deneme',
    kind: 'Sınav',
    scope: 'Deneme türü',
    section: 'Ders',
    date: 'Tarih',
    prevDay: '‹ Önceki gün',
    nextDay: 'Sonraki gün ›',
    correct: 'Doğru',
    wrong: 'Yanlış',
    questions: (n: number) => `${n} soru`,
    correctWrongShort: (correct: number, wrong: number) => `${correct} D · ${wrong} Y`,
    fixErrors: 'Hatalı alanları düzelt.',
    deleteConfirm: 'Bu deneme silinsin mi?',
    notFound: 'Deneme bulunamadı.',
  },

  analysis: {
    title: 'Deneme analizi',
    pendingTitle: (n: number) => `Analizi bekleyen ${n} deneme var`,
    pendingBody: 'Kitapçık gelince yanlış ve boş soruların konularını işaretle; neti zaten kaydettin.',
    start: 'Analize başla',
    complete: 'Analizi tamamla',
    edit: 'Analizi düzenle',
    pendingTag: 'analiz bekliyor',
    sectionSummary: (wrong: number, blank: number) => `${wrong} yanlış · ${blank} boş`,
    tagged: (wrongTagged: number, wrong: number, blankTagged: number, blank: number) =>
      `İşaretlenen: ${wrongTagged}/${wrong} yanlış · ${blankTagged}/${blank} boş`,
    addTopic: 'Konu ekle',
    close: 'Kapat',
    wrong: 'Yanlış',
    blank: 'Boş',
    nothing: 'Bu denemede yanlış ya da boş yok; analiz edecek bir şey kalmadı.',
    partialNote: 'Hepsini işaretlemek zorunda değilsin; bildiklerini işaretlemen yeter.',
    save: 'Analizi kaydet',
    markErrors: {
      not_integer: 'Tam sayı gir.',
      negative: 'Negatif olamaz.',
      too_many_wrong: 'İşaretlenen yanlışlar bu dersteki yanlış sayısını aşıyor.',
      too_many_blank: 'İşaretlenen boşlar bu dersteki boş sayısını aşıyor.',
    } satisfies Record<MarkError, string>,
    marksTitle: 'Yanlış ve boş konular',
    noMarks: 'Konu işaretlenmedi.',
    markRow: (wrong: number, blank: number) =>
      blank > 0 ? `${wrong} Y · ${blank} B` : `${wrong} Y`,
    topMissedTitle: 'En çok yanlış yaptığın 5 konu',
    topMissedEmpty: 'Deneme analizlerini tamamladıkça burada görünür.',
  },

  trend: {
    title: (kind: string) => `${kind} ders bazlı net`,
    empty: 'Bu ders için henüz net yok.',
    target: 'Hedef net',
    targetPlaceholder: 'ör. 30',
    targetNone: 'Bu ders için hedef koymadın.',
    targetCurrent: (target: string) => `Hedef: ${target} net`,
    targetSave: 'Hedefi kaydet',
    targetClear: 'Hedefi kaldır',
    targetInvalid: (questions: number) =>
      `0’dan büyük, en fazla ${questions} olan ve 0,25’in katı bir net gir (ör. 32,5).`,
    gap: (gap: string, average: string) =>
      `Hedefe ${gap} net kaldı (son denemelerin ortalaması: ${average}).`,
    reached: (average: string) => `Hedefe ulaştın (son denemelerin ortalaması: ${average}).`,
  },

  groups: {
    title: 'Gruplar',
    soon: 'Yakında',
    body: 'Davetle kurulan küçük çalışma grupları üzerinde çalışıyoruz. Sayaç ve denemeler gruplardan bağımsız çalışır.',
    // Group module (GROUPS_ENABLED). Wording: "çalışma grubu", never "sosyal ağ / topluluk" (K-13).
    introTitle: 'Çalışma grupları',
    introBody:
      'Davet koduyla kurulan, en fazla 30 kişilik gruplarda kimin şu an çalıştığını ve günlük, haftalık süreleri görürsün. Sohbet yoktur; yalnız hazır tepkiler vardır. Sayaç ve denemeler gruplar olmadan da tam çalışır.',
    introData:
      'Grupları açarsan takma adın, sınav türün, yaş bandın (15–17 ya da 18+; doğum yılın gönderilmez) ve çalışma oturumların Türkiye’deki sunucumuzda tutulur. Denemelerin ve netlerin cihazında kalır.',
    introSecurity:
      'Güvenlik ve yasal zorunluluk (5651) için yaptığın işlemler hesap numarası, zaman ve IP adresiyle 395 gün saklanır. Reklam ve analitik yok; hiçbir bilgin yurt dışına gönderilmez.',
    privacyLink: 'Bilgilerin ne oluyor? (Gizlilik)',
    unavailableLgs: 'Gruplar YKS, KPSS ve diğer sınavlar için. LGS profilinde sayaç ve denemeler gruplar olmadan tam çalışır.',
    nickname: 'Takma ad',
    nicknameHint: 'Gerçek adını, okulunu, şehrini ya da sosyal medya adını yazma.',
    nicknamePlaceholder: 'ör. Gece Kuşu',
    enable: 'Grupları aç',
    unavailable: 'Gruplar yalnız 15 yaş ve üstü için.',
    loading: 'Yükleniyor…',
    retry: 'Yeniden dene',
    myGroups: 'Grupların',
    noGroups: 'Henüz bir grupta değilsin.',
    pending: 'Onay bekliyor',
    owner: 'kurucu',
    members: (n: number) => `${n}/30 kişi`,
    createTitle: 'Grup kur',
    groupName: 'Grup adı',
    groupNamePlaceholder: 'ör. Sayısal Ekip',
    suggestions: ['Sayısal Ekip', 'EA Masası', 'Sözel Kampı', 'Dil Grubu', 'Mezunlar', 'Gece Etüdü'],
    create: 'Grubu kur',
    joinTitle: 'Koda katıl',
    joinHint: 'Kurucudan aldığın 8 haneli kodu yaz. Kurucu onaylayınca gruba girersin.',
    code: 'Davet kodu',
    codePlaceholder: 'ABCD-EFGH',
    join: 'Katılma isteği gönder',
    joinStatus: {
      requested: 'İsteğin kurucuya iletildi. Onaylanınca grup burada görünür.',
      already_member: 'Zaten bu gruptasın.',
      already_pending: 'Bu grup için bekleyen bir isteğin var.',
      invalid_code: 'Kod geçersiz ya da süresi dolmuş.',
      group_full: 'Bu grup dolu (30 kişi).',
      rate_limited: 'Çok fazla deneme yaptın. Biraz sonra yeniden dene.',
    },
    settingsTitle: 'Grup ayarların',
    invisible: 'Görünmez çalış',
    invisibleInfo: 'Açıkken grupların seni “şu an çalışıyor” listesinde görmez. Süren sıralamada yine sayılır.',
    reactions: 'Tepkileri al',
    reactionsInfo: 'Kapalıyken kimse sana hazır tepki gönderemez.',
    on: 'Açık',
    off: 'Kapalı',
    lockedByParent: 'Velin bu ayarı kilitledi.',
    parentDisabled: 'Velin grup özelliklerini kapattı. Sayaç, denemeler ve diğer her şey çalışmaya devam eder.',
    limitReached: 'Bugünkü grup süresi doldu (velinin koyduğu sınır). Yarın yeniden açılır.',
    limitInfo: (minutes: number) => `Velinin koyduğu günlük grup sınırı: ${minutes} dk`,
    reactionsTitle: 'Sana gelen tepkiler',
    reactionLine: (from: string, reaction: string, group: string) => `${from}: ${reaction} (${group})`,
    parentTitle: 'Veli bağlantısı',
    parentInfo:
      'Velin kendi telefonunda Etüt’ü açıp Ayarlar → Veli modu’na bu kodu yazar. Velin grup ayarlarını kilitleyebilir, günlük sınır koyabilir ve haftalık çalışma süreni görür. Kod 10 dakika geçerlidir.',
    parentLinked: (n: number) => (n === 1 ? 'Bir velin bağlı.' : `${n} velin bağlı.`),
    parentCode: 'Veli kodu oluştur',
    parentCodeShown: (code: string, minutes: number) => `Kod: ${code} · ${minutes} dk geçerli`,
    accountTitle: 'Grup hesabı',
    deleteAccount: 'Grup hesabımı sil',
    deleteAccountConfirm:
      'Sunucudaki takma adın, grup üyeliklerin, çalışma sürelerin, tepkilerin ve veli bağlantın hemen ve kalıcı olarak silinir. Cihazındaki kayıtlar kalır. Yasal zorunluluk gereği yalnız güvenlik kayıtları (hesap numarası, işlem, zaman, IP) 395 gün saklanır.',
    deleteAccountYes: 'Evet, sunucudan sil',
    deleted: 'Grup hesabın silindi.',
  },

  group: {
    title: 'Grup',
    live: 'Şu an',
    studying: (subject: string, duration: string) => `çalışıyor · ${subject} · ${duration}`,
    paused: 'molada',
    notStudying: 'çalışmıyor',
    you: 'sen',
    invisibleSelf: 'görünmezsin',
    ranking: 'Sıralama',
    today: 'Bugün',
    week: 'Bu hafta',
    manualPart: (duration: string) => `${duration} elle`,
    unverifiedPart: (duration: string) => `${duration} çevrimdışı`,
    updated: 'Sıralama 5 dakikada bir güncellenir. “Çevrimdışı” süreyi sunucu canlı görmedi; “elle” sonradan eklendi.',
    limitTitle: 'Bugünkü grup süresi doldu',
    inviteTitle: 'Davet kodu',
    inviteNone: 'Etkin kod yok.',
    inviteValid: (code: string, hours: number) => `${code} · ${hours} saat geçerli`,
    inviteInfo: 'Kodu yalnız tanıdığın kişilere ver. Kodla gelen her isteği sen onaylarsın.',
    rotate: 'Yeni kod',
    revoke: 'Kodu iptal et',
    requestsTitle: 'Katılma istekleri',
    noRequests: 'Bekleyen istek yok.',
    approve: 'Onayla',
    reject: 'Reddet',
    decideStatus: {
      approved: 'Gruba eklendi.',
      rejected: 'İstek reddedildi.',
      group_full: 'Grup dolu (30 kişi).',
      not_allowed: 'Bu kişi şu an gruplara katılamıyor.',
    },
    memberActions: (nickname: string) => `${nickname} için`,
    sendReaction: 'Hazır tepki gönder',
    reactionStatus: {
      sent: 'Gönderildi.',
      limit: 'Bugün bu kişiye en fazla 3 tepki gönderebilirsin.',
      not_allowed: 'Bu kişiye şu an tepki gönderilemiyor.',
      invalid: 'Gönderilemedi.',
    },
    report: 'Bildir',
    reportReason: 'Neden?',
    reportStatus: {
      reported: 'Bildirimin alındı ve incelemeye alındı.',
      rate_limited: 'Bugün çok fazla bildirim yaptın.',
      invalid: 'Bildirim gönderilemedi.',
    },
    dangerNote: 'Acil bir tehlike varsa hemen 112’yi ara.',
    block: 'Engelle',
    blocked: 'Engellendi. Artık sana tepki gönderemez; ikiniz de birbirinizi listelerde görmezsiniz.',
    remove: 'Gruptan çıkar',
    reportGroup: 'Grup adını bildir',
    leave: 'Gruptan çık',
    leaveConfirm: 'Gruptan çıkmak istiyor musun? Yeniden girmek için kod ve onay gerekir.',
    close: 'Kapat',
  },

  reactionKinds: {
    tebrik: 'Tebrikler',
    hadi: 'Hadi!',
    helal: 'Helal olsun',
    basarilar: 'Başarılar',
  } as Record<ReactionKind, string>,

  reportReasons: {
    nickname: 'Uygunsuz takma ad',
    group_name: 'Uygunsuz grup adı',
    harassment: 'Rahatsız ediyor',
    danger: 'Tehlike / kendine zarar',
    other: 'Diğer',
  } as Record<ReportReason, string>,

  parent: {
    title: 'Veli modu',
    entry: 'Veli modu',
    entryInfo: 'Çocuğun Etüt’te gruplara katıldıysa, onun ekranındaki veli kodunu burada girerek ayarlarını yönetebilirsin.',
    intro:
      'Çocuğunun telefonunda Gruplar → Veli bağlantısı → “Veli kodu oluştur”a dokunsun. Ekranda çıkan 8 haneli kodu buraya yaz. E-posta ya da telefon numarası istemiyoruz.',
    code: 'Veli kodu',
    link: 'Bağla',
    claimStatus: {
      linked: 'Bağlandı.',
      invalid_code: 'Kod geçersiz ya da süresi dolmuş.',
      rate_limited: 'Çok fazla deneme yapıldı. Biraz sonra yeniden dene.',
      not_allowed: 'Bu cihazdaki öğrenci hesabıyla veli bağlantısı kurulamaz.',
      parent_limit: 'Bu öğrenciye en fazla 2 veli bağlanabilir.',
    },
    children: 'Bağlı öğrenciler',
    none: 'Henüz bağlı öğrenci yok.',
    groupsOff: 'Grup özelliklerini kapat',
    forceInvisible: 'Görünmez çalışmayı zorunlu yap',
    dailyLimit: 'Günlük grup süresi sınırı',
    noLimit: 'Sınır yok',
    weekly: 'Son 7 günün çalışma süresi',
    purchases: 'Uygulama içi satın almalar App Store / Google Play aile onayına bağlıdır (Satın Almak İçin Sor / Family Link).',
    unlink: 'Bağlantıyı kaldır',
    unlinkConfirm: 'Bağlantı kaldırılınca senin koyduğun kilitler de kalkar.',
    otherParents: (n: number) =>
      `Bu öğrenciye ${n === 1 ? 'başka bir' : `${n} başka`} veli hesabı daha bağlı. Tüm velilerin ayarlarından en kısıtlayıcı olanı geçerlidir; bu hesabı tanımıyorsan çocuğunla konuş.`,
    linkGone:
      'Bağlı öğrenci yok. Bağlantıyı sen kaldırdıysan ya da öğrenci grup hesabını sildiyse burada görünmez; o zaman kilitler de geçerli değildir.',
    accountGone: 'Bu cihazdaki veli hesabı sunucuda artık yok. Yeniden bağlanmak için öğrencinin yeni bir kod oluşturması gerekir.',
  },

  privacy: {
    title: 'Gizlilik',
    intro: 'Gruplar açıkken bilgilerinin ne olduğunu kısaca anlatıyoruz. Onay istemiyoruz; yalnız bilmeni istiyoruz.',
    sections: [
      {
        title: 'Ne tutuyoruz?',
        body: 'Takma adın, sınav türün, yaş bandın (15–17 ya da 18+) ve bu bandı hangi yıl bildirdiğin, grupların ve katılma isteklerin, çalışma oturumların (başlangıç, bitiş, süre, sayaç mı “elle” mi; ders ve konu gönderilmez), çalışırken o an hangi derse çalıştığın, hazır tepkiler, bildirdiğin ve engellediğin kişiler, veli bağlantın ve velinin ayarları. Hiçbir grupta değilken oturumların ve canlı durumun gönderilmez.',
      },
      {
        title: 'Toplamadıklarımız',
        body: 'Adın, doğum yılın, e-postan, telefonun, okulun, konumun, fotoğrafların, rehberin. Denemelerin ve netlerin yalnız cihazında kalır.',
      },
      {
        title: 'Kim görüyor?',
        body: 'Yalnız aynı gruptakiler: takma adın; görünmez değilsen o an çalıştığın ders ve ne zamandır çalıştığın; günlük ve haftalık süren ve sıralaman. Bağlı velin son 7 günün günlük toplam süresini görür. Engellediğin kişiyle birbirinizi görmezsiniz.',
      },
      {
        title: 'Güvenlik kaydı',
        body: 'Kötüye kullanımı önlemek ve yasal zorunluluk (5651) için yaptığın işlemler hesap numarası, zaman ve IP adresiyle 395 gün (yaklaşık 13 ay) saklanır. Bu kayıt hesabını silsen de süresi dolana kadar kalır ve yalnız yasal bir talep olursa açılır.',
      },
      {
        title: 'Nerede, ne kadar?',
        body: 'Türkiye’deki sunucumuzda; yurt dışına gönderilmez, reklam ve analitik yok. Hesabın açık olduğu sürece tutulur; 6 ay kullanmazsan hesap kendiliğinden silinir. Hazır tepkiler 90 gün sonra silinir.',
      },
      {
        title: 'Hakların',
        body: 'Bilgilerini öğrenebilir, düzelttirebilir ve sildirebilirsin. Cihazdan sildiğin bir oturum sunucudan da silinir. Grup hesabını Gruplar ekranından ya da Ayarlar → Tüm verileri sil ile hemen silersin.',
      },
    ],
    under18Title: '18 yaşından küçüksen',
    under18:
      'Velin de bilsin istiyoruz: bu sayfayı ona göster. Velin kendi telefonunda veli modunu açıp grup ayarlarını kilitleyebilir ve günlük sınır koyabilir. Doğum yılına göre 18 yaşını doldurduğun kesinleşince Gruplar ekranını ilk açışında veli bağlantısı ve velinin kilitleri kendiliğinden biter.',
    fullText: 'Tam aydınlatma metni',
    settingsEntry: 'Gizlilik ve verilerin',
  },

  groupErrors: {
    name_length: 'Ad 3–20 karakter olmalı (grup adı en fazla 24).',
    name_chars: 'Yalnız harf, rakam, boşluk ve . _ - kullanabilirsin; emoji olmaz.',
    name_personal: 'Telefon, adres, sosyal medya adı ya da doğum yılı yazma.',
    name_banned: 'Bu ad kullanılamaz. Başka bir ad dene.',
    under_15: 'Gruplar yalnız 15 yaş ve üstü için.',
    rate_limited: 'Çok fazla deneme yaptın. Biraz sonra yeniden dene.',
    parent_locked: 'Velin bu ayarı kilitledi.',
    parent_limit: 'En fazla 2 veli bağlanabilir.',
    not_owner: 'Bunu yalnız grubun kurucusu yapabilir.',
    not_member: 'Bu grubun üyesi değilsin.',
    network: 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',
    generic: 'Bir sorun oluştu. Yeniden dene.',
  },

  settings: {
    title: 'Ayarlar',
    profile: 'Profil',
    exam: 'Sınav',
    dataTitle: 'Veriler',
    dataInfo: 'Tüm verilerin yalnız bu cihazda tutulur. Hiçbir sunucuya gönderilmez.',
    deleteAll: 'Tüm verileri sil',
    deleteAllConfirm:
      'Çalışma kayıtların, denemelerin, hedeflerin ve profilin bu cihazdan silinecek. Bu işlem geri alınamaz.',
    deleteAllAgeNote:
      '15 yaş altı beyanı yapıldıysa, yaş kuralı gereği yalnız o doğum yılı 15 yaşına gelene kadar bu cihazda ayrıca kalır; uygulamayı kaldırınca o da silinir.',
    deleteAllYes: 'Evet, hepsini sil',
    dataInfoGroups:
      'Kayıtların bu cihazda tutulur. Grupları açtıysan takma adın ve çalışma sürelerin ayrıca Türkiye’deki sunucumuzda durur; “Tüm verileri sil” sunucudaki grup hesabını da siler.',
    deleteAllServerFailed:
      'Sunucudaki grup hesabın silinemedi, bu yüzden cihazdaki veriler de silinmedi. İnternet bağlantını kontrol edip yeniden dene. İstersen yalnız bu cihazdakileri silebilirsin: sunucudaki grup hesabın o zaman 6 ay kullanılmayınca kendiliğinden silinir.',
    deleteAllLocalOnly: 'Yalnız bu cihazdan sil',
    about: 'Hakkında',
    version: 'Sürüm',
    build: 'Derleme',
  },
} as const;
