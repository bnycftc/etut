/**
 * The device-only legal texts dated 18 Ekim 2026, frozen: a copy of
 * `legalDocs` from src/strings.ts at that date, word for word. The app's texts moved on
 * (LEGAL_UPDATED 31 Ekim 2026); this version stays in the archive unchanged
 * (src/legal/pages/gizlilik-arsiv.ts). Never edit it.
 */

import { DATA_CONTROLLER, type LegalDoc } from '../../strings';

const C = DATA_CONTROLLER;

const BACKUP_CONTENTS =
  'Yedek dosyasında doğum yılın, sınav türün ve alanın, tüm çalışma kayıtların (soru sayıları dahil), deneme netlerin ve analizlerin, konu işaretlerin, günlük hedefin (ve hangi gün kaça değiştirdiğin), derslere koyduğun haftalık hedefler, hedef netlerin, sınav tarihlerin, sayacı en son başlattığın ders, sayaç türün ve pomodoro ayarların, bir de dosyanın oluşturulduğu zaman ve uygulama sürümü bulunur. CSV dosyaları çalışma kayıtlarını (girdiysen soru sayısıyla) ve denemeleri içerir.';

const legal = {
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
          'Doğum yılın (yalnız yıl), sınav türün ve alanın; çalışma oturumların (ders, konu, başlangıç ve bitiş zamanı, molalar ve uygulamadan çıktığın süreler, “elle” bilgisi, istersen girdiğin çözülen soru sayısı); konu ilerlemen; deneme netlerin ve analizlerin; günlük hedefin ve hedefini hangi gün kaça değiştirdiğin, derslere koyduğun haftalık hedefler, hedef netlerin ve sınav tarihin; sayaç ayarların (pomodoro, ekranı açık tutma, uygulamadan çıkınca ne olacağı), hatırlatıcı tercihlerin, en son ne zaman yedek dosyası oluşturduğun, yedek hatırlatmasını ne zaman kapattığın ve uygulamanın App Store puanlama penceresini en son ne zaman istediği.',
          'Bu bilgiler, uygulamayı kullanırken senin girdiklerinden ve sayacın tuttuğu zamanlardan oluşur; uygulama onları otomatik olarak bu telefona kaydeder. Bize e-postayla yazarsan yazdıkların bize otomatik olmayan yolla ulaşır.',
          'Uygulamanın hiç sormadıkları ve kaydetmedikleri: adın, e-postan, telefon numaran, okulun, konumun, fotoğrafların, rehberin, reklam kimliğin.',
        ],
      },
      {
        heading: 'Ne için?',
        paragraphs: [
          'Sayacı çalıştırmak, sana kendi istatistiklerini göstermek ve yaşına uygun ayarları açmak için.',
        ],
      },
      {
        heading: 'Nerede duruyor, kim görüyor?',
        paragraphs: [
          'Bu telefonda. Uygulamanın sunucusu ve hesabı yok; uygulama internete bağlanmaz. Uygulama hiçbir bilgini kendiliğinden bize ya da başka bir şirkete göndermez; bize yalnız senin e-postayla göndermeyi seçtiğin şey ulaşır.',
          'Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS uygulama verilerini de bu yedeğe katar. Bu yedek senin Apple hesabında ya da bilgisayarında durur; bize gelmez.',
          `Yedek dosyası, CSV ya da çalışma kartı oluşturup paylaşırsan dosyanın nereye gideceğine sen karar verirsin. ${BACKUP_CONTENTS}`,
          'Hakkında → İletişim’den ya da Ayarlar → Geri bildirim gönder’den bize e-posta gönderirsen e-posta adresin, e-posta uygulamanın gönderen olarak gösterdiği ad (hesabında kayıtlıysa), yazdıkların, eklediğin dosyalar ve konu satırındaki uygulama ve işletim sistemi sürümü bize ulaşır. Bunları yalnız sana cevap vermek ve KVKK başvurunu sonuçlandırmak için kullanırız; başka bir amaçla kullanmaz, kimseyle paylaşmayız.',
          'E-posta adresimiz Gmail’de. Bu yüzden bize yazdığın e-posta, Google’ın (Google LLC, ABD) Türkiye dışındaki sunucularında saklanır; bu, KVKK m.9 kapsamında yurt dışına aktarımdır. Bu aktarım yalnız sen bize e-postayla yazmayı seçersen olur ve Google’ın kendi güvenlik önlemleriyle korunur.',
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
          'Uygulamanın bu telefonda tuttuğu bilgiler, uygulamayı senin isteğinle kullanabilmen için gereklidir (KVKK m.5/2-c, sözleşmenin kurulması ve ifası). Bize e-posta yazarsan yazışma, sorununu çözmek için yine m.5/2-c’ye; KVKK başvurusuysa cevap verme yükümlülüğümüze (m.5/2-ç, KVKK m.13) dayanır. E-postanın Google’ın yurt dışındaki sunucularında durması, bize e-postayla yazmayı senin seçmene dayanır (KVKK m.9). Uygulamada reklam, analitik, çökme raporu ve izleme yoktur.',
        ],
      },
      {
        heading: 'Hakların',
        paragraphs: [
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
          'Doğum yılı (yaş kuralı için), sınav türü ve alan (ders ve konu listesi için), çalışma oturumları (ders, konu, zamanlar, molalar ve uygulama dışında geçen süreler, “elle” bilgisi, istersen girdiğin çözülen soru sayısı), konu ilerlemesi, deneme netleri ve analizleri, günlük hedef ve hedefin değiştirildiği günler ile değerleri, derslere koyduğun haftalık hedefler, hedef netler, sınav tarihi, pomodoro ve sayaç ayarları (ekranı açık tutma, uygulamadan çıkınca ne olacağı), hatırlatıcı tercihleri, son yedek dosyasının oluşturulma zamanı, yedek hatırlatmasının kapatıldığı zaman ve App Store puanlama penceresinin en son istendiği zaman.',
          'Yedekten “Değiştir” ile yükleme yaparsan, geri alabilmen için önceki verilerinin bir kopyası bir gün boyunca bu telefonda kalır (5. bölüm).',
          'iPhone’da uygulama, widget gösterebilsin diye bugünkü süre, hedef, seri ve sınavına kalan gün bilgisini, widget eklemesen de, widget’ın okuyabildiği ortak bir alanda yine bu telefonda tutar. Sayaç açıkken kilit ekranında ve Dynamic Island’da ders ve konu adı görünür.',
          'Uygulama ad, e-posta, telefon, okul, konum, rehber, fotoğraf ve reklam kimliği hiç sormaz ve toplamaz.',
        ],
      },
      {
        heading: '3. Paylaşım',
        paragraphs: [
          'Uygulama hiçbir bilgini kendiliğinden bize göndermez; bize yalnız kendin yazmayı seçtiğin e-postalar ulaşır. Onları yalnız sana cevap vermek ve KVKK başvurunu sonuçlandırmak için kullanırız. Hiçbir bilgiyi satmayız, reklam ya da başka bir amaçla kimseyle paylaşmayız.',
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

export const FROZEN_2026_10_18 = { dir: 'gizlilik/arsiv/2026-10-18', updated: '18 Ekim 2026', legal } as const;
