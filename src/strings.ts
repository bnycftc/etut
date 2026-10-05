/**
 * Every user-facing text of the app. Turkish only for now.
 * Keep wording neutral: no age hints on the birth-year screen (hukuk/03 K-15),
 * no "sosyal ağ / sohbet / topluluk" positioning (K-13).
 */

import type { MarkError } from './domain/exam-analysis';
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
  subject: (id: string) => subjects[id] ?? id,
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

  /**
   * Reminders (local notifications only). Neutral wording for every age: no pressure, no
   * comparison with others, no marketing (hukuk/03 K-16, K-34).
   */
  reminders: {
    title: 'Hatırlatıcılar',
    open: 'Hatırlatıcılar',
    summaryOff: 'Bildirim izni verilmedi; hatırlatıcılar gelmez.',
    summaryOn: (count: number) => (count === 0 ? 'Açık hatırlatıcı yok.' : `${count} hatırlatıcı açık.`),
    info: 'Hatırlatıcılar bu cihazda kurulur; hiçbir sunucuya bir şey gönderilmez. Uygulama açıkken bildirim gösterilmez.',
    permissionMissing: 'Hatırlatıcıların gelmesi için bildirim izni gerekiyor.',
    permissionAsk: 'Bildirim izni iste',
    permissionDenied:
      'Bildirim izni kapalı. Telefonun Ayarlar uygulamasından Etüt’ün bildirimlerini açabilirsin.',
    openSettings: 'Ayarları aç',
    unsupported: 'Bu cihazda hatırlatıcı yok.',
    on: 'Açık',
    off: 'Kapalı',
    longSession: 'Uzun oturum uyarısı',
    longSessionInfo: (hours: number) =>
      `Sayaç ${hours} saat boyunca duraklatılmadan açık kalırsa “Hâlâ çalışıyor musun?” diye sorar. Pomodoro molaları sayacı duraklatmaz.`,
    longSessionHours: 'Süre',
    hours: (n: number) => `${n} saat`,
    pomodoro: 'Pomodoro aşama sonu',
    pomodoroInfo: 'Uygulama kapalıyken çalışma ya da mola bitince haber verir.',
    daily: 'Günlük çalışma hatırlatıcısı',
    dailyInfo: 'Seçtiğin saatte bir kez hatırlatır; o gün çalıştıysan hatırlatmaz.',
    dailyHour: 'Saat',
    dailyMinute: 'Dakika',
    /** `20:30` */
    time: (hour: number, minute: number) =>
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    examAnalysis: 'Deneme analizi hatırlatıcısı',
    examAnalysisInfo: 'Analizi bekleyen deneme için ertesi gün bir kez hatırlatır.',
  },

  /** Explanation shown before the system permission prompt. */
  notificationPermission: {
    title: 'Bildirim izni',
    heading: 'Hatırlatıcılar için bildirim izni',
    body: 'Etüt yalnız açık olan hatırlatıcılar için bildirim gösterir:',
    willBeOn: 'İzin verirsen şunlar açık olur:',
    local:
      'Bildirimler bu cihazda kurulur. Etüt bunun için hiçbir sunucuya bağlanmaz ve bilgi göndermez.',
    later: 'İzin vermezsen uygulama aynen çalışır; yalnız hatırlatıcılar gelmez. Fikrini sonra Ayarlar’dan değiştirebilirsin.',
    /** The only button: it opens the system prompt, where the student allows or refuses (HIG). */
    allow: 'Devam et',
    denied: 'İzin verilmedi. Hatırlatıcılar kapalı kalır; uygulamanın geri kalanı aynen çalışır.',
    granted: 'İzin verildi. Hatırlatıcılar açık.',
    close: 'Kapat',
  },

  /** Texts of the local notifications. */
  notification: {
    longSessionTitle: 'Hâlâ çalışıyor musun?',
    /** No duration: the text shows on the Lock Screen (hukuk/kvkk/08). */
    longSessionBody: 'Sayaç uzun süredir duraklatılmadan açık. Ara verdiysen sayacı durdurabilirsin.',
    workEndedTitle: 'Çalışma bloğu bitti',
    shortBreakBody: 'Kısa mola başladı.',
    longBreakBody: 'Uzun mola başladı.',
    breakEndedTitle: 'Mola bitti',
    workBody: 'Sıradaki çalışma bloğu başladı.',
    dailyTitle: 'Çalışma zamanı',
    dailyBody: 'Bugün çalışmaya başlamak istersen sayaç hazır.',
    examTitle: 'Deneme analizi',
    examBody: (count: number) =>
      count === 1
        ? 'Kaydettiğin denemenin yanlış ve boş sorularının konularını işaretleyebilirsin.'
        : `Analizi bekleyen ${count} deneme var.`,
    channel: 'Hatırlatıcılar',
  },

  /** Lock Screen / Dynamic Island timer (iOS Live Activity). */
  liveActivity: {
    /**
     * The phase shown once the Live Activity is stale, with its end time: it stays true after the
     * phase is over (the activity cannot change by itself any more; the app updates it when opened).
     */
    phaseEnds: (label: string, time: string) => `${label} · bitiş ${time}`,
  },

  /** Home Screen widget (iOS). */
  widget: {
    today: 'Bugün',
    streak: (days: number) => `Seri: ${days} gün`,
    goal: (goal: string) => `Hedef ${goal}`,
    goalMet: 'Hedef tamam',
    noGoal: 'Hedef koymadın',
    running: 'Sayaç açık',
  },

  groups: {
    title: 'Gruplar',
    soon: 'Yakında',
    body: 'Davetle kurulan küçük çalışma grupları üzerinde çalışıyoruz. Sayaç ve denemeler gruplardan bağımsız çalışır.',
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
    about: 'Hakkında',
    version: 'Sürüm',
    build: 'Derleme',
  },
} as const;
