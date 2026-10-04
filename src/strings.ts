/**
 * Every user-facing text of the app. Turkish only for now.
 * Keep wording neutral: no age hints on the birth-year screen (hukuk/03 K-15),
 * no "sosyal ağ / sohbet / topluluk" positioning (K-13).
 */

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
