/**
 * KVKK m.10 privacy notice, group version (source: docs/hukuk/kvkk/01, corrected to the code).
 * Server facts: supabase/migrations (app.*, audit.*, purge_expired), src/sync/api.ts.
 */

import { AFTER_DELETION, C, HOW_TO_APPLY, HOW_TO_DELETE, KVKK_RIGHTS, LEGAL_PAGES_UPDATED, type LegalPage, MAILBOX_IN_TURKEY } from './_shared';

export const page: LegalPage = {
  slug: 'aydinlatma',
  title: 'Aydınlatma metni',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Aydınlatma metni', order: 1 },
  intro: [
    'Bu metin, Etüt’ü kullandığında hangi bilgilerinin hangi amaçla ve hangi hukuki sebeple işlendiğini, kimlere aktarıldığını, ne kadar saklandığını ve haklarını anlatır. 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (KVKK) 10. maddesi gereği hazırlandı.',
  ],
  sections: [
    {
      heading: 'Kim sorumlu?',
      blocks: [
        `Etüt’ü ${C.name} tek başına geliştiriyor ve işletiyor; KVKK’ya göre veri sorumlusu odur. Şirket değil, gerçek kişidir. Bu metinde “biz” diye geçer.`,
        `İletişim: ${C.contact} ya da uygulamada Hakkında → İletişim. Ayrıntılar: [İletişim](iletisim).`,
      ],
    },
    {
      heading: 'Bu metin kimin için?',
      blocks: [
        {
          list: [
            'Grupları açmazsan (cihaz modu): kayıtların yalnız telefonunda kalır; uygulama hiçbir bilgini bize ya da başka birine göndermez.',
            '15 yaşından küçüksen uygulamayı yalnız cihaz modunda kullanırsın: grup hesabı açılmaz, grup özellikleri görünmez ve hiçbir bilgin telefondan çıkmaz.',
            'Grupları açarsan (15 yaş ve üstü): aşağıda yazan bilgiler ayrıca Türkiye’deki sunucumuzda işlenir.',
            '15–17 yaşındaysan velin için kısa bir sayfa var: [Velilere](veli).',
          ],
        },
      ],
    },
    {
      heading: 'Telefonunda kalanlar',
      blocks: [
        'Doğum yılın, sınav türün ve alanın, çalışma oturumlarının ders ve konu bilgisi, denemelerin ve netlerin, konu ilerlemen, hedeflerin, sınav tarihlerin ve ayarların yalnız telefonunda tutulur; grupları açsan da sunucuya gönderilmez. Grupları açtıysan telefonunda ayrıca grup hesabının giriş anahtarı ve sunucuya gönderilmeyi bekleyen oturumlar durur.',
        'Telefonunda tutulanların tam listesi: [Gizlilik politikası](gizlilik).',
      ],
    },
    {
      heading: 'Grupları açarsan sunucuda işlenenler',
      blocks: [
        {
          table: {
            head: ['Bilgi', 'Ne için?', 'Hukuki sebep (KVKK)'],
            rows: [
              [
                'Takma ad (senin seçtiğin, 3–20 karakter)',
                'Seni grubundaki üyelere ve bağladığın veliye göstermek',
                'm.5/2-c: sözleşmenin kurulması ve ifası için gerekli',
              ],
              [
                'Yaş bandı (15–17 ya da 18+) ve bu bandı hangi yıl bildirdiğin. Doğum yılın gönderilmez.',
                '15 yaş sınırını uygulamak, 15–17 için veli bağlantısını sunmak, bandın erken yükseltilmesini önlemek',
                'm.5/2-c; güvenlik için m.5/2-f (meşru menfaat)',
              ],
              [
                'Sınav türü ve alan: grup hesabı açılırken denetlenir, saklanmaz',
                'LGS profiliyle grup hesabı açılmasını önlemek',
                'm.5/2-c',
              ],
              [
                'Hesap bilgisi: rastgele hesap numarası, oturum anahtarları, oturumun açıldığı ve yenilendiği zamanlar, son kullanım günü. Hesap anonimdir: e-posta ya da telefon numarası istenmez.',
                'Grup hesabını bu telefona bağlamak, 6 ay kullanılmayan hesabı silmek',
                'm.5/2-c',
              ],
              [
                'Grup ayarların (görünmez çalış, tepkileri al)',
                'Seçtiğin görünürlüğü uygulamak',
                'm.5/2-c',
              ],
              [
                'Grup üyelikleri ve katılma istekleri (hangi grup, ne zaman, rolün; kurucunun kararı)',
                'Grupları çalıştırmak, kurucu onayını ve 30 kişi sınırını uygulamak',
                'm.5/2-c',
              ],
              [
                'Canlı durum: o an çalışıp çalışmadığın, molada olup olmadığın, hangi derse ve ne zamandır çalıştığın. Yalnız bir grupta olduğunda gönderilir.',
                'Grubunda kimin o an çalıştığını göstermek',
                'm.5/2-c',
              ],
              [
                'Çalışma oturumları: başlangıç ve bitiş zamanı, süre, sayaç mı “elle” mi, sunucunun oturumu canlı görüp görmediği; günlük toplamlar. Ders ve konu gönderilmez. Hiçbir grupta, bekleyen bir katılma isteğinde ya da bağlı velin yokken saklanmaz.',
                'Grup sıralamasını hesaplamak, veliye haftalık süreyi göstermek, çakışan ya da mantıksız süreleri ayıklamak',
                'm.5/2-c; hile önleme için m.5/2-f',
              ],
              [
                'Hazır tepkiler (kimin kime, hangi grupta, ne zaman gönderdiği)',
                'Tepkiyi alıcıya iletmek, aynı kişiye günde en fazla 3 sınırını uygulamak',
                'm.5/2-c; kötüye kullanımı önlemek için m.5/2-f',
              ],
              [
                'Bildirimler (raporlar) ve engellemeler: kimi ya da hangi grubu, hangi hazır sebeple, ne zaman bildirdiğin ya da engellediğin; verilen karar',
                'Kullanım şartlarını uygulamak, taciz ve kötüye kullanımı önlemek',
                'm.5/2-f; olası bir uyuşmazlıkta m.5/2-e (bir hakkın tesisi, kullanılması veya korunması)',
              ],
              [
                'Veli bağlantısı (yalnız 15–17 ve yalnız kodu sen oluşturursan): veli hesabının numarası, bağlantı zamanı, velinin kilitleri, velinin son kullanımı',
                'Velinin seni gözetmesini sağlamak, velinin kilitlerini uygulamak',
                'm.5/2-c (bağlantıyı sen kurarsın)',
              ],
              [
                'Güvenlik kayıtları: yaptığın işlemler (ör. grup kurma, katılma isteği, hesap silme) hesap numarası, zaman ve IP adresiyle; sunucu erişim kaydı (IP adresi ve port, zaman, istenen adres, veri miktarı; istek içeriği ve başlıkları kaydedilmez)',
                'Saldırı ve kötüye kullanımı önlemek, yetkili makamların yasal taleplerine cevap vermek',
                'm.5/2-f; 5651 sayılı Kanun kapsamında yer sağlayıcı sayılırsak m.5/2-ç (hukuki yükümlülük)',
              ],
              [
                'Bize yazdıkların (destek, başvuru ve şikâyet e-postaları, e-posta adresin)',
                'Sana cevap vermek, KVKK başvurunu sonuçlandırmak',
                'm.5/2-c; KVKK başvuruları için m.5/2-ç (KVKK m.13)',
              ],
            ],
          },
        },
        'İstemediklerimiz ve toplamadıklarımız: adın, doğum yılın, e-postan (bize yazmadıkça), telefonun, okulun, konumun, fotoğrafların, rehberin, reklam kimliğin ve deneme netlerin. Uygulamada reklam, analitik, çökme raporu, anlık bildirim (push) ve izleme yoktur; Apple ya da Google hesabıyla giriş yoktur.',
        'Sağlık, din ve benzeri özel nitelikli kişisel veri toplamayız. Lütfen takma adına ya da grup adına böyle bilgiler yazma.',
      ],
    },
    {
      heading: 'Nasıl toplanıyor?',
      blocks: [
        'Senin girdiklerin (takma ad, grup adı, davet kodu, veli kodu, bildirim ve engellemeler) uygulamadaki ekranlardan; sayaç zamanları, canlı durum ve güvenlik kayıtları uygulama ile sunucumuz arasında otomatik olarak, elektronik ortamda toplanır. Bize e-postayla yazarsan yazdıkların otomatik olmayan yolla ulaşır.',
      ],
    },
    {
      heading: 'Kimlere aktarılıyor?',
      blocks: [
        {
          list: [
            'Grubundaki üyeler: takma adın; görünmez çalışmıyorsan o an çalıştığın, hangi derse ve ne zamandır çalıştığın, molada olup olmadığın; günlük ve haftalık süren ve sıralaman (“elle” ve “çevrimdışı” kısımlar ayrıca gösterilir). Engellediğin kişiyle birbirinizi listelerde görmezsiniz.',
            'Katılmak istediğin grubun kurucusu: takma adın ve isteğinin zamanı.',
            'Hazır tepki gönderdiğin kişi: takma adın, tepki ve grubun adı.',
            'Bağladığın veli (yalnız 15–17): takma adın, son 7 günün günlük toplam çalışma süresi (“elle” kısmı dahil) ve sana kaç veli hesabının bağlı olduğu. Bağlantı senin tarafında biterse velin yalnız bunun olduğunu ve tarihini görür.',
            'Türkiye’deki barındırma ve yedekleme sağlayıcılarımız: sunucudaki bilgilerin tamamı, veri işleyen olarak yalnız bizim adımıza ve talimatımızla saklanır.',
            'Yetkili kamu kurum ve kuruluşları ile mahkemeler: yalnız kanunen istendiğinde (m.5/2-ç, m.8).',
          ],
        },
        'Bilgilerini satmayız, reklam ya da başka bir amaçla kimseyle paylaşmayız.',
      ],
    },
    {
      heading: 'Yurt dışına aktarım',
      blocks: [
        `Yoktur. Sunucumuz ve şifreli yedeklerimiz Türkiye’dedir. ${MAILBOX_IN_TURKEY} Uygulama Türkiye’deki sunucumuz dışında hiçbir sunucuya bağlanmaz; anlık bildirim (push) kullanmadığımız için Apple’ın ya da Google’ın bildirim servislerine de bir şey gönderilmez. Bu değişirse metni önceden güncelleriz.`,
      ],
    },
    {
      heading: 'Ne kadar saklanıyor?',
      blocks: [
        {
          list: [
            'Telefonundaki kayıtlar: sen silene kadar.',
            'Grup hesabı ve ona bağlı bilgiler: hesabın açık olduğu sürece. 6 ay hiç kullanılmayan grup hesabı kendiliğinden silinir.',
            'Hazır tepkiler 90 gün, reddedilen ya da kurucunun çıkardığı katılma kayıtları 30 gün, veliye giden bağlantı bildirimleri 90 gün saklanır.',
            'Güvenlik kayıtları 395 gün, sunucu erişim kaydı 400 gün saklanır.',
            'Bize yazdığın e-postaları konu kapandıktan sonra 1 yıl, KVKK başvurularını ve cevaplarımızı 3 yıl saklarız.',
          ],
        },
        'Bütün süreler ve silme yöntemleri: [Saklama ve imha politikası](saklama).',
      ],
    },
    {
      heading: 'Hakların (KVKK m.11)',
      blocks: ['Bize başvurarak şu haklarını kullanabilirsin:', { list: KVKK_RIGHTS }],
    },
    {
      heading: 'Kendin yapabileceklerin',
      blocks: [
        {
          list: [
            HOW_TO_DELETE,
            'Cihazdan sildiğin bir çalışma oturumu sunucudan da silinir.',
            'Telefonundaki verilerini Ayarlar’dan görebilir, Ayarlar → Yedekle ve geri yükle ile yedek dosyası ya da CSV olarak dışa aktarabilirsin.',
            'Grupların seni “şu an çalışıyor” listesinde görmesini Gruplar ekranındaki “Görünmez çalış” ile, sana tepki gönderilmesini “Tepkileri al” ile kapatabilirsin.',
          ],
        },
        'Grup hesabını silince hemen silinmeyenler:',
        { list: AFTER_DELETION },
      ],
    },
    {
      heading: 'Nasıl başvurursun?',
      blocks: [HOW_TO_APPLY],
    },
    {
      heading: 'Güvenlik',
      blocks: [
        {
          list: [
            'Uygulama ile sunucu arasındaki bağlantı şifrelidir (TLS).',
            'Uygulama veritabanındaki tablolara doğrudan erişemez; yalnız tanımlı işlemleri çağırabilir ve her kişi yalnız kendisine açık bilgileri görür.',
            'Sunucuya yalnız geliştirici, parolayla değil anahtarla erişir.',
            'Yedekler şifrelidir ve Türkiye’de, sunucudan ayrı bir yerde tutulur.',
            'Bir veri ihlali olursa Kişisel Verileri Koruma Kurulu’na 72 saat içinde bildirir, etkilenenleri en kısa sürede bilgilendiririz.',
          ],
        },
      ],
    },
    {
      heading: 'Bu metin değişirse',
      blocks: [
        'Yeni bir veri türü, yeni bir amaç ya da yeni bir alıcı gibi önemli bir değişikliği yürürlüğe girmeden önce haber veririz. Eski sürümler: [Eski sürümler](gizlilik/arsiv).',
      ],
    },
  ],
};
