/**
 * Every user-facing text of the app. Turkish only for now.
 * Keep wording neutral: no age hints on the birth-year screen (hukuk/03 K-15),
 * no "sosyal ağ / sohbet / topluluk" positioning (K-13).
 */

import type { BackupError } from './domain/backup';
import type { MarkError } from './domain/exam-analysis';
import type { ManualEntryError } from './domain/manual-entry';
import type { ExamKind, ScoreError, YksArea } from './domain/net';
import type { ExamType } from './domain/profile';

/**
 * Data controller ("veri sorumlusu") shown in the legal texts. Single place to fill in before
 * release; do not put a personal e-mail address here without bny's decision.
 */
export const DATA_CONTROLLER = {
  name: '[DOLDURULACAK]',
  contact: '[DOLDURULACAK]',
} as const;

/** Date shown as "Son güncelleme" on the legal texts. */
export const LEGAL_UPDATED = '4 Ekim 2026';

export interface LegalSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface LegalDoc {
  title: string;
  sections: readonly LegalSection[];
}

const C = DATA_CONTROLLER;

const legalDocs = {
  aydinlatma: {
    title: 'Kısaca bilgilerin',
    sections: [
      {
        heading: 'Kim sorumlu?',
        paragraphs: [
          `Etüt’ü ${C.name} geliştiriyor (veri sorumlusu). Soruların için: ${C.contact}.`,
        ],
      },
      {
        heading: 'Uygulama ne kaydediyor?',
        paragraphs: [
          'Doğum yılın (yalnız yıl), sınav türün ve alanın, çalışma oturumların (ders, konu, başlangıç ve bitiş zamanı, “elle” bilgisi), konu ilerlemen, deneme netlerin ve analizlerin, hedef ve sayaç ayarların.',
          'Kaydetmediklerimiz: adın, e-postan, telefon numaran, okulun, konumun, fotoğrafların, rehberin, reklam kimliğin.',
        ],
      },
      {
        heading: 'Ne için?',
        paragraphs: [
          'Sayacı çalıştırmak, sana kendi istatistiklerini göstermek ve yaşına uygun ayarları açmak için. 15 yaşından küçüksen grup özellikleri hiç görünmez.',
        ],
      },
      {
        heading: 'Nerede duruyor, kim görüyor?',
        paragraphs: [
          'Yalnız bu telefonda. Uygulamanın sunucusu ve hesabı yok, uygulama internete bağlanmaz. Bilgilerin bize ya da başka bir şirkete gönderilmez; yurt dışına aktarım da yoktur.',
          'Yedek dosyası, CSV ya da çalışma kartı oluşturup paylaşırsan dosyanın nereye gideceğine sen karar verirsin.',
        ],
      },
      {
        heading: 'Ne kadar kalıyor?',
        paragraphs: [
          'Sen silene kadar. Ayarlar → Tüm verileri sil her şeyi siler; uygulamayı kaldırmak da siler.',
          'Tek istisna: 15 yaş altı beyanında, beyan edilen doğum yılı yaş kuralı gereği 15 yaşına gelinceye kadar bu cihazda ayrıca saklanır (yaşın yeniden kayıtla yükseltilemesin diye).',
        ],
      },
      {
        heading: 'Hukuki sebep',
        paragraphs: [
          'Bu bilgiler uygulamayı senin isteğinle kullanabilmen için gereklidir (KVKK m.5/2-c, sözleşmenin kurulması ve ifası). Reklam, analitik, çökme raporu ve izleme yoktur.',
        ],
      },
      {
        heading: 'Hakların',
        paragraphs: [
          'KVKK m.11 kapsamındaki haklarını kullanabilirsin. Verilerin zaten yalnız sende: Ayarlar’dan görebilir, yedek ya da CSV olarak dışa aktarabilir, istediğin an silebilirsin. Başvuru ve sorular için: ' +
            `${C.contact}.`,
        ],
      },
    ],
  },
  gizlilik: {
    title: 'Gizlilik politikası',
    sections: [
      {
        heading: '1. Kısaca',
        paragraphs: [
          'Reklam yok, analitik yok, izleme yok. Hesap ve sunucu yok: uygulama internete bağlanmaz, bilgilerin yalnız bu telefonda tutulur.',
        ],
      },
      {
        heading: '2. Cihazda tutulanlar',
        paragraphs: [
          'Doğum yılı (yaş kuralı için), sınav türü ve alan (ders ve konu listesi için), çalışma oturumları ve “elle” eklenen süreler, konu ilerlemesi, deneme netleri ve analizleri, hedef, pomodoro ve sınav tarihi ayarları.',
          'Ad, e-posta, telefon, okul, konum, rehber, fotoğraf ve reklam kimliği hiç sorulmaz ve toplanmaz.',
        ],
      },
      {
        heading: '3. Paylaşım',
        paragraphs: [
          'Bize hiçbir veri gelmediği için kimseyle paylaşmıyoruz ve satmıyoruz.',
          'Yedek, CSV ya da çalışma kartı yalnız sen dokunduğunda, telefonunun paylaşım ekranıyla dışarı çıkar. Seçtiğin uygulama ya da servis (ör. Dosyalar, AirDrop, bir mesajlaşma uygulaması) kendi kurallarına tabidir. Çalışma kartında ad, yaş, okul gibi seni tanıtan bilgi yer almaz.',
        ],
      },
      {
        heading: '4. İzinler',
        paragraphs: [
          'Uygulama konum, kamera, mikrofon, fotoğraflar, rehber, bildirim ya da takip (ATT) izni istemez. Yedeği geri yüklerken dosyayı sen seçersin; uygulama yalnız seçtiğin dosyayı okur.',
        ],
      },
      {
        heading: '5. Saklama ve silme',
        paragraphs: [
          'Veriler sen silene kadar cihazda kalır. Ayarlar → Tüm verileri sil ya da uygulamayı kaldırmak hepsini siler. 15 yaş altı beyanında yalnız beyan edilen doğum yılı, 15 yaşına gelinceye kadar ayrıca saklanır.',
        ],
      },
      {
        heading: '6. Çocuklar ve gençler',
        paragraphs: [
          'Etüt 13 yaş altı çocuklara yönelik değildir. 15 yaşından küçükler uygulamayı yalnız cihazda, grupsuz kullanır. Yaş beyanı sonradan yükseltilemez; yedek geri yüklemek de yaşı yükseltemez.',
        ],
      },
      {
        heading: '7. Güvenlik',
        paragraphs: [
          'Veriler telefonunun kendi korumasıyla (ekran kilidi, cihaz şifrelemesi) korunur. Yedek dosyası şifrelenmez: güvendiğin bir yerde sakla ve başkasıyla paylaşma.',
        ],
      },
      {
        heading: '8. Hakların',
        paragraphs: [
          'Verilerini görebilir, yedek ya da CSV olarak dışa aktarabilir ve silebilirsin. KVKK kapsamındaki başvuruların için: ' +
            `${C.contact}. Cevabımızdan memnun kalmazsan Kişisel Verileri Koruma Kurulu’na şikâyet edebilirsin.`,
        ],
      },
      {
        heading: '9. Değişiklikler',
        paragraphs: [
          'Gruplar gibi sunucu gerektiren özellikler eklenirse bu metin önceden güncellenir ve uygulama içinde haber verilir.',
        ],
      },
      {
        heading: '10. İletişim',
        paragraphs: [`${C.name} · ${C.contact}`],
      },
    ],
  },
  kullanim: {
    title: 'Kullanım şartları',
    sections: [
      {
        heading: '1. Taraflar',
        paragraphs: [
          `Bu şartlar Etüt’ü geliştiren ${C.name} ile uygulamayı kullanan sen arasındadır. Kişisel verilerin nasıl işlendiği ayrı metinde (Kısaca bilgilerin) anlatılır.`,
        ],
      },
      {
        heading: '2. Hizmet ne, ne değil',
        paragraphs: [
          'Etüt bir çalışma süresi sayacı ve deneme neti takip uygulamasıdır. Resmî değildir: ÖSYM, MEB ya da başka bir kamu kurumuyla bağlantısı yoktur; sınav adları yalnız tanımlama içindir.',
          'Ders vermez ve başarı garantisi vermez. Süreler senin kullanımına dayanır. Sınav tarihleri açıklanana kadar tahminidir.',
        ],
      },
      {
        heading: '3. Yaş',
        paragraphs: [
          'Doğum yılını doğru seçmelisin. 15 yaşından küçüksen uygulamayı yalnız cihazda, grupsuz kullanırsın.',
        ],
      },
      {
        heading: '4. Verilerin',
        paragraphs: [
          'Verilerin yalnız bu telefondadır. Telefon değiştirirken ya da uygulamayı silmeden önce Ayarlar → Yedekle ile yedek al; yedeği saklamak senin elindedir.',
        ],
      },
      {
        heading: '5. Değişiklik ve durma',
        paragraphs: [
          'Uygulamayı geliştirmek için özellikleri değiştirebiliriz. Önemli değişiklikleri önceden uygulama içinde duyururuz.',
        ],
      },
      {
        heading: '6. Fikri haklar',
        paragraphs: [
          'Uygulamanın adı, tasarımı ve kodu geliştiricisine aittir. Kullandığımız açık kaynak yazılımlar ve lisansları Hakkında → Açık kaynak lisansları bölümünde listelenir.',
        ],
      },
      {
        heading: '7. Sorumluluk',
        paragraphs: [
          'Uygulamayı özenle çalıştırmaya gayret ederiz ama hatasız çalışacağını garanti edemeyiz. Kastımız ya da ağır ihmalimiz olmadıkça cihazında yaşanan bir sorun yüzünden kayıtların kaybolmasından sorumlu değiliz. Tüketici olarak kanundan doğan hakların saklıdır.',
        ],
      },
      {
        heading: '8. Uygulanacak hukuk',
        paragraphs: [
          'Türk hukuku uygulanır. Uyuşmazlıkta parasal sınırlar içinde Tüketici Hakem Heyeti’ne, üzerinde Tüketici Mahkemesi’ne başvurabilirsin. Önce bize yazarsan birlikte çözmeye çalışırız.',
        ],
      },
      {
        heading: '9. İletişim',
        paragraphs: [`${C.name} · ${C.contact}`],
      },
    ],
  },
} as const satisfies Record<string, LegalDoc>;

