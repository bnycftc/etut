/**
 * Every user-facing text of the app. Turkish only for now.
 * Keep wording neutral: no age hints on the birth-year screen (hukuk/03 K-15),
 * no "sosyal ağ / sohbet / topluluk" positioning (K-13).
 */

import type { BackupError } from './domain/backup';
import type { MarkError } from './domain/exam-analysis';
import type { ParentNoticeKind, ReactionKind, ReportReason } from './domain/groups';
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
export const LEGAL_UPDATED = '5 Ekim 2026';

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
          'Bu telefonda. Uygulamanın sunucusu ve hesabı yok, uygulama internete bağlanmaz. Bilgilerin bize ya da başka bir şirkete gönderilmez; biz yurt dışına aktarım yapmayız.',
          'Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS uygulama verilerini de bu yedeğe katar. Bu yedek senin Apple hesabında ya da bilgisayarında durur; bize gelmez.',
          'Yedek dosyası, CSV ya da çalışma kartı oluşturup paylaşırsan dosyanın nereye gideceğine sen karar verirsin. Yedek dosyasında doğum yılın da bulunur.',
        ],
      },
      {
        heading: 'Ne kadar kalıyor?',
        paragraphs: [
          'Sen silene kadar. Ayarlar → Tüm verileri sil her şeyi siler; uygulamayı kaldırmak da bu telefondakileri siler. Telefonunun kendi yedeğindeki kopya o yedekle birlikte silinir.',
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
          'Reklam yok, analitik yok, izleme yok. Hesap ve sunucu yok: uygulama internete bağlanmaz, bilgilerin bu telefonda tutulur ve bize gelmez.',
          'Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS uygulama verilerini de bu yedeğe katar; bu yedek senin Apple hesabında ya da bilgisayarında durur.',
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
          'Yedek, CSV ya da çalışma kartı yalnız sen dokunduğunda, telefonunun paylaşım ekranıyla dışarı çıkar. Seçtiğin uygulama ya da servis (ör. Dosyalar, AirDrop, bir mesajlaşma uygulaması) kendi kurallarına tabidir. Yedek dosyasında doğum yılın da bulunur. Çalışma kartında ad, yaş, okul gibi seni tanıtan bilgi yer almaz.',
        ],
      },
      {
        heading: '4. İzinler',
        paragraphs: [
          'Uygulama konum, kamera, mikrofon, fotoğraf okuma, rehber, bildirim ya da takip (ATT) izni istemez. Yedeği geri yüklerken dosyayı sen seçersin; uygulama yalnız seçtiğin dosyayı okur.',
          'Çalışma kartını paylaşım ekranından “Görüntüyü Kaydet” ile Fotoğraflar’a eklemek istersen iOS yalnız ekleme izni sorar; Etüt fotoğraflarını göremez.',
        ],
      },
      {
        heading: '5. Saklama ve silme',
        paragraphs: [
          'Veriler sen silene kadar cihazda kalır. Ayarlar → Tüm verileri sil ya da uygulamayı kaldırmak bu telefondakilerin hepsini siler; telefonunun kendi yedeğindeki kopya o yedekle birlikte silinir. 15 yaş altı beyanında yalnız beyan edilen doğum yılı, 15 yaşına gelinceye kadar ayrıca saklanır.',
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
          'Verilerin bu telefonda tutulur; Etüt onları hiçbir sunucuya göndermez. Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS onları o yedeğe de katar. Bu yedek yoksa, telefon değiştirirken ya da uygulamayı silmeden önce Ayarlar → Yedekle ile yedek al; yedeği saklamak senin elindedir.',
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
  LGS: 'LGS',
  KPSS_GYGK: 'KPSS GY-GK',
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
  },

  tabs: {
    timer: 'Sayaç',
    exams: 'Denemeler',
    groups: 'Gruplar',
    settings: 'Ayarlar',
  },

  onboarding: {
    title: 'Etüt’e hoş geldin',
    intro: 'Birkaç soruyla başlayalım. Cevapların bu cihazda saklanır, bize gönderilmez.',
    birthYearTitle: 'Doğum yılın',
    birthYearHint: 'Yalnız yılı soruyoruz.',
    examTitle: 'Hazırlandığın sınav',
    areaTitle: 'Alanın',
    start: 'Başla',
    ageBlocked: 'Bu doğum yılı bu cihazda kaydedilemiyor. Seçimini kontrol edip yeniden dene.',
    privacyLink: 'Bilgilerin nasıl saklanıyor?',
  },

  timer: {
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
    add: 'Deneme ekle',
    chartTitle: (kind: string) => `${kind} genel deneme netleri`,
    chartEmpty: 'Bu tür için henüz genel deneme yok.',
    listTitle: 'Tüm denemeler',
    noFormNote:
      'Bu sınav için deneme formu yok. Ayarlar’dan YKS, LGS ya da KPSS seçersen denemelerini burada girebilirsin.',
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
    date: 'Deneme tarihi',
    prevDay: '‹ Önceki gün',
    nextDay: 'Sonraki gün ›',
    correct: 'Doğru',
    wrong: 'Yanlış',
    /** Screen-reader name of a count box: which section it belongs to. */
    countLabel: (section: string, what: string) => `${section}, ${what}`,
    questions: (n: number) => `${n} soru`,
    correctWrongShort: (correct: number, wrong: number) => `${correct} D · ${wrong} Y`,
    fixErrors: 'Hatalı alanları düzelt.',
    deleteConfirm: 'Bu deneme silinsin mi?',
    notFound: 'Deneme bulunamadı.',
    /** How the net is computed on this paper (4 for YKS/KPSS, 3 for LGS). */
    netRule: (wrongsPerCorrect: number) => `Net = Doğru − Yanlış ÷ ${wrongsPerCorrect}`,
    today: 'Bugün',
    yesterday: 'Dün',
    edit: 'Düzenle',
    editTitle: 'Denemeyi düzenle',
    editNote:
      'Konu işaretlerin korunur. Yanlış ya da boş sayısı işaretlediklerinin altına inen dersin işaretleri silinir; sınavı değiştirirsen hepsi silinir.',
    prevField: '‹ Önceki',
    nextField: 'Sonraki ›',
    prevFieldA11y: 'Önceki kutu',
    nextFieldA11y: 'Sonraki kutu',
    keyboardDone: 'Bitti',
    /** Screen-reader name of a chip: which choice it belongs to. */
    choiceLabel: (group: string, item: string) => `${group}: ${item}`,
    chartSingle: (last: string) => `Son deneme: ${last} net. Bir deneme daha ekleyince eğilim görünür.`,
    chartChange: (last: string, change: string) => `Son deneme: ${last} net · öncekinden ${change}`,
    chartBransLegend: 'Dolu nokta genel, içi boş nokta branş denemesi.',
    chartTargetLegend: 'Kesik çizgi: hedef net.',
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
    unknownTopic: 'Eski konu',
    /** Screen-reader name of a stepper: topic and what it counts. */
    countLabel: (topic: string, what: string) => `${topic}, ${what}`,
    addTopicA11y: (topic: string) => `${topic} konusunu ekle`,
    review: 'Tekrar lazım',
    reviewA11y: (topic: string) => `${topic}: tekrar lazım`,
    study: 'Çalış',
    studyA11y: (topic: string) => `${topic} konusunda sayacı başlat`,
    studyBusy: 'Sayaç zaten açık; önce onu bitir.',
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
    running: 'Sayaç açık',
  },

  groups: {
    soon: 'Yakında',
    body: 'Davetle kurulan küçük çalışma grupları üzerinde çalışıyoruz. Sayaç ve denemeler gruplardan bağımsız çalışır.',
    // Group module (GROUPS_ENABLED). Wording: "çalışma grubu", never "sosyal ağ / topluluk" (K-13).
    introTitle: 'Çalışma grupları',
    introBody:
      'Davet koduyla kurulan, en fazla 30 kişilik gruplarda kimin şu an çalıştığını ve günlük, haftalık süreleri görürsün. Sohbet yoktur; yalnız hazır tepkiler vardır. Sayaç ve denemeler gruplar olmadan da tam çalışır.',
    introData:
      'Grupları açarsan takma adın, yaş bandın (15–17 ya da 18+; doğum yılın gönderilmez) ve çalışma oturumların Türkiye’deki sunucumuzda tutulur. Sınav türün yalnız denetlenir, saklanmaz. Denemelerin ve netlerin cihazında kalır.',
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
    parentUnlink: 'Veli bağlantısını kaldır',
    parentUnlinkConfirm:
      'Bağlı velilerin artık süreni göremez ve koyduğu kilitler kalkar. Velin, bağlantıyı senin kaldırdığını kendi ekranında görür.',
    parentUnlinked: 'Veli bağlantısı kaldırıldı.',
    blocksShow: 'Engellediklerim',
    blocksTitle: 'Engellediklerin',
    blocksNone: 'Kimseyi engellemedin.',
    unblock: 'Engeli kaldır',
    unblocked: 'Engel kaldırıldı.',
    parentCode: 'Veli kodu oluştur',
    parentCodeShown: (code: string, minutes: number) => `Kod: ${code} · ${minutes} dk geçerli`,
    accountTitle: 'Grup hesabı',
    deleteAccount: 'Grup hesabımı sil',
    deleteAccountConfirm:
      'Sunucudaki takma adın, grup üyeliklerin, çalışma sürelerin, tepkilerin ve veli bağlantın hemen ve kalıcı olarak silinir; bağlı velin yalnız hesabını sildiğini görür. Cihazındaki kayıtlar kalır. Yasal zorunluluk gereği yalnız güvenlik kayıtları (hesap numarası, işlem, zaman, IP) 395 gün saklanır.',
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
    reportNickname: 'Takma adı bildir',
    requestBlocked: 'Engellendi. Bu kişi grubuna yeniden istek gönderemez.',
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
    noticeKinds: {
      child_deleted_account: 'Bağlı öğrencin grup hesabını sildi',
      child_unlinked: 'Bağlı öğrencin veli bağlantısını kaldırdı',
      child_adult: 'Bağlı öğrencin 18 yaşını doldurduğunu bildirdi',
      link_ended: 'Bir öğrenci bağlantısı sona erdi',
    } as Record<ParentNoticeKind, string>,
    noticeLine: (what: string, day: string) => `${day}: ${what}. Bu bağlantının kilitleri artık geçerli değil.`,
  },

  privacy: {
    title: 'Gizlilik',
    intro: 'Gruplar açıkken bilgilerinin ne olduğunu kısaca anlatıyoruz. Onay istemiyoruz; yalnız bilmeni istiyoruz.',
    sections: [
      {
        title: 'Ne tutuyoruz?',
        body: 'Takma adın, yaş bandın (15–17 ya da 18+) ve bu bandı hangi yıl bildirdiğin, grupların ve katılma isteklerin, çalışma oturumların (başlangıç, bitiş, süre, sayaç mı “elle” mi; ders ve konu gönderilmez), çalışırken o an hangi derse çalıştığın, hazır tepkiler, bildirdiğin ve engellediğin kişiler, veli bağlantın ve velinin ayarları. Sınav türün yalnız denetlenir (LGS profiliyle grup açılmaz), saklanmaz. Hiçbir grupta (ya da bekleyen bir katılma isteğinde) değilken canlı durumun gönderilmez; bağlı bir velin de yoksa oturumların da gönderilmez, gönderilse bile sunucu saklamaz.',
      },
      {
        title: 'Toplamadıklarımız',
        body: 'Adın, doğum yılın, e-postan, telefonun, okulun, konumun, fotoğrafların, rehberin. Denemelerin ve netlerin yalnız cihazında kalır.',
      },
      {
        title: 'Kim görüyor?',
        body: 'Yalnız aynı gruptakiler: takma adın; görünmez değilsen o an çalıştığın ders ve ne zamandır çalıştığın; günlük ve haftalık süren ve sıralaman. Bağlı velin takma adını ve son 7 günün günlük toplam süresini görür; bağlantıyı Gruplar ekranından kaldırabilirsin, velin bunu görür. Engellediğin kişiyle birbirinizi görmezsiniz; engeli Gruplar → Engellediklerim’den kaldırırsın.',
      },
      {
        title: 'Güvenlik kaydı',
        body: 'Kötüye kullanımı önlemek ve yasal zorunluluk (5651) için yaptığın işlemler hesap numarası, zaman ve IP adresiyle 395 gün (yaklaşık 13 ay) saklanır. Bu kayıt hesabını silsen de süresi dolana kadar kalır ve yalnız yasal bir talep olursa açılır.',
      },
      {
        title: 'Nerede, ne kadar?',
        body: 'Türkiye’deki sunucumuzda; yurt dışına gönderilmez, reklam ve analitik yok. Hesabın açık olduğu sürece tutulur; 6 ay kullanmazsan hesap kendiliğinden silinir. Hazır tepkiler 90 gün sonra silinir. Veli bağlantısı senin tarafında biterse velinin gördüğü bildirim (yalnız ne olduğu ve tarihi) 90 gün tutulur.',
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
    profile: 'Profil',
    exam: 'Sınav',
    dataTitle: 'Veriler',
    dataInfo: 'Tüm verilerin bu cihazda tutulur; Etüt hiçbir sunucuya göndermez. Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS onları o yedeğe de katar.',
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
    info: 'Sunucumuz olmadığı için verilerin bu telefonda (telefonunun iCloud ya da bilgisayar yedeği açıksa o yedekte de). Telefon değiştirmeden önce yedek al; dosyayı güvendiğin bir yerde sakla (dosya şifrelenmez).',
    export: 'Yedek dosyası oluştur',
    exported: 'Yedek dosyası hazırlandı.',
    import: 'Yedekten geri yükle',
    shareTitle: 'Etüt yedeğini kaydet',
    unavailable: 'Bu cihazda paylaşım ekranı açılamadı.',
    failed: 'İşlem tamamlanamadı. Yeniden dene.',
    picked: (sessions: number, exams: number, topics: number) =>
      `Yedekte ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti var.`,
    exportedOn: (date: string) => `Yedek tarihi: ${date}`,
    skipped: (n: number) =>
      `Tarihi telefon saati yanlışken kaydedildiği belli olan ${n} çalışma kaydı (2016 öncesi, 2100 sonrası ya da bir yıldan uzun) yüklenmeyecek.`,
    exportSkipped: (n: number) =>
      `Yedek dosyası hazırlandı. Telefon saati yanlışken kaydedilmiş ${n} çalışma kaydı geri yüklemede alınmayacak; geri kalan her şey yedekte.`,
    exportCheckFailed: 'Yedek dosyası doğrulanamadı, bu yüzden oluşturulmadı. Çalışma kayıtlarını aşağıdan CSV olarak dışa aktarabilirsin.',
    modeTitle: 'Nasıl yüklensin?',
    merge: 'Birleştir',
    mergeInfo:
      'Bu telefondaki kayıtlar ve ayarlar kalır, yedekte olup burada olmayanlar eklenir. Burada boş olan ayarlar (ör. kaldırdığın günlük hedef, sınav tarihi) yedektekiyle doldurulur. Aynı yedeği iki kez yüklemek kayıtları çoğaltmaz.',
    replace: 'Değiştir',
    replaceInfo: 'Bu telefondaki çalışma kayıtları, denemeler, konu işaretleri ve ayarlar silinir; yerine yedektekiler gelir.',
    ageNote: 'Yaş yedekle yükseltilemez. Yedekteki yaş bu cihazdakinden küçükse küçük olan esas alınır.',
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
    licensesIntro: (packages: number, native: number) =>
      `Etüt aşağıdaki ${packages} açık kaynak paketi ve uygulamaya derlenen ${native} yerel kütüphaneyi kullanır. Lisans metnini görmek için bir satıra dokun.`,
    nativeLicenses: 'Yerel kütüphaneler',
    licenseHint: 'Lisans metnini gösterir ya da gizler',
    licenseTextMissing: (license: string) =>
      `${license} lisansı. Tam metin projenin kendi deposunda; bir sonraki sürümde buraya da eklenecek.`,
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
        body: 'Her şey bu telefonda; Etüt hiçbir sunucuya göndermez. Telefon değiştirmeden önce Ayarlar’dan yedek al.',
      },
    ],
    step: (n: number, of: number) => `${n}/${of}`,
    next: 'İleri',
    done: 'Anladım',
    skip: 'Geç',
  },

  /** Timer screen layout (shortcuts, goal on the home card). */
  home: {
    shortcuts: 'Kısayollar',
    goalEdit: 'Değiştir',
    goalEditA11y: 'Günlük hedefi değiştir',
  },

  /** The short summary after "Bitir". */
  finish: {
    studied: (subject: string) => `${subject} çalıştın`,
    studiedTopic: (subject: string, topic: string) => `${subject} · ${topic}`,
    goalStep: (before: number, after: number) => `Hedef: %${before} → %${after}`,
    goalReached: 'Bugünkü hedefe ulaştın, tebrikler!',
    streak: (days: number) => `Serin ${days} gün oldu.`,
    undo: 'Geri al',
    undoHint: 'Kaydı siler, sayaç kaldığı yerden devam eder.',
    undone: 'Geri alındı. Sayaç kaldığı yerden devam ediyor.',
    announce: (saved: string, today: string) => `${saved}. Bugün toplam ${today}.`,
  },

  /** Daily goal sheet on the timer screen and the optional onboarding step. */
  goalSheet: {
    title: 'Günlük hedefin',
    hours: (h: number) => `${h} saat`,
    presetA11y: (h: number) => `Günde ${h} saat`,
    fineTune: 'İnce ayar (15 dk)',
    done: 'Tamam',
    onboardingTitle: 'Günlük hedefin (isteğe bağlı)',
    onboardingHint: 'Seçmezsen sonra Sayaç ekranından da koyabilirsin.',
  },

  onboardingMissing: {
    birthYear: 'Başlamak için önce doğduğun yılı seç.',
    exam: 'Başlamak için sınavını seç.',
    area: 'Başlamak için alanını seç.',
  },

  /** Screen reader announcements on the timer screen. */
  announce: {
    phase: (phase: string) => `${phase} başladı`,
    away: (title: string, body: string) => `${title} ${body}`,
  },

  /** Groups tab while the module is off (GROUPS_ENABLED = false). No "soon" word here: tr.groups.soon is the badge. */
  groupsOff: {
    planTitle: 'Planladığımız',
    plan: 'Davet koduyla kurulan, en fazla 30 kişilik küçük çalışma grupları: kimin şu an çalıştığını ve günlük, haftalık süreleri görürsün. Sohbet ve mesaj olmayacak; yalnız hazır tepkiler.',
    whyTitle: 'Neden henüz yok?',
    why: 'Gruplar için Türkiye’de bir sunucu gerekiyor. O hazır olana kadar Etüt internete hiç bağlanmaz; bu sekme de hiçbir yere bir şey göndermez.',
    nowTitle: 'Şimdi neler çalışıyor?',
    now: 'Sayaç, günlük hedef ve seri, denemeler ve analiz gruplar olmadan tam çalışır. Gruplar açılınca katılmak isteğe bağlı olacak.',
  },

  /** Ayarlar → "Sayaç çalışırken": screen kept on, what leaving the app means. */
  timerSettings: {
    title: 'Sayaç çalışırken',
    keepAwake: 'Ekranı açık tut',
    keepAwakeInfo:
      'Sayaç ekranı açıkken telefon kendiliğinden kilitlenmez, böylece süren molaya dönmez. Pili biraz daha çok kullanır.',
    on: 'Açık',
    off: 'Kapalı',
    awayTitle: 'Uygulamadan çıkınca',
    awayAsk: 'Sor',
    awayCount: 'Çalışmaya devam say',
    awayAskInfo:
      '10 saniyeden uzun çıkarsan ya da telefon kilitlenirse o süre mola sayılır; dönünce “Çalışıyordum” diyerek ekleyebilirsin.',
    awayCountInfo:
      'Uygulamadan çıktığın ya da telefonu kilitlediğin süre çalışma sayılır, sorulmaz. Mola verirken “Mola”ya dokunmayı unutma.',
  },

  /** Questions "Bitir" asks before saving. */
  finishCheck: {
    awayTitle: (duration: string) => `Bitirmeden önce: ${duration} uygulamanın dışındaydın.`,
    awayBody: 'Bu süre çalışma mıydı?',
    awayCredit: 'Çalışıyordum, ekle ve bitir',
    awayBreak: 'Molaydı, öyle bitir',
    longTitle: (duration: string) => `Bu oturum ${duration} sürmüş görünüyor.`,
    longBody: 'Hepsinde çalıştın mı? Sayaç açık kaldıysa yalnız ilk 10 saati kaydedebilirsin.',
    longAll: 'Evet, hepsini kaydet',
    longCap: 'İlk 10 saati kaydet',
    cancel: 'Vazgeç, sayaç sürsün',
  },

  countdownPassed: 'Sınav tarihi geçti. Yeni tarihi Ayarlar’dan gir.',

  /** Yedek: old files, the second confirmation and "Geri al" for "Değiştir". */
  backupSafety: {
    skipped: (exams: number, targets: number) =>
      `Uygulamanın şimdiki sınav biçimine (soru sayıları, dersler) uymayan ${
        exams > 0 && targets > 0 ? `${exams} deneme ve ${targets} net hedefi` : exams > 0 ? `${exams} deneme` : `${targets} net hedefi`
      } yüklenmeyecek; geri kalan her şey yüklenecek.`,
    replaceSure: (sessions: number, exams: number, topics: number) =>
      `Emin misin? Bu telefondaki ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti silinip yerine yedektekiler gelecek. Önce otomatik bir kopya alınır; istersen hemen geri alabilirsin.`,
    replaceYes: 'Evet, değiştir',
    replaceNo: 'Vazgeç',
    undoTitle: 'Değiştirmeden önceki verilerin',
    undoInfo: (when: string) =>
      `“Değiştir”den önce (${when}) alınan kopya bu telefonda duruyor. Geri alırsan veriler o ana döner; sonradan eklediklerin gider. Kopya bir gün sonra gösterilmez.`,
    undo: 'Geri al',
    undoSure: (sessions: number, exams: number, topics: number) =>
      `Emin misin? Şu an bu telefondaki ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti silinip yerine kopyadakiler gelecek.`,
    undoYes: 'Evet, geri al',
    undoDiscard: 'Kopyayı sil',
    undone: (sessions: number, exams: number, topics: number) =>
      `Geri alındı. Şu an ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti var.`,
    undoFailed: 'Kopya okunamadı, geri alınamadı.',
  },

  /** Optional solved question count of a session. Own numbers only, never a ranking. */
  questions: {
    finishLabel: 'Kaç soru çözdün? (isteğe bağlı)',
    manualLabel: 'Çözülen soru (isteğe bağlı)',
    placeholder: 'ör. 40',
    save: 'Kaydet',
    saved: (n: number) => `${n} soru kaydedildi.`,
    cleared: 'Soru sayısı silindi.',
    invalid: (max: number) => `0 ile ${max} arasında bir tam sayı gir.`,
    count: (n: number) => `${n} soru`,
    weekTotal: (n: number) => `Çözülen soru: ${n}`,
    byDay: 'Günlere göre soru',
    byDayA11y: (items: string) => `Günlere göre çözülen soru. ${items}`,
    dayItem: (day: string, n: number) => `${day} ${n}`,
    csvHeader: 'Soru',
  },

  /** Subject report card ("ders karnesi"): time, topics and nets of one subject together. */
  report: {
    title: 'Ders karnesi',
    open: 'Ders karnesi',
    openFor: (subject: string) => `${subject} karnesini aç`,
    rowA11y: (subject: string, duration: string, percent: number) =>
      `${subject}, ${duration}, yüzde ${percent}. Ders karnesini açar.`,
    intro: 'Bu dersteki süren, konuların ve deneme netlerin bir arada.',
    pickSubject: 'Ders',
    timeTitle: 'Çalışma süresi',
    today: 'Bugün',
    week: 'Bu hafta',
    total: 'Toplam',
    questions: (today: number, week: number, total: number) =>
      `Çözülen soru: bugün ${today} · bu hafta ${week} · toplam ${total}`,
    trendTitle: 'Son 8 hafta',
    trendEmpty: 'Son 8 haftada bu derste kayıtlı çalışma yok.',
    topicsTitle: 'Konular',
    done: (n: number) => `Bitti: ${n}`,
    review: (n: number) => `Tekrar lazım: ${n}`,
    started: (n: number) => `Çalışıldı, işaretlenmedi: ${n}`,
    untouched: (n: number) => `Dokunulmamış: ${n}`,
    reviewList: 'Tekrar bekleyen konular',
    untouchedShow: (n: number) => `Dokunulmamış konuları göster (${n})`,
    untouchedHide: 'Dokunulmamış konuları gizle',
    noTopics: 'Bu ders için konu listesi yok.',
    openTopics: 'Konuları işaretle',
    examsTitle: 'Deneme netleri',
    examsEmpty: 'Bu ders için henüz deneme neti yok. Deneme ekleyince netlerin burada görünür.',
    sectionTitle: (paper: string, section: string) => `${paper} · ${section}`,
    geometryNote: 'Geometri soruları Matematik testinin içinde; netler o testten.',
    missedTitle: 'En çok yanlış yaptığın konular',
    missedEmpty: 'Deneme analizinde bu dersten henüz konu işaretlemedin.',
    missedRow: (wrong: number, blank: number, time: string) => `${wrong} yanlış · ${blank} boş · çalıştığın: ${time}`,
    noTime: 'henüz süre yok',
  },

  /** Optional weekly target per subject. No reminder or notification is tied to it. */
  subjectTargets: {
    title: 'Haftalık hedef',
    stepper: 'Haftalık hedef',
    off: 'Yok',
    progress: (done: string, target: string, percent: number) => `${done} / ${target} · %${percent}`,
    reached: 'Bu haftaki hedef tamam.',
    left: (left: string) => `Hedefe ${left} kaldı.`,
    info: 'Yalnız senin planın: hatırlatıcı ya da bildirim yok.',
    weeklyTitle: 'Ders hedefleri',
    hint: 'Bir dersin karnesinden ona haftalık hedef koyabilirsin.',
    barLabel: (subject: string) => `${subject} haftalık hedefi`,
  },

  /** Monthly calendar on the weekly screen. */
  monthly: {
    title: 'Aylık görünüm',
    prev: '‹ Önceki ay',
    next: 'Sonraki ay ›',
    month: (year: number, month: number) => `${months[month - 1] ?? ''} ${year}`,
    total: (duration: string) => `Toplam: ${duration}`,
    studyDays: (n: number, of: number) => `Çalıştığın gün: ${n}/${of}`,
    restDays: (n: number) => `Ara verdiğin gün: ${n}`,
    best: (day: string, duration: string) => `En çok: ${day} · ${duration}`,
    average: (duration: string) => `Çalıştığın günlerde ortalama: ${duration}`,
    empty: 'Bu ay kayıtlı çalışma yok.',
    legend: 'Renk koyulaştıkça o gün daha çok çalışmışsın.',
    levels: ['Çalışma yok', '1 saatten az', '1–3 saat', '3–6 saat', '6 saat ve üstü'],
    legendA11y: (items: string) => `Renk açıklaması: ${items}`,
    cell: (date: string, duration: string) => `${date}: ${duration}`,
    cellNone: (date: string) => `${date}: çalışma yok`,
    cellFuture: (date: string) => `${date}: henüz gelmedi`,
  },

  /** Exam countdown line on the Home Screen widget (the days text is `countdown.days`). */
  widgetCountdown: {
    today: 'Sınav bugün',
  },
} as const;
