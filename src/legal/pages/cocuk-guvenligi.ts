/**
 * "Çocuk Güvenliği ve Yaş Politikası" (hukuk/03 K-25): the measures of sections 2–4 of the design
 * rules as they are in the code, with the K-25 sentence word for word (the generator's test
 * checks it).
 */

import { C, LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

/** The K-25 sentence, exactly as hukuk/03 requires it. */
export const K25_STATEMENT = '5651 m.2/1-(s) kapsamında olmadığımız görüşündeyiz; ihtiyaten uyguluyoruz.';

export const page: LegalPage = {
  slug: 'cocuk-guvenligi',
  title: 'Çocuk güvenliği ve yaş politikası',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Çocuk güvenliği', order: 5 },
  intro: [
    'Etüt bir çalışma sayacı ve deneme takip uygulamasıdır; davetle kurulan küçük çalışma grupları isteğe bağlı, ikincil bir özelliktir. Etüt’ün 5651 sayılı Kanun’daki sosyal ağ sağlayıcı tanımına girmediği görüşündeyiz. Yine de bu tanıma girenlerden beklenen çocuk ve yaş tedbirlerini kendi ölçeğimizde ihtiyaten uyguluyor ve bu sayfada yayımlıyoruz.',
    K25_STATEMENT,
  ],
  sections: [
    {
      heading: 'Yaş',
      blocks: [
        {
          list: [
            'İlk açılışta doğum yılı nötr bir listeden seçilir: önceden seçili bir değer ya da yaşa yönelik bir ipucu yoktur. Tam doğum tarihi, kimlik numarası, yüz ya da biyometrik veri istenmez.',
            '15 yaşından küçükler uygulamayı yalnız cihaz modunda kullanır: grup hesabı açılmaz, grup özellikleri görünmez ve uygulama sunucuya hiçbir şey göndermez. Analitik, çökme raporu ve anlık bildirim (push) uygulamada hiç yoktur.',
            '15 yaş altı beyanından sonra yaş, verileri silip yeniden kayıt olarak ya da bir yedek geri yükleyerek yükseltilemez: beyan edilen doğum yılı bunun için 15 yaşına gelinceye kadar telefonda ayrıca saklanır.',
            'Sunucu doğum yılını değil yalnız yaş bandını (15–17 ya da 18+) bilir ve 15 yaş altını kabul etmez. 15–17 olarak bildirilen bant aynı takvim yılı içinde 18+’ya yükseltilemez. LGS profiliyle grup hesabı açılmaz.',
            'Yaş beyana dayanır; kimlik doğrulaması yapmayız.',
          ],
        },
      ],
    },
    {
      heading: 'Gruplar kapalıdır',
      blocks: [
        {
          list: [
            'Gruba yalnız kurucunun verdiği 8 haneli davet koduyla ve kurucunun onayıyla girilir. Kod 72 saat geçerlidir; kurucu kodu yenileyebilir ya da iptal edebilir.',
            'Bir grupta en fazla 30 kişi olur; bu sınır veritabanında uygulanır.',
            'Grup araması, grup listesi, önerilen gruplar ve herkese açık grup yoktur. Kullanıcı arama, herkese açık profil, yabancıyla eşleştirme, öneri algoritması ve sonsuz akış yoktur.',
            'Sıralama yalnız grubun içindedir: genel, il ya da okul sıralaması yoktur.',
            'Reddedilen ya da gruptan çıkarılan kişi aynı gruba 30 gün istek gönderemez.',
          ],
        },
      ],
    },
    {
      heading: 'İçerik ve iletişim',
      blocks: [
        {
          list: [
            'Sohbet, özel mesaj, yorum, akış, beğeni, hikâye, görsel, ses, bağlantı ve konum paylaşımı yoktur.',
            'Üyeler birbirine yalnız dört hazır tepki gönderebilir. Tepki yalnız alıcıya gösterilir, herkese açık bir sayaç olarak görünmez; aynı kişiye günde en fazla 3 tepki gönderilebilir ve herkes tepkileri kapatabilir. Tepkiler 90 gün sonra silinir.',
            'Kullanıcının yazabildiği tek metinler takma ad (3–20 karakter) ve grup adı (3–24 karakter). İkisi de kaydedilmeden önce küfür, cinsel içerik ve kişisel bilgi (telefon numarası, adres, sosyal medya adı, okul, il, doğum yılı, yaygın soyadları) filtresinden geçer; emoji kabul edilmez. Grup adı için hazır öneriler vardır.',
            'Gruplarda yalnız takma ad görünür; yaş ya da yaş bandı hiçbir yerde gösterilmez. “Görünmez çalış” açıkken kişi grubunun “şu an çalışıyor” listesinde görünmez.',
            'Deneme netleri telefonda kalır; grupta görünmez.',
          ],
        },
      ],
    },
    {
      heading: 'Bildirme, engelleme ve inceleme',
      blocks: [
        {
          list: [
            'Her kullanıcı bir üyeyi ya da grup adını hazır sebeplerle (uygunsuz takma ad, uygunsuz grup adı, rahatsız ediyor, tehlike / kendine zarar, diğer) bildirebilir ve başka birini engelleyebilir. Kurucu bir üyeyi gruptan çıkarabilir.',
            'Bildirimleri 24 saat içinde incelemeyi hedefliyoruz; tehlike ve çocuk güvenliğiyle ilgili olanlara öncelik veririz. Kararlar: işlem gerekmedi, adın değiştirilmesi, gruptan çıkarma, grup hesabının silinmesi, yetkili makamlara bildirim.',
            'Cinsel istismar, intihar riski ya da ciddi bir tehdit içeren durumlarda kolluğa ya da Cumhuriyet savcılığına bildiririz ve bunu kayda geçiririz. Acil bir tehlike varsa önce 112’yi arayın.',
          ],
        },
        'Ayrıntılar: [Kullanım şartları ve topluluk kuralları](kullanim).',
      ],
    },
    {
      heading: '15–17 yaş ve veliler',
      blocks: [
        'Veli, kendi telefonundaki veli modunda çocuğun ekranında oluşan 10 dakikalık kodla bağlanır; veliden e-posta ya da telefon istenmez. Veli grup özelliklerini kapatabilir, görünmez çalışmayı zorunlu yapabilir, günlük grup süresi sınırı koyabilir ve son 7 günün çalışma süresini görür. En fazla 2 veli bağlanır ve en kısıtlayıcı ayar geçerlidir. Uygulamada satın alma yoktur. Ayrıntılar: [Velilere](veli).',
      ],
    },
    {
      heading: 'Veri',
      blocks: [
        'Grupları açan kullanıcıdan yalnız grupların çalışması için gereken bilgiler alınır; ad, doğum yılı, e-posta, telefon, okul, konum, fotoğraf ve rehber alınmaz. Reklam, analitik, pazarlama bildirimi ve izleme yoktur; bilgiler Türkiye’de tutulur ve yurt dışına gönderilmez. Grup hesabı uygulamadan hemen silinebilir ve 6 ay kullanılmazsa kendiliğinden silinir. Ayrıntılar: [Aydınlatma metni](aydinlatma) · [Saklama ve imha politikası](saklama).',
      ],
    },
    {
      heading: 'Çocuk güvenliği irtibat kişisi',
      blocks: [`${C.name} · ${C.contact} · [İletişim](iletisim)`],
    },
  ],
};