export type LegalDocId = keyof typeof legalDocs;
export const LEGAL_DOC_IDS = Object.keys(legalDocs) as LegalDocId[];

const backupErrors: Record<BackupError, string> = {
  too_large: 'Dosya çok büyük. Etüt yedeği olduğundan emin ol.',
  not_json: 'Bu dosya okunamadı. Etüt’ten aldığın .json yedeğini seç.',
  not_backup: 'Bu dosya bir Etüt yedeği değil.',
  too_new: 'Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelle.',
  invalid: 'Yedek dosyası bozuk ya da değiştirilmiş; hiçbir şey yüklenmedi.',
};

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
    privacyLink: 'Bilgilerin nasıl saklanıyor?',
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
    examChangeTitle: 'Sınav ve alan',
    examChangeInfo:
      'Ders listesi, konular ve deneme türleri seçtiğin sınava ve alana göre gösterilir. Kayıtların silinmez.',
    examChangeSave: 'Değişikliği kaydet',
    examChangeSaved: 'Kaydedildi.',
    examChangeArea: 'Alan',
    /** K-17: shown next to the exam settings so nobody looks for an age setting. */
    ageFixed: 'Doğum yılı sonradan değiştirilemez.',
    openAbout: 'Hakkında, gizlilik ve lisanslar',
  },

  backup: {
    title: 'Yedekle ve geri yükle',
    info: 'Sunucumuz olmadığı için verilerin yalnız bu telefonda. Telefon değiştirmeden önce yedek al; dosyayı güvendiğin bir yerde sakla (dosya şifrelenmez).',
    export: 'Yedek dosyası oluştur',
    exported: 'Yedek dosyası hazırlandı.',
    import: 'Yedekten geri yükle',
    shareTitle: 'Etüt yedeğini kaydet',
    unavailable: 'Bu cihazda paylaşım ekranı açılamadı.',
    failed: 'İşlem tamamlanamadı. Yeniden dene.',
    picked: (sessions: number, exams: number, topics: number) =>
      `Yedekte ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti var.`,
    exportedOn: (date: string) => `Yedek tarihi: ${date}`,
    modeTitle: 'Nasıl yüklensin?',
    merge: 'Birleştir',
    mergeInfo: 'Bu telefondaki kayıtlar kalır, yedekte olup burada olmayanlar eklenir. Aynı yedeği iki kez yüklemek kayıtları çoğaltmaz.',
    replace: 'Değiştir',
    replaceInfo: 'Bu telefondaki çalışma kayıtları, denemeler, konu işaretleri ve ayarlar silinir; yerine yedektekiler gelir.',
    ageNote: 'Doğum yılı yedekten alınmaz. Yedekteki yaş bu cihazdakinden küçükse küçük olan esas alınır.',
    confirm: 'Yükle',
    cancel: 'Vazgeç',
    done: (sessions: number, exams: number, topics: number) =>
      `Yüklendi. Şu an ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti var.`,
    errors: backupErrors,
    csvTitle: 'Tablo olarak dışa aktar (CSV)',
    csvInfo: 'Çalışma kayıtlarını ve denemeleri Excel ya da Numbers ile açılabilen dosyalara aktar.',
    csvSessions: 'Çalışma kayıtları (CSV)',
    csvExams: 'Denemeler (CSV)',
    csvShareTitle: 'Etüt tablosunu kaydet',
    csvDone: 'Dosya hazırlandı.',
  },

  csv: {
    sessionHeader: ['Gün', 'Başlangıç', 'Bitiş', 'Ders', 'Konu', 'Kaynak', 'Süre (dk)', 'Süre (sn)'],
    examHeader: [
      'Gün',
      'Sınav',
      'Tür',
      'Ders',
      'Soru',
      'Doğru',
      'Yanlış',
      'Boş',
      'Net',
      'Toplam net',
      'Analiz tamam',
    ],
    sourceTimer: 'sayaç',
    sourceManual: 'elle',
    yes: 'evet',
    no: 'hayır',
    sessionsFile: (day: string) => `etut-calisma-${day}.csv`,
    examsFile: (day: string) => `etut-denemeler-${day}.csv`,
  },

  share: {
    title: 'Çalışma kartı',
    open: 'Kartı paylaş',
    intro: 'Kartta yalnız çalışma sayıların var; adın, yaşın ya da okulun yer almaz. Paylaşınca nereye gönderileceğini sen seçersin.',
    period: 'Dönem',
    day: 'Bugün',
    week: 'Bu hafta',
    theme: 'Görünüm',
    light: 'Açık',
    dark: 'Koyu',
    share: 'Paylaş',
    shareTitle: 'Çalışma kartını paylaş',
    unavailable: 'Bu cihazda paylaşım ekranı açılamadı.',
    failed: 'Kart hazırlanamadı. Yeniden dene.',
    cardDay: 'Bugünkü çalışmam',
    cardWeek: 'Bu haftaki çalışmam',
    total: 'Toplam çalışma',
    subjects: 'Ders dağılımı',
    noStudy: 'Henüz çalışma yok. İlk oturumu başlat!',
    otherSubjects: 'Diğer dersler',
    streak: (days: number) => `Seri: ${days} gün`,
    goalDay: (percent: number) => (percent >= 100 ? 'Günlük hedef tamam' : `Günlük hedefin %${percent}’i`),
    goalWeek: (days: number) => `Hedef tutan gün: ${days}/7`,
    activeDays: (days: number) => `Çalışılan gün: ${days}/7`,
    footer: 'Etüt · çalışma takibi',
    /** Screen reader text for the card preview. */
    a11y: (period: string, total: string) => `${period}: toplam ${total}`,
  },

  about: {
    title: 'Hakkında',
    legalTitle: 'Gizlilik ve şartlar',
    licenses: 'Açık kaynak lisansları',
    licensesIntro: (n: number) =>
      `Etüt aşağıdaki ${n} açık kaynak paketi kullanır. Her paketin tam lisans metni kendi deposunda ve uygulamayla gelen kaynak dosyalarındadır.`,
    controller: 'Veri sorumlusu',
    contact: 'İletişim',
    updated: (date: string) => `Son güncelleme: ${date}`,
    noNetwork: 'Etüt internete bağlanmaz; reklam, analitik ve izleme içermez.',
  },

  legal: legalDocs,

  a11y: {
    decrease: (label: string) => `${label}, azalt`,
    increase: (label: string) => `${label}, artır`,
    chart: (items: string) => `Grafik. ${items}`,
    chartItem: (label: string, value: string) => `${label}: ${value || '0'}`,
    progress: 'İlerleme',
  },

  empty: {
    historyTitle: 'Henüz kayıtlı çalışma yok',
    historyBody: 'Sayaç sekmesinde bir ders seçip Başla’ya dokun; bitirdiğin her oturum burada günlere göre görünür.',
    examsTitle: 'Henüz deneme eklemedin',
    examsBody: 'Bir deneme çözdükten sonra “Deneme ekle” ile doğru ve yanlışlarını gir; netin hemen hesaplanır, grafikler burada oluşur.',
    topicsBody: 'Bir konuyu bitirdiğinde “Bitti”, yeniden bakman gerekiyorsa “Tekrar lazım” de. Sayaçta konu seçersen süresi de burada toplanır.',
    weeklyTitle: 'Bu hafta kayıtlı çalışma yok',
    weeklyBody: 'Haftanın her günü (Pazartesi–Pazar) çalıştığın süre burada toplanır. Önceki haftalara oklarla bakabilirsin.',
    startTimer: 'Sayaca git',
    addExam: 'Deneme ekle',
  },

  tips: {
    title: 'Kısa bir tur',
    steps: [
      {
        title: 'Ders seç, Başla’ya dokun',
        body: 'Süre zaman damgasıyla tutulur. Uygulamadan 10 saniyeden uzun çıkarsan o süre mola sayılır; dönünce “Çalışıyordum” diyerek ekleyebilirsin.',
      },
      {
        title: 'Denemelerini ekle',
        body: 'Denemeler sekmesinde doğru ve yanlışlarını gir; net hemen hesaplanır. Kitapçık gelince yanlış konularını işaretle.',
      },
      {
        title: 'Verilerin sende',
        body: 'Her şey yalnız bu telefonda. Telefon değiştirmeden önce Ayarlar’dan yedek al.',
      },
    ],
    step: (n: number, of: number) => `${n}/${of}`,
    next: 'İleri',
    done: 'Anladım',
    skip: 'Geç',
  },
} as const;
