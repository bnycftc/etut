/**
 * Terms of use with the community rules, reporting and the child safety commitment, group
 * version (source: docs/hukuk/kvkk/05 part A, corrected to the code). Part B (in-app purchases)
 * is not here: the app sells nothing. The explicit "Kabul ediyorum" step before the group
 * account is opened comes with WP-J (plan finding 3).
 * Moderation decisions are the ones app.close_report accepts (hardening migration, section 11).
 */

import { C, HOW_TO_DELETE, LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

export const page: LegalPage = {
  slug: 'kullanim',
  title: 'Kullanım şartları ve topluluk kuralları',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Kullanım şartları', order: 3 },
  sections: [
    {
      heading: '1. Taraflar ve kabul',
      blocks: [
        `Bu şartlar, Etüt’ü geliştiren ve işleten ${C.name} (“biz”) ile uygulamayı kullanan sen arasındaki sözleşmedir. İletişim: ${C.contact}.`,
        'Uygulamayı kullanarak bu şartları kabul etmiş olursun. Grupları açarken ayrıca aşağıdaki topluluk kurallarını kabul edersin.',
        'Kişisel verilerinin nasıl işlendiği ayrı bir metinde anlatılır: [Aydınlatma metni](aydinlatma). Bu şartları kabul etmen, kişisel verilerinin işlenmesine rıza vermen anlamına gelmez.',
      ],
    },
    {
      heading: '2. Yaş',
      blocks: [
        {
          list: [
            'Doğum yılını doğru seçmelisin. Yaşın bu beyana göre belirlenir; kimlik kontrolü yapmayız.',
            'Grup hesabı açmak, gruplara katılmak ve grup kurmak için 15 yaşını doldurmuş olmalısın. 15 yaşından küçüksen uygulamayı cihaz modunda kullanırsın: kayıtların telefonunda kalır, gruplar kapalıdır. 15 yaşından küçükler için çalışma kartı da kapalıdır.',
            '15–17 yaşındaysan velinin bu uygulamayı kullandığından haberdar olmasını isteriz: [Velilere](veli) sayfasını ona göster.',
            'Yanlış yaş beyan edildiğini öğrenirsek grup hesabını silebiliriz.',
            `15 yaşından küçük birinin grup hesabı açtığını düşünüyorsan ${C.contact} adresine yaz.`,
          ],
        },
      ],
    },
    {
      heading: '3. Hizmet ne, ne değil',
      blocks: [
        'Etüt bir çalışma süresi sayacı, deneme neti takibi ve isteğe bağlı, küçük çalışma grupları uygulamasıdır. Resmî değildir: ÖSYM, MEB ya da başka bir kamu kurumuyla bağlantısı yoktur, onlar adına konuşmaz; sınav adları yalnız tanımlama içindir.',
        'Ders vermez ve başarı garantisi vermez. Süreler senin kullanımına dayanır. Sıralamada bir sürenin “çevrimdışı” ya da “elle” diye ayrılmaması yalnız sayacın sunucuya canlı bağlı çalıştığını gösterir; gerçekten ders çalıştığını kanıtlamaz. Sınav tarihleri açıklanana kadar tahminidir.',
      ],
    },
    {
      heading: '4. Grup hesabın',
      blocks: [
        {
          list: [
            'Grup hesabı anonimdir: e-posta ya da telefon numarası istemeyiz. Bir kişi tek bir grup hesabı kullanır; hesabını başkasına devredemez ya da satamazsın.',
            'Takma adın ve grup adın topluluk kurallarına uymalı. İkisine de gerçek adını, soyadını, okulunu ya da dershaneni, ilini ya da ilçeni, telefonunu, adresini, doğum yılını ya da sosyal medya hesabını yazma. Bunu senin güvenliğin için istiyoruz.',
            'Grup hesabının giriş anahtarı yalnız bu telefonda durur. Uygulamayı silersen ya da telefonunu değiştirirsen grup hesabına geri dönemeyebilirsin; o zaman yeni bir grup hesabı açarsın. Kullanılmayan eski hesap 6 ay sonra kendiliğinden silinir. Sayaç ve deneme kayıtların telefonunda kaldığı için bundan etkilenmez.',
            HOW_TO_DELETE,
          ],
        },
      ],
    },
    {
      heading: '5. Gruplar',
      blocks: [
        {
          list: [
            'Gruplara yalnız davet koduyla ve kurucunun onayıyla girilir. Kod 72 saat geçerlidir; kurucu yeni kod alabilir ya da kodu iptal edebilir. Bir grupta en fazla 30 kişi olur.',
            'Kurucu katılma isteklerini onaylar ya da reddeder, bir üyeyi gruptan çıkarabilir, istek gönderen birini engelleyebilir ya da bildirebilir. Reddedilen ya da çıkarılan kişi aynı gruba 30 gün istek gönderemez.',
            'Gruba katılınca üyeler takma adını, o an çalışıp çalışmadığını (görünmez çalışmıyorsan hangi derse çalıştığını da), günlük ve haftalık süreni ve sıralamanı görür. Deneme netlerin telefonunda kalır, grupta görünmez.',
            'Davet kodunu yalnız tanıdığın kişilere ver; herkese açık yerlerde paylaşma.',
            'Gruptan istediğin an çıkabilirsin. Kurucu gruptan çıkar ya da hesabını silerse kuruculuk en eski üyeye geçer; grupta kimse kalmazsa grup silinir.',
          ],
        },
      ],
    },
    {
      heading: '6. Topluluk kuralları',
      blocks: [
        'Gruplar birlikte çalışmak için var. Gruplar küçük ve kapalı; üyelerin çoğu reşit değil. Bu yüzden kurallar kısa ama sıkı. Şunları yapma:',
        {
          list: [
            'Taciz ve zorbalık: birini aşağılamak, alay etmek, tehdit etmek, hazır tepkileri rahatsız etmek için kullanmak.',
            'Nefret ve ayrımcılık: ırk, etnik köken, din, cinsiyet, engellilik, cinsel yönelim gibi özellikler üzerinden aşağılayan takma ad ya da grup adı.',
            'Müstehcenlik: cinsel ima taşıyan takma ad ya da grup adı. Reşit olmayanlara yönelik cinsel içerikli her türlü girişim kesinlikle yasaktır ve yetkili makamlara bildirilir.',
            'Kişisel bilgi: takma ada ya da grup adına kendinin ya da başkasının gerçek adını, okulunu ya da dershanesini, ilini ya da ilçesini, telefonunu, adresini, sosyal medya hesabını yazmak; grup adıyla insanları başka bir platforma çağırmak.',
            'Başkası gibi davranmak: bir öğretmenin, ünlünün, kurumun ya da başka bir kullanıcının adını; “ÖSYM”, “MEB” gibi resmî kurum adlarını kullanmak.',
            'Hile: sayacı otomatik araçlarla, ikinci bir cihazla ya da saati oynatarak şişirmek, birden fazla grup hesabı açmak, sıralamayı başka yollarla oynatmak.',
            'Reklam ve spam: takma adı ya da grup adını bir ürünü, hesabı ya da kanalı tanıtmak için kullanmak.',
            'Yasa dışı her şey: kumar, uyuşturucu, şiddete çağrı, kendine zarar vermeyi özendirme.',
            `Sistemi bozmak: uygulamaya ya da sunucuya saldırmak, izinsiz güvenlik testi yapmak, başkasının hesabına girmeye çalışmak. Bir güvenlik açığı bulursan lütfen ${C.contact} adresine bildir.`,
          ],
        },
        'Grubundakilere destek ol; hazır tepkiler bunun için var. Biri seni rahatsız ediyorsa onu engelle, bildir ve güvendiğin bir yetişkine anlat.',
        'Takma ad ve grup adları kaydedilmeden önce otomatik bir filtreden geçer: küfür ve uygunsuz sözcükleri, telefon numarası, adres, sosyal medya adı, okul, il ve doğum yılı gibi kişisel bilgi kalıplarını reddeder; emoji kabul etmez. Filtre her şeyi yakalayamaz; bu yüzden bildirimlerin önemli.',
      ],
    },
    {
      heading: '7. Bildirme ve engelleme',
      blocks: [
        {
          list: [
            'Bir üyeyi bildirmek: grup ekranında üyenin adına dokun, “Bildir”e dokun ve bir sebep seç: uygunsuz takma ad, rahatsız ediyor, tehlike / kendine zarar ya da diğer. Bildirimde serbest metin yoktur.',
            'Bir grubu bildirmek: grup ekranında “Grup adını bildir”.',
            'Kurucuysan katılma isteği gönderen birinin takma adını bildirebilir ya da onu engelleyebilirsin.',
            'Engellemek: üyenin adına dokun, “Engelle”. Engellediğin kişi sana tepki gönderemez; ikiniz birbirinizi listelerde görmezsiniz. Engeli Gruplar → Engellediklerim’den kaldırırsın.',
            'Kimin bildirdiğini ya da engellediğini o kişiye söylemeyiz.',
            'Acil durum: biri kendine ya da başkasına zarar vereceğini söylüyorsa ya da bir çocuğun güvenliği tehlikedeyse önce 112’yi ara, sonra bize bildir.',
          ],
        },
      ],
    },
    {
      heading: '8. Bildirimden sonra',
      blocks: [
        {
          list: [
            'Hedefimiz bildirimleri 24 saat içinde incelemek. Tehlike, tehdit, kişisel bilgi ifşası ve çocuk güvenliğiyle ilgili bildirimlere öncelik veririz.',
            'Kararımız şunlardan biridir: işlem gerekmedi; takma adın ya da grup adının değiştirilmesi; kişinin gruptan çıkarılması; grup hesabının silinmesi; yetkili makamlara bildirim. Ağır ya da tekrar eden ihlallerde grup hesabını sileriz.',
            'Reşit olmayanlara yönelik cinsel istismar şüphesi, ciddi bir tehdit ya da suç belirtisi varsa ilgili kayıtları kanunun izin verdiği ölçüde saklar ve yetkili makamlara (emniyet, Cumhuriyet savcılığı) bildiririz. Mahkeme ve yetkili kurum kararlarını kanundaki sürede uygularız.',
            `Hakkında karar verildiğini düşünüyorsan 14 gün içinde ${C.contact} adresine yazarak itiraz edebilirsin. İtirazı yeniden inceler, sonucu sana e-postayla bildiririz.`,
          ],
        },
      ],
    },
    {
      heading: '9. Çocuk güvenliği taahhüdü',
      blocks: [
        {
          list: [
            'Çocukların cinsel istismarına ve sömürüsüne yönelik her türlü içerik ve davranışa sıfır tolerans gösteririz.',
            'Uygulamada sohbet, özel mesaj, yorum, görsel, ses ya da bağlantı paylaşımı yoktur; üyeler birbirine yalnız dört hazır tepki gönderebilir.',
            'Yetişkinler ile reşit olmayanlar aynı grupta bulunabilir. Bu yüzden gruba yalnız kodla ve kurucunun onayıyla girilir, gruplarda yalnız takma ad görünür ve yaş hiçbir yerde gösterilmez.',
            `Çocuk güvenliği irtibat kişisi: ${C.name}, ${C.contact}.`,
          ],
        },
        'Uyguladığımız bütün tedbirler: [Çocuk güvenliği ve yaş politikası](cocuk-guvenligi).',
      ],
    },
    {
      heading: '10. Verilerin',
      blocks: [
        'Sayaç, deneme ve hedef kayıtların telefonunda tutulur. Telefonunun kendi yedeği açık değilse, telefon değiştirirken ya da uygulamayı silmeden önce Ayarlar → Yedekle ve geri yükle → “Yedek dosyası oluştur” ile yedek al; yedeği saklamak senin elindedir. Grupları açarsan sunucuda neyin tutulduğu [Gizlilik politikası](gizlilik) sayfasında yazar.',
      ],
    },
    {
      heading: '11. Hizmetin değişmesi ve durması',
      blocks: [
        'Uygulamayı geliştirmek için özellikleri değiştirebilir, ekleyebilir ya da kaldırabiliriz; senin için önemli bir değişikliği önceden duyururuz. Grup özelliğini tamamen kapatmaya karar verirsek en az 30 gün önce duyururuz; telefonundaki kayıtların bundan etkilenmez. Bakım ve arıza nedeniyle gruplar zaman zaman çalışmayabilir; sayaç ve denemeler internetsiz de çalışır.',
      ],
    },
    {
      heading: '12. Fikri haklar',
      blocks: [
        'Uygulamanın adı, tasarımı ve kodu geliştiricisine aittir. Kullandığımız açık kaynak yazılımlar ve lisansları Hakkında → Açık kaynak lisansları bölümünde listelenir.',
        'Yazdığın takma ad ve grup adı sana aittir. Onları grubun diğer üyelerine gösterebilmemiz için bize hizmet süresiyle sınırlı, ücretsiz bir kullanım izni vermiş olursun; hesabını ya da grubu silince bu izin sona erer.',
      ],
    },
    {
      heading: '13. Sorumluluk',
      blocks: [
        'Uygulamayı özenle ve iyi niyetle çalıştırmaya gayret ederiz, ama hatasız ve kesintisiz çalışacağını garanti edemeyiz. Kastımız ya da ağır ihmalimiz olmadıkça telefonunda yaşanan bir sorun yüzünden kayıtların kaybolmasından, grup üyelerinin kendi davranışlarından ve internet bağlantısından kaynaklanan sorunlardan sorumlu değiliz.',
        'Kastımızdan ya da ağır ihmalimizden doğan zararlardan, kişisel verilerin hukuka aykırı işlenmesinden ve kanunun sorumluluğun kaldırılmasına izin vermediği hâllerden sorumluluğumuz bu maddeyle sınırlanmaz. Tüketici olarak kanundan doğan hakların saklıdır.',
      ],
    },
    {
      heading: '14. Şartların değişmesi',
      blocks: [
        'Bu şartları değiştirirsek yürürlükten en az 15 gün önce haber veririz. Değişikliği kabul etmezsen grup hesabını silebilirsin. Kanunen zorunlu değişiklikler daha kısa sürede yürürlüğe girebilir.',
      ],
    },
    {
      heading: '15. Uygulanacak hukuk',
      blocks: [
        'Türk hukuku uygulanır. Uyuşmazlıkta her yıl belirlenen parasal sınırlar içinde yerleşim yerindeki Tüketici Hakem Heyeti’ne, bu sınırların üzerinde Tüketici Mahkemesi’ne başvurabilirsin. Önce bize yazarsan birlikte çözmeye çalışırız.',
      ],
    },
    {
      heading: '16. İletişim',
      blocks: [`${C.name} · ${C.contact} · [İletişim](iletisim)`],
    },
  ],
};
