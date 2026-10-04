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
    limits: 'Tek kayıt en fazla 10 saat; gelecekteki ya da başka kayıtla çakışan zaman eklenemez.',
    errors: {
      invalid: 'Başlangıç saatini ve süreyi kontrol et.',
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
    targetInvalid: (questions: number) => `0 ile ${questions} arasında, 0,25’in katı bir net gir.`,
    gap: (gap: string, average: string) =>
      `Hedefe ${gap} net kaldı (son denemelerin ortalaması: ${average}).`,
    reached: (average: string) => `Hedefe ulaştın (son denemelerin ortalaması: ${average}).`,
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
    birthYear: 'Doğum yılı',
    dataTitle: 'Veriler',
    dataInfo: 'Tüm verilerin yalnız bu cihazda tutulur. Hiçbir sunucuya gönderilmez.',
    deleteAll: 'Tüm verileri sil',
    deleteAllConfirm:
      'Çalışma kayıtların, denemelerin ve profilin bu cihazdan silinecek. Bu işlem geri alınamaz.',
    deleteAllYes: 'Evet, hepsini sil',
    about: 'Hakkında',
    version: 'Sürüm',
    build: 'Derleme',
  },
} as const;
