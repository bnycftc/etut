/**
 * Every user-facing text of the app. Turkish only for now.
 * Keep wording neutral: no age hints on the birth-year screen (hukuk/03 K-15),
 * no "sosyal ağ / sohbet / topluluk" positioning (K-13).
 */

import type { BackupError } from './domain/backup';
import type { MarkError, MarkKind } from './domain/exam-analysis';
import type { ExamDateKind } from './domain/exam-dates';
import type { ParentNoticeKind, ReactionKind, ReportReason } from './domain/groups';
import type { ManualEntryError } from './domain/manual-entry';
import type { ExamKind, ScoreError, YksArea } from './domain/net';
import type { ExamType } from './domain/profile';
import { possessive } from './domain/tr-suffix';

/** Shown wherever a data controller field has no value (every build except the release one). */
export const DATA_CONTROLLER_PLACEHOLDER = '[DOLDURULACAK]';

/**
 * Data controller ("veri sorumlusu", KVKK m.10) shown in the legal texts and on Hakkında. The real
 * values are deliberately not in this public repository (bny, 11 Oct 2026): the TestFlight build
 * gets them at bundle time from the GitHub secrets DATA_CONTROLLER_NAME / _CONTACT
 * (.github/workflows/testflight.yml), which Expo inlines from these EXPO_PUBLIC_ variables. Every
 * other build (tests, E2E, web) shows the placeholder. No postal address anywhere in the app: contact
 * is by e-mail only (bny, 18 Oct 2026).
 */
export const DATA_CONTROLLER = {
  name: process.env.EXPO_PUBLIC_DATA_CONTROLLER_NAME || DATA_CONTROLLER_PLACEHOLDER,
  /** Support and KVKK application e-mail; enables the İletişim button on Hakkında. */
  contact: process.env.EXPO_PUBLIC_DATA_CONTROLLER_CONTACT || DATA_CONTROLLER_PLACEHOLDER,
};

/** Date shown as "Son güncelleme" on the legal texts. */
export const LEGAL_UPDATED = '18 Ekim 2026';

export interface LegalSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface LegalDoc {
  title: string;
  sections: readonly LegalSection[];
}

const C = DATA_CONTROLLER;

/**
 * What the backup file and the CSV files hold, word for word the same in Aydınlatma and Gizlilik §3.
 * Keep it in step with `buildBackupFile` (domain/backup.ts) and `readSettings` (storage/backup.ts).
 */
// [AVUKAT TEYİDİ] Liste dosyanın gerçek içeriğine göre tamamlandı (alan, son ders, dosya bilgisi).
// [AVUKAT TEYİDİ] 0.4.1: hedef geçmişi eklendi (hedefin değiştirildiği günler ve değerleri, `dailyGoalHistory`).
const BACKUP_CONTENTS =
  'Yedek dosyasında doğum yılın, sınav türün ve alanın, tüm çalışma kayıtların (soru sayıları dahil), deneme netlerin ve analizlerin, konu işaretlerin, günlük hedefin (ve hangi gün kaça değiştirdiğin), derslere koyduğun haftalık hedefler, hedef netlerin, sınav tarihlerin, sayacı en son başlattığın ders, sayaç türün ve pomodoro ayarların, bir de dosyanın oluşturulduğu zaman ve uygulama sürümü bulunur. CSV dosyaları çalışma kayıtlarını (girdiysen soru sayısıyla) ve denemeleri içerir.';

