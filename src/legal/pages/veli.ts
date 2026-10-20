/**
 * One-page information for parents (source: docs/hukuk/kvkk/06, corrected to the code). It
 * informs; it does not ask for consent. Parent tools: public.create_parent_code (10 minutes),
 * claim_parent_code (at most 2 parents), parent_set_controls, parent_weekly_summary,
 * parent_notices (90 days), child_unlink_parents.
 */

import { C, LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

export const page: LegalPage = {
  slug: 'veli',
  title: 'Velilere: Etüt hakkında bilmeniz gerekenler',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Velilere', order: 4 },
  intro: [
    'Çocuğunuz sınava hazırlanırken Etüt’ü kullanıyor olabilir. Bu sayfa uygulamanın ne yaptığını, çocuğunuz hakkında hangi bilgilerin tutulduğunu ve neleri kontrol edebileceğinizi kısaca anlatır.',
    `Kim yapıyor? Uygulamayı ${C.name} tek başına geliştiriyor ve işletiyor. İletişim: ${C.contact}.`,
  ],
  sections: [
    {
      heading: 'Uygulama ne yapar?',
      blocks: [
        {
          list: [
            'Ders çalışma süresini ölçen bir sayaç.',
            'Deneme sınavı net takibi. Denemeler ve netler yalnız çocuğunuzun telefonunda kalır; sunucuya gönderilmez, grupta görünmez.',
            'İsteğe bağlı, en fazla 30 kişilik, yalnız davet koduyla ve kurucunun onayıyla girilen çalışma grupları. Grupta kimin o an çalıştığı ve günlük, haftalık süre sıralaması görünür. Üyeler birbirine yalnız hazır tepki düğmeleri gönderebilir (“Tebrikler”, “Hadi!”, “Helal olsun”, “Başarılar”).',
          ],
        },
      ],
    },
    {
      heading: 'Uygulamada olmayanlar',
      blocks: [
        'Sohbet, özel mesaj, yorum, fotoğraf, video ya da bağlantı paylaşımı, herkese açık profil, kullanıcı arama, yabancılarla eşleştirme, reklam, analitik, reklam amaçlı takip, pazarlama bildirimi ve anlık bildirim (push). Uygulama içinde satın alma yoktur.',
      ],
    },
    {
      heading: 'Yaş kuralları',
      blocks: [
        {
          list: [
            '15 yaşından küçükler: yalnız cihaz modu. Grup hesabı açılmaz, gruplar görünmez, hiçbir bilgi telefondan dışarı çıkmaz.',
            '15–17 yaş: gruplar açılabilir. Yaş ya da yaş bandı gruplarda hiçbir yerde gösterilmez. Veli bağlantısını yalnız 15–17 yaşındakiler kurabilir.',
            'Yaş, kullanıcının seçtiği doğum yılına göre belirlenir; kimlik kontrolü yapmıyoruz. 15 yaş altı beyanından sonra yaş, yeniden kayıtla ya da yedek geri yükleyerek yükseltilemez.',
          ],
        },
      ],
    },
    {
      heading: 'Çocuğunuz hakkında tutulan bilgiler',
      blocks: [
        'Gruplar açılmadıkça hiçbir bilgi sunucuya gitmez. Gruplar açılırsa Türkiye’deki sunucumuzda şunlar tutulur:',
        {
          list: [
            'Takma ad ve yaş bandı (15–17 ya da 18+). Doğum yılı telefonda kalır, sunucuya gitmez. Sınav türü ve alanı yalnız denetlenir, saklanmaz.',
            'Çalışma süreleri: ne zaman ve ne kadar. Hangi derse çalıştığı yalnız çalışırken grubunda görünür ve saklanmaz. Hiçbir grupta değilse ve bağlı veli yoksa süreler saklanmaz.',
            'Grup üyelikleri ve katılma istekleri, gönderilen ve gelen hazır tepkiler, yaptığı bildirimler ve engellemeler.',
            'Güvenlik kayıtları: yaptığı işlemler, hesap numarası, zaman ve IP adresiyle 395 gün.',
          ],
        },
        'Adını, e-postasını, telefonunu, okulunu, konumunu, fotoğraflarını ve rehberini istemiyoruz. Bilgiler satılmaz ve yurt dışına gönderilmez. Grup hesabı 6 ay kullanılmazsa kendiliğinden silinir.',
      ],
    },
    {
      heading: 'Güvenlik için yaptıklarımız',
      blocks: [
        {
          list: [
            'Takma ad ve grup adları, kaydedilmeden önce uygunsuz sözcük ve kişisel bilgi (telefon, adres, okul, il, sosyal medya adı, doğum yılı) filtresinden geçer.',
            'Davet kodu 72 saat geçerlidir; gruba her girişi kurucu tek tek onaylar.',
            'Her kullanıcı başka birini engelleyebilir ve bildirebilir. Bildirimleri 24 saat içinde incelemeyi hedefliyoruz.',
            'Reşit olmayanlara yönelik cinsel içerikli bir girişim, grup hesabının silinmesine ve yetkili makamlara bildirime yol açar.',
          ],
        },
        'Bütün tedbirler: [Çocuk güvenliği ve yaş politikası](cocuk-guvenligi).',
      ],
    },
    {
      heading: 'Sizin yapabilecekleriniz',
      blocks: [
        {
          list: [
            'Birlikte bakın: çocuğunuzla Gruplar ekranındaki grup ayarlarına (“Görünmez çalış”, “Tepkileri al”) ve hangi gruplarda olduğuna birlikte bakın.',
            'Davet kodunu konuşun: kodun yalnız tanıdığı arkadaşlarıyla paylaşılması gerektiğini hatırlatın.',
            'Veli modu: çocuğunuz kendi telefonunda Gruplar → Veli bağlantısı → “Veli kodu oluştur”a dokunur; siz kendi telefonunuzda Etüt’ü açıp Ayarlar → Veli modu’na ekranda çıkan 8 haneli kodu yazarsınız. Kod 10 dakika geçerlidir. E-posta ya da telefon istemiyoruz; sizin telefonunuzda da anonim bir veli hesabı açılır ve 6 ay kullanılmazsa silinir.',
            'Veli modunda grup özelliklerini kapatabilir, görünmez çalışmayı zorunlu yapabilir, günlük grup süresi sınırı koyabilir ve son 7 günün günlük toplam çalışma süresini görebilirsiniz. En fazla 2 veli bağlanabilir; iki veli farklı ayar seçerse en kısıtlayıcı olan geçerlidir ve her veli diğer bağlı hesabın varlığını görür.',
            'Doğum yılına göre 18 yaşını doldurduğu kesinleşince, çocuğunuz Gruplar ekranını ilk açtığında veli bağlantısı ve kilitler kendiliğinden biter; veli denetimi 15–17 yaş içindir.',
            'Telefonun ebeveyn denetimleri: iPhone’da Ekran Süresi ile kullanım süresini yönetebilirsiniz.',
            'Bilgileri sildirmek: çocuğunuz grup hesabını Gruplar → Grup hesabı → Grup hesabımı sil ile ya da Ayarlar → Tüm verileri sil ile kendisi hemen silebilir. Sunucudaki bilgilerin dökümü şimdilik yazılı başvuruyla verilir.',
          ],
        },
      ],
    },
    {
      heading: 'Veli araçlarının sınırı',
      blocks: [
        'Silme hakkı çocuğunuza aittir ve engellenmez. Bu yüzden 15–17 yaşındaki çocuğunuz veli bağlantısını Gruplar ekranından kaldırabilir ya da grup hesabını silip yeni bir grup hesabı açabilir; o zaman kilitleriniz yeni hesapta geçerli olmaz. Bağlantı çocuğunuzun tarafında biterse (bağlantıyı kaldırma, grup hesabını silme, 18 yaşını doldurduğunu bildirme) veli ekranınızda bunun olduğunu ve tarihini 90 gün görürsünüz. Kimlik doğrulaması yapmadığımız için veli araçları bir güvence değil, çocuğunuzla birlikte kullanılan bir yardımcıdır.',
      ],
    },
    {
      heading: 'Veli olarak başvurmak',
      blocks: [
        `Kanuni temsilci olarak ${C.contact} adresine yazabilirsiniz. Başkasının hesabı hakkında bilgi vermemek için başvurunuzda veli modunda çocuğunuza bağlı olduğunuzu göstermenizi isteriz (örneğin veli ekranınızın görüntüsüyle). En geç 30 gün içinde yazılı cevap veririz.`,
        'Endişeniz ya da şikâyetiniz varsa bize yazın. Kişisel veriler konusunda Kişisel Verileri Koruma Kurulu’na da başvurabilirsiniz.',
        'Ayrıntılı metinler: [Aydınlatma metni](aydinlatma) · [Gizlilik politikası](gizlilik) · [Kullanım şartları ve topluluk kuralları](kullanim).',
      ],
    },
  ],
};
