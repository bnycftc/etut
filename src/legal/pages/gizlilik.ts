/**
 * Privacy policy, group version: the App Store "Privacy Policy URL" (source: docs/hukuk/kvkk/04,
 * corrected to the code). The device part follows legalDocs.gizlilik in src/strings.ts.
 */

import { AFTER_DELETION, C, HOW_TO_DELETE, LEGAL_PAGES_UPDATED, type LegalPage, MAILBOX_IN_TURKEY } from './_shared';

export const page: LegalPage = {
  slug: 'gizlilik',
  title: 'Gizlilik politikası',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Gizlilik politikası', order: 2 },
  intro: [
    `Etüt, sınava hazırlanan öğrenciler için bir çalışma sayacı, deneme takibi ve isteğe bağlı, davetle kurulan küçük çalışma grupları uygulamasıdır. Geliştirici ve veri sorumlusu: ${C.name} · ${C.contact}. Bu politika hangi bilgilerin nerede tutulduğunu, kimin gördüğünü, ne kadar saklandığını ve senin neleri kontrol edebileceğini anlatır.`,
  ],
  sections: [
    {
      heading: '1. Kısaca',
      blocks: [
        {
          list: [
            'Reklam, analitik, çökme raporu ve izleme yok. Reklam kimliği ve uygulamalar arası takip (ATT) yok.',
            'Grupları açmazsan hiçbir bilgin telefonundan çıkmaz.',
            'Grupları açarsan takma adın, yaş bandın ve çalışma sürelerin Türkiye’deki sunucumuzda tutulur; hiçbir bilgin yurt dışına gönderilmez.',
            'Adın, doğum yılın, e-postan, telefonun, okulun, konumun, rehberin, fotoğrafların ve deneme netlerin sunucuya gitmez.',
            '15 yaşından küçükler uygulamayı yalnız cihaz modunda kullanır.',
            'Grup hesabını istediğin an uygulamadan silebilirsin; silme hemen olur.',
          ],
        },
      ],
    },
    {
      heading: '2. Telefonunda tutulanlar',
      blocks: [
        'Doğum yılı (yaş kuralı için), sınav türü ve alan (ders ve konu listesi için), çalışma oturumları (ders, konu, zamanlar, molalar ve uygulama dışında geçen süreler, “elle” bilgisi, istersen girdiğin çözülen soru sayısı), konu ilerlemesi, deneme netleri ve analizleri, günlük ve haftalık hedefler, hedef netler, sınav tarihi, sayaç ve hatırlatıcı ayarları. Grupları açtıysan ayrıca grup hesabının giriş anahtarı ve sunucuya gönderilmeyi bekleyen oturumlar.',
        'iPhone’da uygulama, widget gösterebilsin diye bugünkü süre, hedef, seri ve sınavına kalan gün bilgisini widget’ın okuyabildiği ortak bir alanda yine bu telefonda tutar. Sayaç açıkken kilit ekranında ve Dynamic Island’da ders ve konu adı görünür.',
        'Telefonunun kendi yedeği (iCloud ya da bilgisayara yedekleme) açıksa iOS uygulama verilerini de bu yedeğe katar; bu yedek senin Apple hesabında ya da bilgisayarında durur, bize gelmez. Yedek dosyası, CSV ya da çalışma kartı yalnız sen dokunduğunda, telefonunun paylaşım ekranıyla dışarı çıkar.',
      ],
    },
    {
      heading: '3. Sunucuda tutulanlar (yalnız grupları açarsan)',
      blocks: [
        {
          table: {
            head: ['Bilgi', 'Nasıl toplanır?', 'Ne için?'],
            rows: [
              ['Takma ad', 'Sen yazarsın', 'Grupta görünmek'],
              ['Yaş bandı (15–17 ya da 18+) ve bildirildiği yıl; doğum yılı gönderilmez', 'Doğum yılından telefonunda hesaplanır', 'Yaş sınırı, 15–17 için veli bağlantısı'],
              ['Rastgele hesap numarası, oturum anahtarları, son kullanım günü (e-posta ve telefon yok)', 'Otomatik', 'Grup hesabının çalışması, kullanılmayan hesabın silinmesi'],
              ['Grup üyelikleri, katılma istekleri, grup ayarların', 'Sen katıldıkça ve seçtikçe', 'Grupların çalışması'],
              ['Canlı durum (çalışıyor mu, molada mı, hangi ders, ne zamandır)', 'Sayaç açıkken, yalnız bir gruptaysan', 'Grubunda “şu an çalışıyor” göstermek'],
              ['Çalışma oturumları (başlangıç, bitiş, süre, sayaç mı “elle” mi) ve günlük toplamlar; ders ve konu yok', 'Sayacı kullandıkça; yalnız bir grupta, bekleyen bir istekte ya da bağlı velin varken saklanır', 'Grup sıralaması, veliye haftalık süre'],
              ['Hazır tepkiler', 'Sen gönderince ve sana gönderilince', 'Tepkiyi iletmek, sınır koymak'],
              ['Bildirimler (raporlar) ve engellemeler', 'Sen ya da başkası bildirince, engelleyince', 'Kullanım şartlarını uygulamak'],
              ['Veli bağlantısı ve velinin kilitleri (yalnız 15–17)', 'Kodu sen oluşturup velin girince', 'Veli gözetimi'],
              ['Güvenlik kayıtları: işlem, zaman, hesap numarası, IP adresi; sunucu erişim kaydı', 'Sunucuya her bağlantıda, otomatik', 'Güvenlik, kötüye kullanımı önlemek, yasal talepler'],
              ['Bize yazdıkların', 'Sen yazarsın', 'Cevap vermek, başvuruyu sonuçlandırmak'],
            ],
          },
        },
        'Sınav türün ve alanın grup hesabı açılırken yalnız denetlenir (LGS profiliyle grup açılmaz), saklanmaz. Uygulama Apple ya da Google hesabıyla giriş kullanmaz; grup hesabı anonimdir.',
      ],
    },
    {
      heading: '4. Kimler görür?',
      blocks: [
        {
          list: [
            'Grubundaki üyeler: takma adın; görünmez çalışmıyorsan o an çalıştığın ders ve ne zamandır çalıştığın; günlük ve haftalık süren ve sıralaman. Yaşın ya da yaş bandın hiçbir yerde gösterilmez.',
            'Katılmak istediğin grubun kurucusu: takma adın.',
            'Bağladığın veli (yalnız 15–17): takma adın ve son 7 günün günlük toplam çalışma süresi. Bağlantıyı Gruplar ekranından kaldırabilirsin; velin bunu görür.',
            'Türkiye’deki barındırma ve yedekleme sağlayıcılarımız, yalnız bizim adımıza ve talimatımızla saklar.',
            'Kamu makamları: yalnız kanunen zorunlu olduğunda.',
          ],
        },
        `Bilgilerini satmayız, kiralamayız, reklam amacıyla paylaşmayız. Uygulama Türkiye’deki sunucumuz dışında hiçbir sunucuya bağlanmaz. ${MAILBOX_IN_TURKEY}`,
      ],
    },
    {
      heading: '5. İzinler',
      blocks: [
        'Uygulama konum, kamera, mikrofon, fotoğraf okuma, rehber ya da takip (ATT) izni istemez. Grup özelliği yeni bir izin istemez ve anlık bildirim (push) kullanmaz.',
        'Bildirim iznini yalnız Ayarlar → Hatırlatıcılar’dan bir hatırlatıcıyı açtığında sorar. Hatırlatıcılar telefonunda kurulur ve gösterilir; bunun için bize hiçbir şey gitmez.',
        'Çalışma kartını paylaşım ekranından “Görüntüyü Kaydet” ile Fotoğraflar’a eklemek istersen iOS yalnız ekleme izni sorar; Etüt fotoğraflarını göremez.',
      ],
    },
    {
      heading: '6. Saklama ve silme',
      blocks: [
        {
          list: [
            'Telefonundaki veriler sen silene kadar kalır. Ayarlar → Tüm verileri sil ya da uygulamayı kaldırmak telefondakilerin hepsini siler. 15 yaş altı beyanında yalnız beyan edilen doğum yılı, yaş kuralı gereği 15 yaşına gelinceye kadar telefonda ayrıca saklanır.',
            'Grup hesabı açık olduğu sürece saklanır; 6 ay hiç kullanılmazsa kendiliğinden silinir.',
            HOW_TO_DELETE,
          ],
        },
        'Grup hesabını silince takma adın, grup üyeliklerin, çalışma sürelerin, tepkilerin, engellemelerin ve veli bağlantın sunucudan hemen silinir. Kurduğun bir grupta başka üye varsa kuruculuk en eski üyeye geçer; tek kişi kaldıysan grup silinir. Hemen silinmeyenler:',
        { list: AFTER_DELETION },
        'Bütün süreler: [Saklama ve imha politikası](saklama).',
      ],
    },
    {
      heading: '7. Çocuklar ve gençler',
      blocks: [
        {
          list: [
            'Etüt çocuklara özel bir uygulama değildir ve App Store’da Çocuklar kategorisinde yer almaz.',
            '15 yaşından küçükler uygulamayı yalnız cihaz modunda kullanır: grup hesabı açılmaz, gruplar görünmez ve hiçbir bilgi telefondan çıkmaz. 15 yaşından küçükler için çalışma kartı da kapalıdır ve uygulama App Store puanlama penceresini istemez.',
            '15–17 yaşındakiler gruplara yalnız davet koduyla ve kurucunun onayıyla girer. Sohbet, özel mesaj, herkese açık profil ve kullanıcı arama yoktur. Veli, kendi telefonundaki veli moduyla grup ayarlarını kilitleyebilir.',
            `15 yaşından küçük birinin grup hesabı açtığını öğrenirsek hesabı sileriz. Bize ${C.contact} adresinden bildirebilirsin.`,
          ],
        },
        'Ayrıntılar: [Çocuk güvenliği ve yaş politikası](cocuk-guvenligi) · [Velilere](veli).',
      ],
    },
    {
      heading: '8. Güvenlik',
      blocks: [
        'Telefondaki veriler telefonunun kendi korumasıyla (ekran kilidi, cihaz şifrelemesi) korunur. Yedek dosyası şifrelenmez: güvendiğin bir yerde sakla. Uygulama ile sunucu arasındaki bağlantı şifrelidir; uygulama sunucudaki tablolara doğrudan erişemez, yalnız tanımlı işlemleri çağırır. Sunucu yedekleri şifrelidir. Bir veri ihlali olursa Kişisel Verileri Koruma Kurulu’na 72 saat içinde bildiririz.',
      ],
    },
    {
      heading: '9. Hakların',
      blocks: [
        'Bilgilerini öğrenebilir, düzelttirebilir, sildirebilir, kimlere aktarıldığını öğrenebilir ve itiraz edebilirsin. KVKK m.11’deki haklarının hepsi ve başvuru yolu: [Aydınlatma metni](aydinlatma). Başvurularına en geç 30 gün içinde ücretsiz ve yazılı cevap veririz.',
      ],
    },
    {
      heading: '10. Değişiklikler',
      blocks: [
        'Bu politikayı güncellersek üstteki tarihi değiştiririz. Yeni bir veri, yeni bir amaç ya da yeni bir alıcı gibi önemli değişiklikleri yürürlükten önce haber veririz. Eski sürümler: [Eski sürümler](gizlilik/arsiv).',
      ],
    },
    {
      heading: '11. İletişim',
      blocks: [`${C.name} · ${C.contact} · [İletişim](iletisim)`],
    },
    {
      heading: 'English summary',
      blocks: [
        'Etüt is a study timer and mock-exam tracker with optional small, invite-only study groups, published in Türkiye by an individual developer. Without groups nothing leaves the device. With groups, the server in Türkiye holds a nickname, an age band (15–17 or 18+, never the birth year), group memberships, the live “studying now” status, study session times (no subject or topic), preset reactions, reports and blocks, an optional parent link (15–17), and security logs with the IP address (395 days). Mock-exam scores stay on the device. The account is anonymous: no e-mail, phone, Sign in with Apple or Google. No ads, analytics, crash reporting, push notifications or tracking; nothing is sent abroad. Users under 15 can use the on-device mode only. The group account is deleted at once in the app (Gruplar → Grup hesabı → Grup hesabımı sil) and after 6 months without use.',
      ],
    },
  ],
};