const legalDocs = {
  aydinlatma: {
    title: 'Aydınlatma metni',
    sections: [
      {
        heading: 'Kim sorumlu?',
        paragraphs: [
          `Etüt’ü ${C.name} geliştiriyor; veri sorumlusu odur (gerçek kişi). Soruların için: ${C.contact} ya da Hakkında → İletişim.`,
        ],
      },
      {
        heading: 'Uygulama ne kaydediyor?',
        paragraphs: [
          // [AVUKAT TEYİDİ] 0.4.1: hedef geçmişi eklendi (hedefin değiştirildiği günler ve değerleri).
          // [AVUKAT TEYİDİ] 0.4.1 (X-7): "uygulamanın App Store puanlama penceresini en son ne zaman istediği"
          // eklendi (Gizlilik §2'de de). Yalnız bu telefonda durur, yedeğe girmez; tek amacı pencereyi 120 günde
          // bir kezden sık istememek. "Ne için?" cümlesi bu amacı ayrıca anmıyor; yeterli mi.
          'Doğum yılın (yalnız yıl), sınav türün ve alanın; çalışma oturumların (ders, konu, başlangıç ve bitiş zamanı, molalar ve uygulamadan çıktığın süreler, “elle” bilgisi, istersen girdiğin çözülen soru sayısı); konu ilerlemen; deneme netlerin ve analizlerin; günlük hedefin ve hedefini hangi gün kaça değiştirdiğin, derslere koyduğun haftalık hedefler, hedef netlerin ve sınav tarihin; sayaç ayarların (pomodoro, ekranı açık tutma, uygulamadan çıkınca ne olacağı), hatırlatıcı tercihlerin, en son ne zaman yedek dosyası oluşturduğun, yedek hatırlatmasını ne zaman kapattığın ve uygulamanın App Store puanlama penceresini en son ne zaman istediği.',
          // [AVUKAT TEYİDİ] Toplama yöntemi (KVKK m.10/1-ç; `docs/hukuk/kvkk/01` zorunlu unsur): otomatik
          // (cihazda) ve otomatik olmayan (e-posta) ayrımı bu cümleyle yeterli mi.
          'Bu bilgiler, uygulamayı kullanırken senin girdiklerinden ve sayacın tuttuğu zamanlardan oluşur; uygulama onları otomatik olarak bu telefona kaydeder. Bize e-postayla yazarsan yazdıkların bize otomatik olmayan yolla ulaşır.',
          'Uygulamanın hiç sormadıkları ve kaydetmedikleri: adın, e-postan, telefon numaran, okulun, konumun, fotoğrafların, rehberin, reklam kimliğin.',
        ],
      },
      {
        heading: 'Ne için?',
        paragraphs: [
          // [AVUKAT TEYİDİ] K-15 (a): bu metin onboarding'de doğum yılı kaydedilmeden önce açılır; eşik ve
          // sonuçları (15 yaş altında çalışma kartı kapalı ve App Store puanlama penceresi istenmez) burada değil,
          // Gizlilik §6 ve Kullanım §3'te yazar.
          'Sayacı çalıştırmak, sana kendi istatistiklerini göstermek ve yaşına uygun ayarları açmak için.',
        ],
      },
      {
        heading: 'Nerede duruyor, kim görüyor?',
        paragraphs: [
          // [AVUKAT TEYİDİ] Özne uygulama: iOS'ta "Uygulama Geliştiricileriyle Paylaş" açıksa Apple'ın çökme
          // kaydı ve kimliksiz kullanım sayılarını geliştiriciye iletmesi bu cümlenin dışında; anılmalı mı?
          'Bu telefonda. Uygulamanın sunucusu ve hesabı yok; uygulama internete bağlanmaz. Uygulama hiçbir bilgini kendiliğinden bize ya da başka bir şirkete göndermez; bize yalnız senin e-postayla göndermeyi seçtiğin şey ulaşır.',
          'Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS uygulama verilerini de bu yedeğe katar. Bu yedek senin Apple hesabında ya da bilgisayarında durur; bize gelmez.',
          `Yedek dosyası, CSV ya da çalışma kartı oluşturup paylaşırsan dosyanın nereye gideceğine sen karar verirsin. ${BACKUP_CONTENTS}`,
          // [AVUKAT TEYİDİ] Gönderen adı ve ekler eklendi: ad öğrencinin e-posta hesabından gelir, uygulama sormaz.
          // 0.4.1 (X-7): aynı e-posta (aynı adres, aynı konu satırı) Ayarlar → Geri bildirim gönder'den de açılır;
          // bu yol cümleye eklendi.
          'Hakkında → İletişim’den ya da Ayarlar → Geri bildirim gönder’den bize e-posta gönderirsen e-posta adresin, e-posta uygulamanın gönderen olarak gösterdiği ad (hesabında kayıtlıysa), yazdıkların, eklediğin dosyalar ve konu satırındaki uygulama ve işletim sistemi sürümü bize ulaşır. Bunları yalnız sana cevap vermek ve KVKK başvurunu sonuçlandırmak için kullanırız; başka bir amaçla kullanmaz, kimseyle paylaşmayız.',
          // [AVUKAT TEYİDİ] KVKK m.9 dayanağı. bny'nin destek kutusu Gmail (Google LLC, ABD); `docs/hukuk/kvkk/00`
          // §1.1'e göre yurt dışındaki bir e-posta hizmetinde saklamak aktarımdır. Kurul'un standart sözleşmesi
          // (SS-2) Google ile imzalanmadı ve Kurum'a bildirilmedi; bireysel Gmail'de bu yol yok (`00` §2), bu
          // yüzden metin "standart sözleşme" demiyor (yoksa 2026/347'nin yasakladığı yanıltıcı aydınlatma olur).
          // Metin öğrencinin kendi seçimine (yazmazsa aktarım yok) ve Google'ın güvenlik
          // önlemlerine dayanıyor; bu, m.9/6 arızi istisnalarına yakın bir dayanak ama `00` §1.5 düzenli bir
          // kanalın arızi sayılmayabileceğini söylüyor. Avukat seçsin: (a) bu metin, (b) Google Workspace'e geçip
          // Cloud DPA'nın Türkiye ek şartlarıyla SS-2 imzalamak + 5 iş günü içinde Kurum'a bildirmek (o zaman bu
          // cümle "standart sözleşme" diye değişir), (c) Türkiye'de barındırılan e-posta (rapor seçenek A; aktarım
          // yok). Gmail'in tüketici hesabında Google'ın veri işleyen mi bağımsız sorumlu mu olduğu da sorulmalı.
          'E-posta adresimiz Gmail’de. Bu yüzden bize yazdığın e-posta, Google’ın (Google LLC, ABD) Türkiye dışındaki sunucularında saklanır; bu, KVKK m.9 kapsamında yurt dışına aktarımdır. Bu aktarım yalnız sen bize e-postayla yazmayı seçersen olur ve Google’ın kendi güvenlik önlemleriyle korunur.',
          // [AVUKAT TEYİDİ] Mektup yolu kaldırıldı (bny, 18 Ekim 2026: posta adresi yayımlanmaz); tek başvuru
          // kanalı e-posta (Gmail, yurt dışı). m.9 "seçim" dayanağı ve Başvuru Tebliği m.5 bununla yeterli mi.
        ],
      },
      {
        heading: 'Ne kadar kalıyor?',
        paragraphs: [
          'Sen silene kadar. Ayarlar → Tüm verileri sil her şeyi siler; uygulamayı kaldırmak da bu telefondakileri siler. Telefonunun kendi yedeğindeki kopya o yedekle birlikte silinir.',
          'Tek istisna: 15 yaş altı beyanında, beyan edilen doğum yılı yaş kuralı gereği 15 yaşına gelinceye kadar bu cihazda ayrıca saklanır (yaşın yeniden kayıtla yükseltilemesin diye).',
          'Yedekten “Değiştir” ile yükleme yaparsan, geri alabilmen için önceki verilerinin bir kopyası bu telefonda kalır. Bir gün geçtikten sonra uygulamayı ilk açışında ya da “Yedekle ve geri yükle” ekranını açınca silinir. “Tüm verileri sil” bu kopyayı da siler.',
          'Bize yazdığın e-postaları konu kapandıktan sonra 1 yıl, KVKK başvurularını ve cevaplarımızı 3 yıl saklar, sonra sileriz.',
        ],
      },
      {
        heading: 'Hukuki sebep',
        paragraphs: [
          // [AVUKAT TEYİDİ] Destek yazışması için m.5/2-c (kullanım şartları sözleşmesi) ve yurt dışı cümlesi:
          // yukarıdaki m.9 notu.
          'Uygulamanın bu telefonda tuttuğu bilgiler, uygulamayı senin isteğinle kullanabilmen için gereklidir (KVKK m.5/2-c, sözleşmenin kurulması ve ifası). Bize e-posta yazarsan yazışma, sorununu çözmek için yine m.5/2-c’ye; KVKK başvurusuysa cevap verme yükümlülüğümüze (m.5/2-ç, KVKK m.13) dayanır. E-postanın Google’ın yurt dışındaki sunucularında durması, bize e-postayla yazmayı senin seçmene dayanır (KVKK m.9). Uygulamada reklam, analitik, çökme raporu ve izleme yoktur.',
        ],
      },
      {
        heading: 'Hakların',
        paragraphs: [
          // [AVUKAT TEYİDİ] KVKK m.11/1 (a)–(ğ) sırayla ve sade dille; kanun metnine uygunluğu.
          'KVKK m.11’e göre bize başvurarak şu haklarını kullanabilirsin:',
          '(a) Hakkında kişisel veri işlenip işlenmediğini öğrenmek.',
          '(b) İşlendiyse bununla ilgili bilgi istemek.',
          '(c) Verilerinin hangi amaçla işlendiğini ve bu amaca uygun kullanılıp kullanılmadığını öğrenmek.',
          '(ç) Verilerinin yurt içinde ya da yurt dışında kimlere aktarıldığını bilmek.',
          '(d) Verilerin eksik ya da yanlış işlendiyse düzeltilmesini istemek.',
          '(e) Verilerinin KVKK m.7’deki şartlarla silinmesini ya da yok edilmesini istemek.',
          '(f) (d) ve (e)’ye göre yapılan düzeltmenin ya da silmenin, verilerinin aktarıldığı kişilere de bildirilmesini istemek.',
          '(g) Verilerinin yalnız otomatik sistemlerle analiz edilmesi sonucunda aleyhine bir sonuç çıkarsa buna itiraz etmek.',
          '(ğ) Verilerinin kanuna aykırı işlenmesi yüzünden zarara uğradıysan zararının giderilmesini istemek.',
          // [AVUKAT TEYİDİ] Başvuru Tebliği m.5/1: uygulamadaki mailto (kayıtlı e-posta değil) başvuru kanalı
          // sayılır mı — rapor E3, 4.2.
          'Uygulamadaki verilerin yalnız sende: Ayarlar’dan görebilir, yedek ya da CSV olarak dışa aktarabilir, istediğin an silebilirsin. Başvurunu Hakkında → İletişim’den e-postayla ' +
            `(${C.contact}) yapabilirsin. En geç 30 gün içinde ücretsiz ve yazılı cevap veririz. Cevabımızdan memnun kalmazsan Kişisel Verileri Koruma Kurulu’na şikâyet edebilirsin.`,
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
          'Reklam yok, analitik yok, izleme yok. Hesap ve sunucu yok: uygulama internete bağlanmaz, bilgilerin bu telefonda tutulur ve uygulama onları bize göndermez. Bize yalnız senin e-postayla göndermeyi seçtiğin şey ulaşır (3. bölüm).',
          'Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS uygulama verilerini de bu yedeğe katar; bu yedek senin Apple hesabında ya da bilgisayarında durur.',
        ],
      },
      {
        heading: '2. Cihazda tutulanlar',
        paragraphs: [
          // [AVUKAT TEYİDİ] 0.4.1: hedef geçmişi eklendi (hedefin değiştirildiği günler ve değerleri).
          // [AVUKAT TEYİDİ] 0.4.1 (X-7): puanlama penceresinin en son istendiği zaman eklendi; bkz. Aydınlatma
          // "Uygulama ne kaydediyor?" notu.
          'Doğum yılı (yaş kuralı için), sınav türü ve alan (ders ve konu listesi için), çalışma oturumları (ders, konu, zamanlar, molalar ve uygulama dışında geçen süreler, “elle” bilgisi, istersen girdiğin çözülen soru sayısı), konu ilerlemesi, deneme netleri ve analizleri, günlük hedef ve hedefin değiştirildiği günler ile değerleri, derslere koyduğun haftalık hedefler, hedef netler, sınav tarihi, pomodoro ve sayaç ayarları (ekranı açık tutma, uygulamadan çıkınca ne olacağı), hatırlatıcı tercihleri, son yedek dosyasının oluşturulma zamanı, yedek hatırlatmasının kapatıldığı zaman ve App Store puanlama penceresinin en son istendiği zaman.',
          'Yedekten “Değiştir” ile yükleme yaparsan, geri alabilmen için önceki verilerinin bir kopyası bir gün boyunca bu telefonda kalır (5. bölüm).',
          // [AVUKAT TEYİDİ] Widget koşulu kaldırıldı (uygulama bu alana her değişiklikte yazar) ve kilit ekranı
          // sayacının gösterdiği ders ve konu adı eklendi.
          'iPhone’da uygulama, widget gösterebilsin diye bugünkü süre, hedef, seri ve sınavına kalan gün bilgisini, widget eklemesen de, widget’ın okuyabildiği ortak bir alanda yine bu telefonda tutar. Sayaç açıkken kilit ekranında ve Dynamic Island’da ders ve konu adı görünür.',
          'Uygulama ad, e-posta, telefon, okul, konum, rehber, fotoğraf ve reklam kimliği hiç sormaz ve toplamaz.',
        ],
      },
      {
        heading: '3. Paylaşım',
        paragraphs: [
          'Uygulama hiçbir bilgini kendiliğinden bize göndermez; bize yalnız kendin yazmayı seçtiğin e-postalar ulaşır. Onları yalnız sana cevap vermek ve KVKK başvurunu sonuçlandırmak için kullanırız. Hiçbir bilgiyi satmayız, reklam ya da başka bir amaçla kimseyle paylaşmayız.',
          // [AVUKAT TEYİDİ] KVKK m.9 dayanağı: "Aydınlatma metni" → "Nerede duruyor" altındaki nota bak.
          'E-posta adresimiz Gmail’de olduğu için bu e-postalar Google’ın (Google LLC, ABD) Türkiye dışındaki sunucularında saklanır; bu, KVKK m.9 kapsamında yurt dışına aktarımdır ve yalnız sen bize e-postayla yazmayı seçersen olur.',
          `Yedek, CSV ya da çalışma kartı yalnız sen dokunduğunda, telefonunun paylaşım ekranıyla dışarı çıkar. Seçtiğin uygulama ya da servis (ör. Dosyalar, AirDrop, bir mesajlaşma uygulaması) kendi kurallarına tabidir. ${BACKUP_CONTENTS} Çalışma kartında ad, yaş, okul gibi seni tanıtan bilgi yer almaz.`,
        ],
      },
      {
        heading: '4. İzinler',
        paragraphs: [
          'Uygulama konum, kamera, mikrofon, fotoğraf okuma, rehber ya da takip (ATT) izni istemez. Yedeği geri yüklerken dosyayı sen seçersin; uygulama yalnız seçtiğin dosyayı okur.',
          'Bildirim iznini yalnız Ayarlar → Hatırlatıcılar’dan bir hatırlatıcıyı açtığında sorar. Hatırlatıcılar telefonunda kurulur ve telefonunda gösterilir; bunun için de bize hiçbir şey gitmez. İzni istediğin an iOS Ayarlar’ından kapatabilirsin.',
          'Çalışma kartını paylaşım ekranından “Görüntüyü Kaydet” ile Fotoğraflar’a eklemek istersen iOS yalnız ekleme izni sorar; Etüt fotoğraflarını göremez.',
        ],
      },
      {
        heading: '5. Saklama ve silme',
        paragraphs: [
          'Veriler sen silene kadar cihazda kalır. Ayarlar → Tüm verileri sil ya da uygulamayı kaldırmak bu telefondakilerin hepsini siler; telefonunun kendi yedeğindeki kopya o yedekle birlikte silinir. 15 yaş altı beyanında yalnız beyan edilen doğum yılı, 15 yaşına gelinceye kadar ayrıca saklanır.',
          '“Değiştir” ile yedek yüklediğinde önceki verilerinin geri alma kopyası, bir gün geçtikten sonra uygulamayı ilk açışında ya da “Yedekle ve geri yükle” ekranını açınca silinir. Bize yazdığın e-postaları konu kapandıktan sonra 1 yıl, KVKK başvurularını ve cevaplarımızı 3 yıl saklar, sonra sileriz.',
        ],
      },
      {
        heading: '6. Çocuklar ve gençler',
        paragraphs: [
          // [AVUKAT TEYİDİ] Gruplar kimsede yok. 0.4.0'da yaşa bağlı tek fark çalışma kartıydı; 0.4.1'den (X-7) beri
          // iki fark var: çalışma kartı ve App Store puanlama penceresi (15 yaş altında hiç istenmez). K-15 için bkz.
          // Aydınlatma "Ne için?".
          'Etüt çocuklara özel bir uygulama değildir ve App Store’da Çocuklar kategorisinde yer almaz. 15 yaşından küçükler için çalışma kartı kapalıdır ve uygulama App Store puanlama penceresini istemez; uygulamanın geri kalanı herkes için aynıdır. Yaş beyanı sonradan yükseltilemez; yedek geri yüklemek de yaşı yükseltemez.',
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
          // [AVUKAT TEYİDİ] m.11 haklarının tek tek listesi Aydınlatma metninde; buradan oraya gönderme yeterli mi.
          'Verilerini görebilir, yedek ya da CSV olarak dışa aktarabilir ve silebilirsin. KVKK m.11’deki haklarının hepsi Aydınlatma metninin “Hakların” bölümünde tek tek yazar. KVKK kapsamındaki başvurunu Hakkında → İletişim’den e-postayla ' +
            `(${C.contact}) yapabilirsin. En geç 30 gün içinde ücretsiz ve yazılı cevap veririz. Cevabımızdan memnun kalmazsan Kişisel Verileri Koruma Kurulu’na şikâyet edebilirsin.`,
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
          `Bu şartlar Etüt’ü geliştiren ${C.name} ile uygulamayı kullanan sen arasındadır. Kişisel verilerin nasıl işlendiği ayrı metinde (Aydınlatma metni) anlatılır.`,
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
          // [AVUKAT TEYİDİ] Gizlilik §6 ile aynı: yaşa bağlı iki fark, çalışma kartı ve App Store puanlama penceresi
          // (0.4.1, X-7).
          'Doğum yılını doğru seçmelisin. 15 yaşından küçüksen çalışma kartı kapalıdır ve uygulama App Store puanlama penceresini istemez; uygulamanın geri kalanı herkes için aynıdır.',
        ],
      },
      {
        heading: '4. Verilerin',
        paragraphs: [
          'Verilerin bu telefonda tutulur; Etüt onları hiçbir sunucuya göndermez. Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS onları o yedeğe de katar. Bu yedek yoksa, telefon değiştirirken ya da uygulamayı silmeden önce Ayarlar → Yedekle ve geri yükle → “Yedek dosyası oluştur” ile yedek al; yedeği saklamak senin elindedir.',
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

/** `2 deneme ve 1 net hedefi`, `2 deneme`, `1 net hedefi` */
const examsAndTargets = (exams: number, targets: number): string =>
  exams > 0 && targets > 0 ? `${exams} deneme ve ${targets} net hedefi` : exams > 0 ? `${exams} deneme` : `${targets} net hedefi`;

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

/** "YKS’ye 258 gün" — every built-in exam name ends in "S", so the suffix is "’ye". */
const countdownDays = (examType: ExamType, days: number): string =>
  examType === 'DIGER' ? `Sınavına ${days} gün` : `${examTypes[examType]}’ye ${days} gün`;

/** The day's one celebration after Bitir: shown under the saved time and read out with it. */
const finishGoalReached = 'Bugünkü hedef tamam';

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
    /** The bar above the number pad (it has no return key). */
    keyboardDone: 'Bitti',
    /** Its screen-reader name: which box it closes the keyboard of (`Klavyeyi kapat: Süre, Saat`). */
    keyboardDoneA11y: (field: string) => `Klavyeyi kapat: ${field}`,
  },

  /** Root error screen (app/_layout.tsx ErrorBoundary): nothing is deleted, nothing is sent. */
  crash: {
    title: 'Bir şey ters gitti',
    body: 'Bu ekran açılırken bir hata oldu. Kayıtların cihazında duruyor; hiçbiri silinmedi.',
    retry: 'Yeniden dene',
    contact: (address: string) => `Sorun sürerse bize yaz: ${address}`,
  },

  tabs: {
    timer: 'Sayaç',
    exams: 'Denemeler',
    groups: 'Gruplar',
    settings: 'Ayarlar',
  },

  onboarding: {
    title: 'Etüt’e hoş geldin',
    intro:
      'Etüt çalışma süreni ve deneme netlerini tutar. Birkaç soruyla başlayalım; cevapların bu cihazda saklanır, bize gönderilmez.',
    birthYearTitle: 'Doğum yılın',
    birthYearHint: 'Yalnız yılı soruyoruz.',
    olderYears: 'Daha önceki yıllar',
    examTitle: 'Hazırlandığın sınav',
    areaTitle: 'Alanın',
    start: 'Başla',
    ageBlocked: 'Bu doğum yılı bu cihazda kaydedilemiyor. Seçimini kontrol edip yeniden dene.',
    privacyLink: 'Bilgilerin nasıl saklanıyor?',
  },

  timer: {
    today: 'Bugün',
    /** Next to today's total when today's sessions have a question count (never a rate per hour). */
    todayQuestions: (n: number) => `· ${n} soru`,
    history: 'Geçmiş',
    pickSubject: 'Ders seç',
    /** After the recently studied subjects: shows the rest of the list. */
    allSubjects: 'Tüm dersler',
    allSubjectsHint: (more: number) => `${more} ders daha gösterir`,
    start: 'Başla',
    pause: 'Mola',
    resume: 'Devam',
    finish: 'Bitir',
    running: 'Çalışıyorsun',
    paused: 'Moladasın',
    awayTitle: (duration: string) => `${duration} uygulamanın dışındaydın.`,
    awayBody: 'Bu süre mola sayıldı.',
    /** Pomodoro: only the part that fell in work blocks costs study time (the breaks were breaks). */
    awayBodyStudy: (study: string) => `Çalışma bloklarına denk gelen ${study} mola sayıldı.`,
    /** Rule "Çalışmaya devam say": the first `hours` away counted, only the rest became the break. */
    awayTitleCapped: (hours: number) => `${hours} saatten uzun uygulamanın dışındaydın.`,
    awayBodyCapped: (hours: number, rest: string) =>
      `İlk ${hours} saat sayaç saymaya devam etti, sonraki ${rest} mola sayıldı.`,
    awayBodyCappedStudy: (hours: number, study: string) =>
      `İlk ${hours} saat sayaç saymaya devam etti; sonrasında çalışma bloklarına denk gelen ${study} mola sayıldı.`,
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
    start: 'Başlangıç (Türkiye saati)',
    duration: 'Süre',
    hour: 'Saat',
    minute: 'Dakika',
    hours: 'Saat',
    minutes: 'Dakika',
    /** Screen-reader name of a time box: `Başlangıç, Saat` / `Süre, Saat`. */
    fieldA11y: (group: string, field: string) => `${group}, ${field}`,
    /** A duration chip: `45 dk`. */
    chipMinutes: (minutes: number) => `${minutes} dk`,
    timeTitle: 'Ne zaman?',
    /** Today's default (the entry ends now) and the button that returns to it. */
    justFinished: 'Az önce bitti',
    /** `Az önce bitti: 11:15–12:00` */
    justFinishedSpan: (start: string, end: string) => `Az önce bitti: ${start}–${end}`,
    changeTime: 'Saati değiştir',
    /** Under "Az önce bitti" when the span was moved back so it does not overlap a record (IOS-06). */
    movedBefore: 'Başka bir kaydınla çakışmasın diye o kayıttan önceye yerleştirildi.',
    /** Under the overlap error: the way out. */
    overlapHint: 'Süreyi kısalt ya da başka bir saat seç.',
    add: 'Ekle',
    added: (duration: string) => `Eklendi: ${duration} (elle)`,
    limits:
      'Yalnız son 7 gün (bugün dahil) için; tek kayıt en fazla 10 saat; gelecekteki ya da başka kayıtla çakışan zaman eklenemez.',
    /** Examples, not values: "ör." keeps an empty box from looking filled in (IOS-07). */
    placeholders: { startHour: 'ör. 14', startMinute: 'ör. 30', durationHours: 'ör. 1', durationMinutes: 'ör. 45' },
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
    /** Screen-reader name of an entry's "Sil" (one per listed entry): `Sil: Fizik, 4 Ekim 2026 · 14:30, 45 dk`. */
    deleteA11y: (entry: string, when: string, duration: string) => `Sil: ${entry}, ${when}, ${duration}`,
  },

  /** Label of sessions added afterwards (`source = 'manual'`). */
  manualTag: 'elle',

  goal: {
    title: 'Günlük hedef',
    progress: (goal: string, percent: number) => `Hedef ${goal} · %${percent}`,
    met: 'Bugünkü hedefini tutturdun.',
    set: 'Günlük hedef koy',
    streak: (days: number) => `Seri: ${days} gün`,
    /** The compact streak badge on the timer's "Bugün" card (read out as `streak`). */
    streakBadge: (days: number) => `${days} gün`,
    /** Under the badge: the rule, never a warning (one missed day a week keeps the streak). */
    restRule: 'Haftada 1 dinlenme günü hakkın var',
    restUsed: 'Bu haftaki dinlenme günün kullanıldı.',
    restFree: 'Bu hafta 1 dinlenme günü hakkın var.',
    turnOff: 'Hedefi kapat',
    turnOn: 'Hedef koy',
    info: 'Hedefini tutturduğun ardışık günler seriyi oluşturur. Haftada 1 gün hedefin altında kalırsan seri bozulmaz; o gün dinlenme günü sayılır.',
    /** Under the goal setting after a raise made once today's goal was met (`goalFromTomorrow`). */
    startsTomorrow: 'Bugünkü hedefin tuttu, yeni hedef yarın başlar.',
  },

  countdown: {
    /** "YKS’ye 258 gün" (the widget). */
    days: countdownDays,
    /** The one muted line on the timer's "Bugün" card: "YKS · 258 gün · tahmini". */
    line: (examType: ExamType, days: number, estimated: boolean) =>
      `${examType === 'DIGER' ? 'Sınav' : examTypes[examType]} · ${days} gün${estimated ? ' · tahmini' : ''}`,
    /** What a screen reader says for `line`: "YKS’ye 258 gün, tahmini tarih". */
    lineA11y: (examType: ExamType, days: number, estimated: boolean) =>
      `${countdownDays(examType, days)}${estimated ? ', tahmini tarih' : ''}`,
    today: 'Sınav günü bugün. Başarılar!',
    /** The exam day by the built-in estimate: it may not be the real day. */
    todayEstimated: 'Tahmini sınav günü bugün. Başarılar!',
    estimated: 'tahmini',
    custom: 'senin girdiğin tarih',
    settingsTitle: 'Sınav tarihi',
    /**
     * The line under the shown date, by what it is (`domain/exam-dates.ts`). No year in it: it must
     * stay true when the built-in dates are updated. `null` = nothing to add (the tag says it).
     */
    settingsInfo: (examType: ExamType, kind: ExamDateKind): string | null => {
      switch (kind) {
        case 'estimated':
          return examType === 'KPSS'
            ? 'Bu tarih, bir sonraki KPSS Lisans (B grubu) oturumu için önceki yılların düzenine göre bir tahmindir. A grubuna ya da başka bir oturuma giriyorsan tarihini kendin gir.'
            : 'Bu tarih önceki yılların düzenine göre bir tahmindir; kesin tarih açıklanınca buradan düzeltebilirsin.';
        case 'official':
          return 'Bu tarih resmî sınav takviminden; değişirse buradan düzeltebilirsin.';
        case 'none':
          return 'Sınav tarihini girersen Sayaç ekranında geri sayım görünür.';
        case 'custom':
          return null;
      }
    },
    none: 'Tarih yok',
    input: 'Tarih (GG.AA.YYYY)',
    placeholder: 'GG.AA.YYYY',
    /** Button that drops the student's date; `builtIn` is what is shown after it. */
    reset: (builtIn: ExamDateKind) =>
      builtIn === 'none' ? 'Tarihi kaldır' : builtIn === 'official' ? 'Resmî tarihe dön' : 'Tahmini tarihe dön',
    invalid: 'Bugün ya da sonrası için GG.AA.YYYY biçiminde bir tarih gir.',
  },

  /** The line under today's total, only with study time in that past (`comparisonLine`); `weekly`: shortcut. */
  compare: {
    yesterday: 'Dün bu saate kadar',
    lastWeek: 'Geçen hafta bu zamana kadar',
    weekly: 'Haftalık özet',
  },

  weekly: {
    title: 'Haftalık özet',
    range: (from: string, to: string) => `${from} – ${to}`,
    /** Screen-reader names of the ‹ › buttons around the week. */
    prev: 'Önceki hafta',
    next: 'Sonraki hafta',
    total: 'Toplam',
    previousWeek: (duration: string) => `Önceki hafta: ${duration}`,
    subjects: 'Ders dağılımı',
    longest: 'En uzun oturum',
    streak: 'Seri',
    goalDays: (n: number) => `Hedefi tutturduğun gün: ${n}/7`,
    activeDays: (n: number) => `Çalıştığın gün: ${n}/7`,
    /** The 2 × 2 tiles at the top of the week; each is read as one "label: value" (`activeDays` for the days). */
    tileDays: 'Çalıştığın gün',
    tileDaysValue: (n: number) => `${n}/7`,
    tileAverage: 'Ortalama',
    tileAverageA11y: (duration: string) => `Çalıştığın günlerde ortalama: ${duration}`,
    tileBest: 'En çok',
    tileBestA11y: (day: string, duration: string) => `En çok: ${day} · ${duration}`,
    tileA11y: (label: string, value: string) => `${label}: ${value}`,
    /** An empty week's average and best day. */
    tileNone: '–',
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
    /** The pause button in pomodoro mode ("Mola" there is the phase). */
    pause: 'Duraklat',
    /** Screen-reader name of the countdown: `24 dakika 12 saniye kaldı` (short: read on every change). */
    leftA11y: (hours: number, minutes: number, seconds: number) => {
      const parts = [hours > 0 ? `${hours} saat` : '', minutes > 0 ? `${minutes} dakika` : ''].filter((p) => p !== '');
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds} saniye`);
      return `${parts.join(' ')} kaldı`;
    },
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
    presets: 'Hazır düzenler',
    /** A preset chip: `50/10`. */
    preset: (work: number, short: number) => `${work}/${short}`,
    presetA11y: (work: number, short: number) => `${work} dakika çalışma, ${short} dakika mola`,
    reset: 'Varsayılana dön',
    /** Opens the durations under the presets (a closed group, like iOS's disclosure). */
    details: 'Ayrıntı',
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
    /**
     * Screen-reader name of a topic's mark chip: which topic it marks. TYT and AYT share topic
     * names (Fonksiyonlar, Olasılık…), so the paper comes first when there is one.
     */
    markA11y: (topic: string, mark: string, paper: string | null) =>
      paper === null ? `${topic}: ${mark}` : `${paper} ${topic}: ${mark}`,
    /** A topic name with its paper where TYT and AYT share the name: `AYT Fonksiyonlar`. */
    withPaper: (topic: string, paper: string | null) => (paper === null ? topic : `${paper} ${topic}`),
    noTime: 'Henüz süre yok',
    unsupported: 'Konu listeleri YKS, LGS ve KPSS için var.',
  },

  history: {
    title: 'Geçmiş',
    last7: 'Son 7 gün',
    days: 'Günler',
    manualLine: (duration: string) => `Elle eklenen: ${duration}`,
    todayLabel: 'Bugün',
    /**
     * Short label above a bar: `2,1 sa` (hours, one decimal, rounded down so 1:59 is not `2 sa`; never
     * `2:05`, which reads as a clock) or `45 dk`. A bar with time is never `0 dk`: under a minute it is
     * `<1 dk` (V-11; empty bars have no label).
     */
    barValue: (hours: number, minutes: number) =>
      hours > 0
        ? `${(Math.floor((hours * 60 + minutes) / 6) / 10).toString().replace('.', ',')} sa`
        : minutes > 0
          ? `${minutes} dk`
          : '<1 dk',
    /** A day's timer sessions, folded away by default (the place to delete one). */
    sessionsShow: 'Sayaç kayıtları',
    sessionsHide: 'Kayıtları gizle',
    /** `Fizik · 14:30–16:05` (Istanbul time) */
    sessionLine: (title: string, from: string, to: string) => `${title} · ${from}–${to}`,
    deleteConfirm:
      'Bu sayaç kaydı silinsin mi? Süresi günlük toplamdan, seriden ve raporlardan düşer; geri alınamaz.',
    /** Screen-reader name of a record's "Sil": which record. */
    deleteA11y: (line: string) => `${line} kaydını sil`,
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
    /** Screen-reader name of an exam in the list: one sentence instead of its pieces. */
    itemA11y: (kind: string, net: string, day: string, scope: string, pending: boolean) =>
      `${kind}, ${net} net, ${day}, ${scope}${pending ? ', analiz bekliyor' : ''}`,
    itemHint: 'Denemenin ayrıntısını açar',
    newTitle: 'Yeni deneme',
    detailTitle: 'Deneme',
    kind: 'Sınav',
    scope: 'Deneme türü',
    section: 'Ders',
    date: 'Deneme tarihi',
    /** Screen-reader names of the ‹ › buttons around the day. */
    prevDay: 'Önceki gün',
    nextDay: 'Sonraki gün',
    correct: 'Doğru',
    wrong: 'Yanlış',
    /** Screen-reader name of a count box: which section it belongs to. */
    countLabel: (section: string, what: string) => `${section}, ${what}`,
    questions: (n: number) => `${n} soru`,
    correctWrongShort: (correct: number, wrong: number) => `${correct} D · ${wrong} Y`,
    /** Screen-reader name of a section row on the exam screen ("30 D · 6 Y" spelled out). */
    sectionA11y: (section: string, correct: number, wrong: number, net: string) =>
      `${section}: ${correct} doğru, ${wrong} yanlış, ${net} net`,
    /** Shown under the totals when the rounded section nets do not add up to the total (LGS). */
    roundingNote: 'Toplam net, yuvarlanmamış ders netlerinden hesaplanır; bu yüzden ders netlerinin toplamıyla arasında küçük bir fark olabilir.',
    fixErrors: 'Hatalı alanları düzelt.',
    /** "Kaydet" on a form with no correct or wrong answer anywhere (it would be a 0-net exam). */
    emptyExam: 'Kaydetmek için en az bir derse doğru ya da yanlış sayısı gir.',
    /** Leaving the form (Vazgeç or pulling the sheet down) with unsaved input. */
    discardNew: 'Girdiklerin kaydedilmeyecek. Çıkılsın mı?',
    discardEdit: 'Değişikliklerin kaydedilmeyecek. Çıkılsın mı?',
    discardLeave: 'Kaydetmeden çık',
    discardStay: 'Düzenlemeye dön',
    deleteConfirm: 'Bu deneme silinsin mi?',
    notFound: 'Deneme bulunamadı.',
    /** How the net is computed on this paper (4 for YKS/KPSS, 3 for LGS). */
    netRule: (wrongsPerCorrect: number) => `Net = Doğru − Yanlış ÷ ${wrongsPerCorrect}`,
    today: 'Bugün',
    yesterday: 'Dün',
    edit: 'Düzenle',
    editTitle: 'Denemeyi düzenle',
    editNote:
      'Konu işaretlerin korunur. Yanlış ya da boş sayısı işaretlediklerinin altına inen dersin işaretleri silinir. Deneme türünü (Genel/Branş) ya da branşı değiştirirsen formda kalmayan derslerin işaretleri de silinir; sınavı değiştirirsen hepsi silinir. İşaret silinirse analiz yeniden bekler.',
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
    /** The target band in a net chart, written at its right end. */
    chartTarget: (net: string) => `Hedef ${net}`,
    /** The target in the chart's spoken summary. */
    chartTargetA11y: (net: string) => `hedef ${net} net`,
    /** Confirmation on the list right after "Kaydet" in the new-exam form. */
    saved: (net: string) => `${net} net kaydedildi`,
    savedAnalysisHint: 'Kitapçık elindeyse şimdi analize başla; değilse sonra bu sekmeden de başlayabilirsin.',
    savedDismiss: 'Kapat',
    savedDismissA11y: 'Kaydedildi bilgisini kapat',
    /** The list shows the newest exams first, a page at a time. */
    showMore: 'Daha fazla göster',
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
    wrong: 'Yanlış',
    blank: 'Boş',
    /**
     * Quick analysis: the Yanlış | Boş switch of a section. Screen readers hear its state (selected)
     * and how many of that kind are tagged; "2/6" could be read out as a date, so words.
     */
    kindA11y: (what: string, tagged: number, total: number) => `${what}: ${total} sorudan ${tagged} tanesi işaretlendi`,
    tapHint: (kind: MarkKind) =>
      kind === 'wrong' ? 'Bir konuya dokununca ona 1 yanlış eklenir.' : 'Bir konuya dokununca ona 1 boş eklenir.',
    allTagged: (kind: MarkKind) =>
      kind === 'wrong' ? 'Bu dersteki yanlışların hepsini işaretledin.' : 'Bu dersteki boşların hepsini işaretledin.',
    /** A topic chip with its count badge, read as one sentence. */
    topicA11y: (topic: string, wrong: number, blank: number) =>
      wrong + blank === 0 ? topic : `${topic}: ${wrong} yanlış, ${blank} boş`,
    /** Read out after a tap (`topicA11y`); `allTagged` follows when it tagged the last one of its kind. */
    tappedA11y: (topic: string, allTagged: string | null) => (allTagged === null ? topic : `${topic}. ${allTagged}`),
    topicHint: (kind: MarkKind) => (kind === 'wrong' ? '1 yanlış ekler' : '1 boş ekler'),
    /** The steppers (to lower a count) are folded away under this button. */
    detailsShow: 'Ayrıntı',
    detailsHide: 'Ayrıntıyı gizle',
    detailsA11y: (section: string, open: boolean) => `${section}: ${open ? 'ayrıntıyı gizle' : 'ayrıntıyı göster'}`,
    detailsNote: 'Fazla işaretlediysen − ile azalt.',
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
    /** Which exams the list looks at (`MISSED_WINDOW` in domain/exam-analysis.ts). */
    topMissedWindow: (window: number) => `Konu işaretlediğin son ${window} denemeye göre.`,
    /** On the "Çalış" line: study time on the topic since the last exam that missed it. */
    missedSince: (day: string, time: string | null) =>
      time === null ? `${day} denemesinden beri bu konuda süre yok.` : `${day} denemesinden beri ${time} çalıştın.`,
    unknownTopic: 'Eski konu',
    /** Screen-reader name of a stepper: topic and what it counts. */
    countLabel: (topic: string, what: string) => `${topic}, ${what}`,
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
    /** How a target net is checked (`TARGET_WINDOW` in domain/exam-analysis.ts). */
    targetRule: (window: number) =>
      `Hedef netin, bu dersteki son ${window} denemedeki (genel ya da branş) netlerinin ortalamasıyla kıyaslanır.`,
    /** `example` fits the section (`targetExample` in domain/exam-analysis.ts). */
    targetPlaceholder: (example: string) => `ör. ${example}`,
    targetNone: 'Bu ders için hedef koymadın.',
    targetCurrent: (target: string) => `Hedef: ${target} net`,
    targetSave: 'Hedefi kaydet',
    targetClear: 'Hedefi kaldır',
    targetInvalid: (questions: number, example: string) =>
      `0’dan büyük, en fazla ${questions} olan ve en çok iki ondalıklı bir net gir (ör. ${example}).`,
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
    /** The row under the "Hatırlatıcılar" section title in Ayarlar. */
    open: 'Hatırlatıcıları ayarla',
    summaryOff: 'Bildirim izni verilmedi; hatırlatıcılar gelmez.',
    summaryOn: (count: number) => (count === 0 ? 'Açık hatırlatıcı yok.' : `${count} hatırlatıcı açık.`),
    info: 'Hatırlatıcılar bu cihazda kurulur; hiçbir sunucuya bir şey gönderilmez. Uygulama açıkken yalnız uzun oturum uyarısı gösterilir.',
    permissionMissing: 'Hatırlatıcıların gelmesi için bildirim izni gerekiyor.',
    permissionAsk: 'Bildirim izni iste',
    permissionDenied:
      'Bildirim izni kapalı. Telefonun Ayarlar uygulamasından Etüt’ün bildirimlerini açabilirsin.',
    openSettings: 'Ayarları aç',
    unsupported: 'Bu cihazda hatırlatıcı yok.',
    longSession: 'Uzun oturum uyarısı',
    longSessionInfo: (hours: number) =>
      `Sayaç ${hours} saat boyunca duraklatılmadan açık kalırsa “Hâlâ çalışıyor musun?” diye sorar. Pomodoro molaları sayacı duraklatmaz.`,
    longSessionHours: 'Süre',
    hours: (n: number) => `${n} saat`,
    pomodoro: 'Pomodoro aşama sonu',
    pomodoroInfo: 'Uygulama kapalıyken çalışma ya da mola bitince haber verir.',
    daily: 'Günlük çalışma hatırlatıcısı',
    dailyInfo: 'Seçtiğin saatte (Türkiye saati) bir kez hatırlatır; o gün çalıştıysan hatırlatmaz.',
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
    body: 'Etüt yalnız açık olan hatırlatıcılar için bildirim gösterir.',
    willBeOn: (count: number) => (count === 1 ? 'İzin verirsen bu hatırlatıcı açılır:' : 'İzin verirsen bunlar açılır:'),
    /** Under the list: only the reminder the student turned on comes on. */
    othersOff: 'Diğer hatırlatıcılar kapalı kalır; istersen sonra Hatırlatıcılar ekranından tek tek açabilirsin.',
    /** No reminder was turned on (only the permission was asked for). */
    noneOn: 'Hiçbir hatırlatıcı kendiliğinden açılmaz; izin verdikten sonra istediğini Hatırlatıcılar ekranından açabilirsin.',
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
    /**
     * Sent with the update at the moment the app leaves under "Sor" (stopwatch, work block): true
     * from then on, also while the clock still runs (the simulator never showed the stale layout).
     */
    awayPending: (seconds: number) => `Uygulamadan çıktın · ${seconds} sn sonra mola sayılır`,
    /**
     * Shown once the app has been away longer than the tolerance under "Sor" (under "Çalışmaya devam
     * say": longer than its 3 hours): the clock stops there (the time away becomes a break unless the
     * student answers "Çalışıyordum").
     */
    away: 'Uygulamadan çıktın · mola sayılıyor',
    awayHint: 'Dönünce “Çalışıyordum” dersen süre eklenir.',
  },

  /** Home Screen widget (iOS). */
  widget: {
    today: 'Bugün',
    streak: (days: number) => `Seri: ${days} gün`,
    goal: (goal: string) => `Hedef ${goal}`,
    goalMet: 'Hedef tamam',
    running: 'Sayaç açık',
  },

  /** One-time card on the timer screen after the first Bitir (iOS); steps: guide.lockScreen.widgetSteps. */
  widgetTip: {
    title: 'Ana ekrana widget ekle',
    body: 'Widget bugünkü süreni, hedefini, serini ve sınavına kalan günü uygulamayı açmadan gösterir.',
    dismiss: 'Gösterme',
    dismissHint: 'Bu kart bir daha görünmez; adımlar “Nasıl çalışır”da da var.',
  },

  /**
   * "Yakında": the Groups tab of a 15+ profile while GROUPS_ENABLED is off (src/ui/groups-teaser.tsx).
   * What the module will do, never when: no date, no pressure, no "sosyal ağ / topluluk / arkadaş"
   * (K-09, K-13). About data only what is decided: Türkiye, and its own notice and consent later.
   */
  groupsTeaser: {
    badge: 'Yakında',
    title: 'Sessiz etüt odası',
    lead: 'Tanıdığın birkaç kişiyle aynı odada çalışıyormuş gibi: herkes kendi masasında, kimse kimseyi bölmeden.',
    features: {
      invite: {
        title: 'Davet koduyla küçük gruplar',
        body: 'Zaten tanıdığın kişilerle, yalnız davet koduyla kurulan en fazla 30 kişilik gruplar. Arama, liste ya da yabancı yok.',
      },
      live: {
        title: 'Şu an kim çalışıyor',
        body: 'Grubunda kimin şu an çalıştığını ve ne zamandır masada olduğunu görürsün. İstediğinde görünmez çalışırsın.',
      },
      weekly: {
        title: 'Haftalık grup özeti',
        body: 'Grubunda bu hafta ne kadar çalışıldığını sade bir özette görürsün.',
      },
      cheers: {
        title: 'Hazır tezahüratlar',
        body: 'Mesaj yazılmaz: tek dokunuşla “Hadi!” ya da “Başarılar” gönderirsin. Yalnız alan görür; istersen kapatırsın.',
      },
    },
    /** 15–17 only (the parent link is K-22, for 15–17). */
    parent: {
      kicker: 'Veliler için',
      title: 'Rahatsız etmeden bak',
      body: 'Yemek hazır olunca çağırmadan önce bir bak: velin, seni ders ortasında bölmemek için yalnız şu an ne durumda olduğunu görür.',
      sees: ['Çalışıyor, molada ya da şu an çalışmıyor; ne zamandan beri', 'Bugünkü toplam çalışma süren'],
      notSees: 'Konum, ekran ya da ayrıntılı geçmiş yok.',
      control:
        'Bunu sen açarsın; velinin ne gördüğünü sen de aynen görürsün ve istediğin an kapatırsın. Velin, senin ekranındaki veli koduyla bağlanır.',
    },
    teen: 'Gruplara 15–17 yaşta velinin onayıyla, veli koduyla katılırsın.',
    data: 'Grup bilgileri Türkiye’deki sunucumuzda tutulacak. Gruplar açıldığında ayrıca bilgilendirip onayını isteyeceğiz.',
    lgs: 'Gruplar YKS, KPSS ve diğer sınavlar için olacak. LGS profilinde sayaç ve denemeler gruplar olmadan tam çalışır.',
    notOpenTitle: 'Henüz açık değil',
    notOpenBody:
      'Bu sayfa yalnız bir ön izleme: şu an hiçbir bilgin toplanmıyor ve bir yere gönderilmiyor. Sayaç, denemeler ve tüm kişisel araçların gruplar olmadan da tam çalışır.',
  },

  groups: {
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
    /** Runs the backup export of the Yedek screen; deletes nothing. */
    deleteAllBackupFirst: 'Önce yedek al',
    deleteAllBackupDone: (exported: string) =>
      `${exported} Silmeden önce dosyayı bir yere kaydettiğinden emin ol; Etüt bunu kontrol edemez.`,
    deleteAllBackupCheckFailed:
      'Yedek dosyası doğrulanamadı, bu yüzden oluşturulmadı. Çalışma kayıtlarını “Yedekle ve geri yükle” ekranından CSV olarak dışa aktarabilirsin.',
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
    /** Under the disabled button when the card would show "0 dk". */
    nothingToShare: 'Paylaşmak için bu dönemde en az 1 dakika çalışmış olmalısın.',
    /** Name of the shared image (Istanbul day of sharing). */
    fileName: (day: string) => `etut-calisma-${day}.png`,
    cardDay: 'Bugünkü çalışmam',
    cardWeek: 'Bu haftaki çalışmam',
    total: 'Toplam çalışma',
    subjects: 'Ders dağılımı',
    /** On the card itself (it may be shared): a plain fact, no in-app call to action. */
    noStudy: 'Bu dönemde kayıtlı çalışma yok.',
    otherSubjects: 'Diğer dersler',
    streak: (days: number) => `Seri: ${days} gün`,
    goalDay: (percent: number) => (percent >= 100 ? 'Günlük hedef tamam' : `Günlük hedefin %${percent}${possessive(percent)}`),
    goalWeek: (days: number) => `Hedefi tutturduğun gün: ${days}/7`,
    activeDays: (days: number) => `Çalıştığın gün: ${days}/7`,
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
    /** An on/off button named by what it switches: `Görünmez ol: Kapalı`. */
    toggle: (label: string, state: string) => `${label}: ${state}`,
  },

  empty: {
    historyTitle: 'Henüz kayıtlı çalışma yok',
    historyBody: 'Sayaç sekmesinde bir ders seçip Başla’ya dokun; bitirdiğin her oturum burada günlere göre görünür.',
    examsTitle: 'Henüz deneme eklemedin',
    examsBody: 'Bir deneme çözdükten sonra “Deneme ekle” ile doğru ve yanlışlarını gir; netin hemen hesaplanır, grafikler burada oluşur.',
    /** Exam type "Diğer": no form, so no "Deneme ekle" to point at (the note above says why). */
    examsBodyNoForm: 'Denemelerin ve grafiklerin, deneme formu olan bir sınav türünde burada görünür.',
    topicsBody: 'Bir konuyu bitirdiğinde “Bitti”, yeniden bakman gerekiyorsa “Tekrar lazım” de. Sayaçta konu seçersen süresi de burada toplanır.',
    weeklyTitle: 'Bu hafta kayıtlı çalışma yok',
    weeklyBody: 'Haftanın her günü (Pazartesi–Pazar) çalıştığın süre burada toplanır. Önceki haftalara oklarla bakabilirsin.',
    startTimer: 'Sayaca git',
    addFirstExam: 'İlk denemeni ekle',
  },

  tips: {
    title: 'Kısa bir tur',
    steps: [
      {
        title: 'Ders seç, Başla’ya dokun',
        body: 'iPhone’da sayaç kilit ekranında da görünür. Bitir’e dokununca kısa bir özet çıkar; yanlışlıkla dokunduysan hemen “Geri al”.',
      },
      {
        title: 'Uygulamadan çıkarsan',
        /** "3 saat" = `AWAY_COUNT_MAX_MS` (education.test.tsx keeps them equal). */
        body: 'Telefonu kilitler ya da başka uygulamaya geçersen sayaç saymaya devam eder. 3 saatten uzun dışarıda kalırsan fazlası mola sayılır; dönünce “Çalışıyordum” deyip ekleyebilirsin. Mola verirken “Mola”ya dokun. Her çıkışın sorulmasını istersen Ayarlar → Sayaç çalışırken bölümünde “Sor”u seç.',
      },
      {
        title: 'Denemeler ve verilerin',
        body: 'Denemeler sekmesinde doğru ve yanlışlarını gir, net hemen hesaplanır. Her şey bu telefonda kalır; ara sıra Ayarlar’dan yedek al. Ayrıntılar: Ayarlar → Nasıl çalışır.',
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
    /** Hint of the goal line (and ring) on the "Bugün" card: a tap opens the goal sheet. */
    goalEditA11y: 'Günlük hedefi değiştir',
  },

  /** The short summary after "Bitir". */
  finish: {
    /** Small line above the saved time (the time itself is the big number). */
    savedTitle: 'Kaydedildi',
    studied: (subject: string) => `${subject} çalıştın`,
    studiedTopic: (subject: string, topic: string) => `${subject} · ${topic}`,
    goalStep: (before: number, after: number) => `Hedef: %${before} → %${after}`,
    /** Once, in the summary of the session that reached the daily goal: positive, no streak talk. */
    goalReached: finishGoalReached,
    /** After today's total on the summary's muted line: "Bugün 3 sa 5 dk · hedef 3 sa 0 dk". */
    todayGoal: (goal: string) => `· hedef ${goal}`,
    undo: 'Geri al',
    undoHint: 'Kaydı siler, sayaç kaldığı yerden devam eder.',
    /** "Geri al" after a topic chip below was tapped: the mark goes back too. */
    undoHintTopic: 'Kaydı siler ve konu işaretini eski hâline getirir; sayaç kaldığı yerden devam eder.',
    undone: 'Geri alındı. Sayaç kaldığı yerden devam ediyor.',
    /** "Bitti" / "Tekrar lazım" (topics.done / topics.review) for the session's topic. */
    topicMark: 'Konuyu işaretle (isteğe bağlı)',
    announce: (saved: string, today: string, goalReached: boolean) =>
      `${saved}. Bugün toplam ${today}.${goalReached ? ` ${finishGoalReached}.` : ''}`,
    /** The session started before midnight: it counts whole towards that day. */
    addedToYesterday: 'Dünün çalışmasına eklendi.',
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


  /** Ayarlar → "Sayaç çalışırken": screen kept on, what leaving the app means. */
  timerSettings: {
    title: 'Sayaç çalışırken',
    keepAwake: 'Ekranı açık tut',
    keepAwakeInfo:
      'Sayaç ekranı açıkken telefon kendiliğinden kilitlenmez; “Sor” seçiliyse süren böylece molaya dönmez. Pili biraz daha çok kullanır.',
    on: 'Açık',
    off: 'Kapalı',
    awayTitle: 'Uygulamadan çıkınca',
    awayAsk: 'Sor',
    awayCount: 'Çalışmaya devam say',
    awayAskInfo:
      '10 saniyeden uzun çıkarsan ya da telefon kilitlenirse o süre mola sayılır; dönünce “Çalışıyordum” diyerek ekleyebilirsin.',
    awayCountInfo: (hours: number) =>
      `Uygulamadan çıktığın ya da telefonu kilitlediğin süre ${hours} saate kadar çalışma sayılır; daha uzun kalırsan fazlası mola sayılır ve dönünce sorulur. Mola verirken “Mola”ya dokunmayı unutma.`,
  },

  /** Questions "Bitir" asks before saving. */
  finishCheck: {
    awayTitle: (duration: string) => `Bitirmeden önce: ${duration} uygulamanın dışındaydın.`,
    awayBody: 'Bu süre çalışma mıydı?',
    awayBodyStudy: (study: string) => `Çalışma bloklarına denk gelen ${study} çalışma mıydı?`,
    /** Rule "Çalışmaya devam say": only the time after its first `hours` is asked about. */
    awayTitleCapped: (hours: number) => `Bitirmeden önce: ${hours} saatten uzun uygulamanın dışındaydın.`,
    awayBodyCapped: (hours: number, rest: string) =>
      `İlk ${hours} saat sayaç saymaya devam etti. Sonraki ${rest} çalışma mıydı?`,
    awayBodyCappedStudy: (hours: number, study: string) =>
      `İlk ${hours} saat sayaç saymaya devam etti. Sonrasında çalışma bloklarına denk gelen ${study} çalışma mıydı?`,
    awayCredit: 'Çalışıyordum, ekle ve bitir',
    awayBreak: 'Molaydı, öyle bitir',
    longTitle: (duration: string) => `Bu oturum ${duration} sürmüş görünüyor.`,
    longBody:
      'Hepsinde çalıştın mı? Sayaç açık kaldıysa yalnız ilk 10 saati kaydedebilirsin. Yanlış bir kaydı sonra Geçmiş’ten silebilirsin.',
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
    /** A second "Değiştir" while the first one can still be undone: no new copy is taken. */
    replaceSureKeepsUndo: (sessions: number, exams: number, topics: number, when: string) =>
      `Emin misin? Bu telefondaki ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti silinip yerine yedektekiler gelecek. Yeni kopya alınmaz: “Geri al” verileri ilk “Değiştir”den önceki ana (${when}) döndürür.`,
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
    /** "Geri al" put back all but these (they no longer fit the exam tables): the copy is kept. */
    undonePartly: (sessions: number, exams: number, topics: number, lostExams: number, lostTargets: number) =>
      `Geri alındı. Şu an ${sessions} çalışma kaydı, ${exams} deneme ve ${topics} konu işareti var. Kopyadaki ${examsAndTargets(lostExams, lostTargets)} uygulamanın şimdiki sınav biçimine uymadığı için geri getirilemedi; kopya bu telefonda duruyor.`,
    /** "Değiştir" refused before anything changed: the copy for "Geri al" would not bring all back. */
    copyUnreadable:
      'Bu telefondaki veriler “Geri al” için eksiksiz kopyalanamadı, bu yüzden hiçbir şey değiştirilmedi. İstersen “Birleştir” ile yükleyebilirsin.',
    copyIncomplete: (exams: number, targets: number) =>
      `Bu telefondaki ${examsAndTargets(exams, targets)} uygulamanın şimdiki sınav biçimine (soru sayıları, dersler) uymuyor; “Geri al” bunları geri getiremeyeceği için hiçbir şey değiştirilmedi. İstersen “Birleştir” ile yükleyebilirsin.`,
    /** After "Yedek dosyası hazırlandı." */
    exportSkipped: (exams: number, targets: number) =>
      `Uygulamanın şimdiki sınav biçimine (soru sayıları, dersler) uymayan ${examsAndTargets(exams, targets)} geri yüklemede alınmayacak.`,
    undoDiscardSure: 'Emin misin? Kopya silinirse “Değiştir”den önceki veriler bir daha geri getirilemez.',
    undoDiscardYes: 'Evet, kopyayı sil',
  },

  /** Ayarlar → Yardım: the guide and the tips again. */
  help: {
    title: 'Yardım',
    info: 'Sayaç, net, seri ve yedek kısaca nasıl işliyor.',
    guide: 'Nasıl çalışır',
    showTips: 'Turu yeniden göster',
  },

  /** The (i) button next to a term; opens its section of "Nasıl çalışır". */
  infoLink: {
    a11y: (term: string) => `${term} nedir?`,
    estimated: '“Tahmini” tarih',
    manual: '“Elle” etiketi',
    streak: 'Seri',
    net: 'Net hesabı',
  },

  /** "Nasıl çalışır": short, plain explanations of the rules (each matches its domain module). */
  guide: {
    title: 'Nasıl çalışır',
    intro: 'Etüt’ün kuralları kısaca. Bir terimin yanındaki “i” simgesi seni buradaki ilgili bölüme getirir.',
    close: 'Kapat',
    timer: {
      title: 'Sayaç ve uzakta kuralı',
      paragraphs: (toleranceSeconds: number, undoSeconds: number, longHours: number, awayHours: number) => [
        'Ders seç, Başla’ya dokun. Süre, başladığın andan itibaren saate bakılarak hesaplanır; “Mola” (pomodoroda “Duraklat”) sayacı durdurur, “Devam” sürdürür.',
        `Ayarlar → Sayaç çalışırken → Uygulamadan çıkınca bölümünde “Çalışmaya devam say” seçiliyse (baştan böyledir) telefonu kilitlediğinde ya da başka uygulamaya geçtiğinde sayaç saymaya devam eder; mola verirken “Mola”ya dokunmayı unutma. ${awayHours} saatten uzun dışarıda kalırsan ilk ${awayHours} saatten sonrası mola sayılır. Dönünce “… uygulamanın dışındaydın” kartı çıkar: “Çalışıyordum, süreye ekle” dersen süre eklenir, “Tamam, mola kalsın” dersen eklenmez. Cevaplamadan Bitir’e dokunursan önce bu sorulur.`,
        `Aynı yerde “Sor” seçiliyse uygulamadan ${toleranceSeconds} saniyeden uzun çıkarsan ya da telefon kilitlenirse o süre baştan mola sayılır ve dönünce aynı kart çıkar. Pomodoro molasında uygulamadan çıkmak sorun değil: yalnız mola bittikten sonra kaçan çalışma süresi sorulur.`,
        'Uygulamayı tamamen kapatırsan sayaç kaybolmaz: yeniden açınca, uygulamanın kapandığı andan sonraki süre de “Uygulamadan çıkınca” ayarına göre sorulur ya da çalışma sayılır.',
        'Ayarlar’da “Ekranı açık tut”u açarsan sayaç ekranı açıkken telefon kendiliğinden kilitlenmez; “Sor” seçiliyse süren böylece molaya dönmez. Pili biraz daha çok kullanır.',
        `Bitir’e dokununca oturum kaydedilir ve kısa bir özet görürsün. Yanlışlıkla dokunduysan ${undoSeconds} saniye içinde “Geri al”: kayıt silinir, sayaç kaldığı yerden sürer. ${longHours} saati aşan bir oturumda hepsini mi yoksa ilk ${longHours} saati mi kaydedeceğin sorulur.`,
      ],
      /** iOS Focus: the app never turns it on itself; only how to set it up next to the timer. */
      focusTitle: 'iPhone’da Odak ile çalışmak',
      focus: [
        'Bildirimler dikkatini dağıtıyorsa iPhone’un Odak özelliğini kullanabilirsin. Etüt Odak’ı kendisi açıp kapatmaz; sayaç Odak açıkken de aynı çalışır.',
        '1. iPhone’un Ayarlar → Odak bölümünde “Rahatsız Etme”yi seç ya da “+” ile kendine yeni bir Odak oluştur.',
        '2. Bu Odak’ta bildirimlerine izin verilen uygulamalara Etüt’ü ekle; yoksa Odak açıkken pomodoro ve hatırlatıcı bildirimlerin de sessize alınır.',
        '3. Çalışmaya başlarken Odak’ı Denetim Merkezi’nden aç, bitirince kapat.',
        'Odak açıkken de başka bir uygulamaya (ör. ders videosu ya da PDF için) geçersen o süre yukarıdaki uzakta kuralına girer.',
      ],
    },
    pomodoro: {
      title: 'Pomodoro',
      paragraphs: (work: number, short: number, long: number, every: number) => [
        `Sayaç türünü “Pomodoro” seçersen sayaç geri sayar. Varsayılan: ${work} dk çalışma, ${short} dk kısa mola, her ${every} turda bir ${long} dk uzun mola. Süreleri Ayarlar → Pomodoro’dan değiştirebilirsin.`,
        'Mola süresi çalışma süresine sayılmaz. Molayı kısaltmak istersen “Molayı geç”e dokun. Uygulama açıkken bir aşama bitince telefon kısa titrer; Hatırlatıcılar’ı açtıysan uygulama kapalıyken bildirim gelir.',
      ],
    },
    manual: {
      title: '“Elle” etiketi',
      paragraphs: (days: number, maxHours: number) => [
        `Sayacı açmayı unuttuysan çalıştığın süreyi sonradan Sayaç → Elle ekle ile girebilirsin: yalnız son ${days} gün için, tek kayıt en fazla ${maxHours} saat, başka bir kayıtla çakışmadan.`,
        'Böyle eklenen süreler geçmişte, haftalık özette ve tablolarda “elle” etiketiyle görünür; hangi sürenin sayaçla, hangisinin sonradan girildiğini hep ayırt edebilirsin. Toplamlara, günlük hedefe ve seriye sayılır.',
        'Yanlış girdiysen Elle ekle ekranındaki listeden silebilirsin.',
      ],
    },
    net: {
      title: 'Deneme ve net',
      intro: 'Net, doğru sayından yanlışların götürdüğü kısım çıkarılarak bulunur. Boş bıraktığın soru neti etkilemez.',
      rule: (exam: string, rule: string) => `${exam}: ${rule}`,
      yks: 'YKS (TYT, AYT, YDT)',
      kpss: 'KPSS Genel Yetenek–Genel Kültür',
      lgs: 'LGS',
      example: (correct: number, wrong: number, perCorrect: number, result: string) =>
        `Örnek: ${correct} doğru, ${wrong} yanlış → ${correct} − ${wrong} ÷ ${perCorrect} = ${result} net.`,
      more: [
        'Genel deneme sınavın bütün derslerini, branş denemesi tek bir dersi kapsar. Kaydettiğin bir denemeyi sonradan “Düzenle” ile değiştirebilirsin.',
        'Sınav türün “Diğer” ise deneme formu yoktur; Ayarlar’dan YKS, LGS ya da KPSS seçebilirsin.',
      ],
    },
    analysis: {
      title: 'Analiz ve “tekrar lazım”',
      paragraphs: (targetWindow: number, missedWindow: number) => [
        'Deneme analizi iki adımlı: önce netini kaydedersin, kitapçık ya da cevap anahtarı gelince yanlış ve boş soruların hangi konulardan olduğunu işaretlersin. Her derste Yanlış ya da Boş’u seçip konuya dokunursun; her dokunuş 1 ekler. Hepsini işaretlemek zorunda değilsin.',
        `İşaretledikçe “En çok yanlış yaptığın 5 konu” listesi oluşur; liste konu işaretlediğin son ${missedWindow} denemeye bakar, daha eski denemelerdeki yanlışlar sayılmaz. Oradan bir konuya “Tekrar lazım” diyebilir, “Çalış” ile o konuda sayacı başlatabilirsin; altında o denemeden beri o konuya ne kadar çalıştığın yazar.`,
        'Konular ekranında bitirdiğin konuyu “Bitti”, yeniden bakman gerekeni “Tekrar lazım” diye işaretlersin. Sayaçta konu seçersen o konuya ayırdığın süre de orada toplanır.',
        `Bir ders için hedef net koyarsan son ${targetWindow} denemenin ortalamasıyla kıyaslanır.`,
      ],
    },
    goal: {
      title: 'Günlük hedef',
      paragraphs: (minMinutes: number, maxHours: number) => [
        `Günlük hedefi istersen koyarsın: ${minMinutes} dakika ile ${maxHours} saat arasında. Sayaç ekranındaki halka bugünkü sürenin hedefe oranını gösterir; halkaya ya da altındaki hedef satırına dokunarak hedefi değiştirebilirsin. Elle eklediğin süre de sayılır.`,
        'Hedefi değiştirirsen yeni hedef bugünden itibaren geçerli olur; önceki her gün, o gün geçerli olan hedefle sayılır. Böylece hedefini yükseltmek serini bozmaz. Hedefi kapatırsan seri gösterilmez.',
      ],
    },
    streak: {
      title: 'Seri ve dinlenme günü',
      paragraphs: [
        'Seri, günlük hedefini tutturduğun art arda günlerin sayısıdır. Gün, Türkiye saatiyle gece yarısı değişir.',
        'Bugün henüz bitmedi: hedefin altında olman seriyi bozmaz, seri dünden geriye sayılır. Bugün hedefi tutturunca bugün de eklenir.',
        'Her hafta (Pazartesi–Pazar) 1 gün hedefin altında kalabilirsin: o gün dinlenme günü sayılır, seriyi bozmaz ama seriye de eklenmez. Aynı hafta içinde ikinci bir gün hedefin altında kalırsan seri biter.',
        'Bu haftaki dinlenme gününü kullanıp kullanmadığını haftalık özette görürsün.',
      ],
    },
    examDate: {
      title: '“Tahmini” sınav tarihi',
      paragraphs: [
        'ÖSYM ya da MEB sınav takvimini henüz açıklamadıysa geri sayım, önceki yılların düzenine göre tahmin ettiğimiz tarihe göre yapılır; yanında “tahmini” yazar. Tahmini ya da resmî tarih geçince geri sayım kendiliğinden bir sonraki sınava geçer.',
        'Kesin tarihi biliyorsan ya da başka bir oturuma giriyorsan Ayarlar → Sınav tarihi’nden kendin gir; “tahmini” etiketi kalkar. Girdiğin tarihi aynı karttaki düğmeyle geri alabilirsin.',
      ],
    },
    lockScreen: {
      title: 'Kilit ekranı sayacı ve widget',
      paragraphs: (maxHours: number, awayHours: number) => [
        'iPhone’da Başla’ya dokununca sayaç kilit ekranında ve Dynamic Island’da da görünür. Görmüyorsan iPhone’un Ayarlar → Etüt → Canlı Etkinlikler seçeneğini aç.',
        `“Çalışmaya devam say” seçiliyken uygulamadan çıkınca ya da telefon kilitlenince kilit ekranındaki sayaç saymaya devam eder; kronometre ${awayHours} saat dolunca durur, çünkü sonrası mola sayılır. “Sor” seçiliyken kilit ekranındaki sayaçta hemen “Uygulamadan çıktın” yazar: 10 saniye içinde dönmezsen o süre mola sayılır. İki durumda da dönünce “Çalışıyordum” dersen süre eklenir.`,
        `iOS bir canlı sayacı en fazla ${maxHours} saat gösterir; uzun bir oturumda uygulamayı açınca yenilenir.`,
      ],
      widgetTitle: 'Ana ekrana widget eklemek',
      widgetSteps: [
        '1. Ana ekranda boş bir yere basılı tut.',
        '2. Sol üstteki “Düzenle”ye (ya da “+”ya) dokun, “Widget Ekle”yi seç.',
        '3. Listeden Etüt’ü bul, küçük ya da orta boyutu seçip “Widget Ekle”ye dokun.',
      ],
      lockWidget:
        'Kilit ekranına eklemek için kilit ekranına basılı tut, “Özelleştir” → “Kilitli Ekran”a dokun, saatin altındaki alana dokunup Etüt’ü seç.',
      widgetInfo: (awayHours: number) =>
        `Widget bugünkü çalışma süreni, günlük hedefini, serini ve sınavına kalan gün sayısını gösterir; sayaç açıkken süre orada da ilerler. Uygulamadan çıkınca süre “Sor” seçiliyse hemen, “Çalışmaya devam say” seçiliyse ${awayHours} saat sonra durur. Kilit ekranındaki widget’ı telefonu eline alan herkes görebilir.`,
    },
    backup: {
      title: 'Yedek',
      paragraphs: (minDays: number, afterDays: number, snoozeDays: number) => [
        'Etüt’ün sunucusu yok: verilerin yalnız bu telefonda (iPhone’un iCloud yedeği açıksa o yedekte de). Uygulamayı silersen ya da telefonu değiştirirsen yedek dosyası olmadan geri getiremeyebilirsin.',
        'Ayarlar → Yedekle ve geri yükle → “Yedek dosyası oluştur” tek bir dosya hazırlar; onu Dosyalar’a, iCloud Drive’a ya da güvendiğin başka bir yere kaydet. Dosya şifrelenmez.',
        'Yeni telefonda “Yedekten geri yükle” ile dosyayı seç. “Birleştir” iki taraftaki kayıtları birleştirir, “Değiştir” buradakileri silip yedektekileri koyar.',
        `En az ${minDays} gün çalıştıysan ve ${afterDays} gündür yedek almadıysan Sayaç ekranında küçük bir hatırlatma çıkar. Bildirim gelmez; “Şimdi değil” dersen ${snoozeDays} gün görünmez.`,
      ],
    },
  },

  /** "Son yedek" line and the quiet reminder card on the timer screen (no notification, K-34). */
  backupReminder: {
    never: 'Hiç yedek alınmadı',
    last: (days: number, date: string) =>
      days === 0 ? 'Son yedek: bugün' : days === 1 ? 'Son yedek: dün' : `Son yedek: ${days} gün önce (${date})`,
    lastNote:
      'Yedek dosyasını en son oluşturduğun zaman. Dosyayı nereye kaydettiğini Etüt bilemez; kaydettiğinden emin ol.',
    cardTitle: (days: number | null) => (days === null ? 'Henüz yedek almadın' : `Son yedeğin ${days} gün önce`),
    cardBody:
      'Verilerin bu telefonda; Etüt’ün sunucusu yok. Telefonu değiştirir ya da uygulamayı silersen, telefonunun kendi yedeği yoksa yedek dosyası olmadan geri getiremeyebilirsin.',
    open: 'Yedek al',
    dismiss: 'Şimdi değil',
    dismissHint: (days: number) => `Bu hatırlatma ${days} gün görünmez.`,
  },

  /** Hakkında → İletişim (e-mail with the app and OS version in the subject, nothing else). */
  contact: {
    title: 'İletişim',
    info: 'Soru, hata, öneri ya da KVKK başvurun için bize e-posta gönderebilirsin. Konu satırına yalnız uygulama ve işletim sistemi sürümü eklenir. E-posta adresin, e-posta uygulamanın gönderen olarak gösterdiği ad, yazdıkların ve eklediğin dosyalar bize ulaşır; e-postalarımız Gmail’de, yani Google’ın yurt dışındaki sunucularında durur. Ayrıntılar “Aydınlatma metni”nde.',
    send: 'E-posta gönder',
    soon: 'E-posta · Yakında',
    soonInfo: 'İletişim adresi yayından önce eklenecek.',
    subject: (version: string, build: string, os: string) => `Etüt geri bildirim · sürüm ${version} (${build}) · ${os}`,
    failed: (address: string) => `E-posta uygulaması açılamadı. Adresimiz: ${address}`,
    /** Ayarlar → the same e-mail, one tap away (X-7). */
    feedbackTitle: 'Geri bildirim',
    feedback: 'Geri bildirim gönder',
    feedbackSoon: 'Geri bildirim · Yakında',
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
    titleFor: (subject: string) => `${subject} karnesi`,
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
    /** The subject has no test of its own in the exam form (Eğitim Bilimleri, Diğer…). */
    examsNoSection: 'Bu dersin deneme formunda ayrı bir testi yok.',
    /** The exam type has no exam form at all ("Diğer"). */
    examsNoForm: 'Bu sınav için deneme formu yok; deneme netleri burada görünmez.',
    sectionTitle: (paper: string, section: string) => `${paper} · ${section}`,
    geometryNote: 'Geometri soruları Matematik testinin içinde; netler o testten.',
    missedTitle: 'En çok yanlış yaptığın konular',
    missedEmpty: 'Deneme analizinde bu dersten henüz konu işaretlemedin.',
    /** `MISSED_WINDOW`, counted over the exams in which a topic of this subject was marked. */
    missedWindow: (window: number) => `Bu dersten konu işaretlediğin son ${window} denemeye göre.`,
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
    /** Screen-reader names of the ‹ › buttons around the month. */
    prev: 'Önceki ay',
    next: 'Sonraki ay',
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
    /** The exam day by the built-in estimate, worded as on the timer's card (`countdown.todayEstimated`). */
    todayEstimated: 'Tahmini sınav günü bugün',
  },
} as const;
