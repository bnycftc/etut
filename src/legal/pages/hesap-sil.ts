/**
 * "Hesabını silme" (/hesap-sil; hukuk/03 K-37, Google Play's account deletion URL): how the group
 * account is deleted in the app and, once the app is gone, by e-mailing the account code; what
 * goes at once and what stays, for how long.
 *
 * Checked against the code: public.delete_my_account → app.delete_account and
 * app.delete_by_account_code (migration 20261020120200_etut_account_code; cascade over every
 * app.* table, groups handed to the oldest member, reports keep no person, GoTrue's audit rows
 * go too), audit.deletion_records (3 years), the survivors of AFTER_DELETION (_shared.ts) and the
 * retention table of saklama.ts (e-mails 1 year, KVKK applications 3 years), app.purge_expired
 * (anonymous group account and parent account: 6 months without use). The code card is
 * src/ui/account-code-card.tsx, placed under Gruplar → Grup hesabı by the integration step.
 */

import { AFTER_DELETION, C, LEGAL_PAGES_UPDATED, type LegalPage } from './_shared';

export const page: LegalPage = {
  slug: 'hesap-sil',
  title: 'Hesabını silme',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Hesap silme', order: 8 },
  intro: [
    `Bu sayfa ${C.name} tarafından geliştirilen Etüt uygulaması içindir. Etüt’te hesap yalnız grupları açarsan oluşur: Türkiye’deki sunucumuzda takma adınla bir grup hesabı. Grupları hiç açmadıysan sunucuda sana ait bir kayıt tutulmaz; telefonundaki kayıtları Ayarlar → Tüm verileri sil ya da uygulamayı kaldırmak siler.`,
  ],
  sections: [
    {
      heading: 'Yol 1: Uygulama telefonundaysa',
      blocks: [
        {
          list: [
            'Uygulamayı aç ve Gruplar sekmesine gir.',
            'Grup hesabı bölümünde Grup hesabımı sil’e dokun.',
            'Ekrandaki özeti oku ve Evet, sunucudan sil ile onayla.',
          ],
        },
        'Grup hesabın o an kalıcı olarak silinir. Bu yol telefondaki kayıtlarına dokunmaz. Telefondakileri de silmek istersen Ayarlar → Tüm verileri sil ile ikisini birlikte silebilirsin.',
      ],
    },
    {
      heading: 'Yol 2: Uygulamayı sildiysen ya da açamıyorsan',
      blocks: [
        'Grup hesabın anonimdir: e-posta, telefon ya da başka bir hesapla bağlı değildir. Hesabın sana ait olduğunu bu yüzden yalnız hesap kodu gösterir.',
        {
          list: [
            'Hesap kodu, uygulamada Gruplar → Grup hesabı bölümünde gösterilen 12 karakterlik koddur. Kalıcıdır; uygulamayı silmeden önce bir yere not etmeni öneririz.',
            `Kodu ${C.contact} adresine e-postayla gönder. Başka bir bilgi gerekmez.`,
            'Kod bir grup hesabıyla eşleşirse o hesabı en geç 30 gün içinde sileriz ve e-postana cevap veririz. Eşleşmezse hiçbir hesap silinmez.',
            'Kodu kimseyle paylaşma: kodu bilen herkes hesabının silinmesini isteyebilir.',
          ],
        },
        'Kodun yoksa hesabın sana ait olduğunu güvenli biçimde doğrulayamayız. Başkasının hesabını yanlışlıkla silmemek için böyle bir isteği işleme alamayız. Uygulama telefonunda değilken hesabına kimse giremez; 6 ay hiç kullanılmayan grup hesabı kendiliğinden, bağlı bilgilerle birlikte silinir. O zamana kadar takma adın üyesi olduğun grupların listesinde görünür ve çalışma süren artmaz; grubun kurucusu seni gruptan çıkarabilir.',
        'Veli olarak bağlandıysan veli hesabın da son kullanımından 6 ay sonra kendiliğinden silinir.',
      ],
    },
    {
      heading: 'Hemen silinenler',
      blocks: [
        {
          list: [
            'Takma adın, yaş bandın ve bildirildiği yıl, grup ayarların.',
            'Grup üyeliklerin ve katılma isteklerin.',
            'Çalışma oturumların, günlük toplamların, grup sıralamalarındaki yerin ve canlı durumun.',
            'Gönderdiğin ve sana gönderilen hazır tepkiler.',
            'Engellemelerin ve seni engelleyenlerin kaydı.',
            'Veli bağlantın, velinin koyduğu ayarlar ve veli bağlantı kodu. Bağlı velin yalnız hesabını sildiğini görür.',
            'Hesap kodun ve oturum anahtarların.',
          ],
        },
        'Kurduğun bir grupta başka üye varsa kuruculuk en eski üyeye geçer; tek kişi kaldıysan grup da silinir.',
      ],
    },
    {
      heading: 'Bir süre daha saklananlar',
      blocks: [
        { list: AFTER_DELETION },
        {
          table: {
            head: ['Kayıt', 'Saklama süresi', 'Neden'],
            rows: [
              [
                'Silme kaydı (hesap numarası, silme isteğinin ve silmenin zamanı, silmenin yolu)',
                '3 yıl',
                'Mevzuat, silme işlemlerinin kaydının en az 3 yıl tutulmasını ister',
              ],
              ['Silme için bize yazdığın e-posta ve cevabımız', 'Konu kapandıktan sonra 1 yıl', 'İsteğin ve cevabın kanıtı'],
              ['KVKK başvuruların ve cevaplarımız', '3 yıl', 'Başvurunun ve cevabın kanıtı'],
            ],
          },
        },
        'Sunucuda kalan bu kayıtlarda takma adın yoktur; yalnız rastgele bir hesap numarası vardır. Süresi dolan kayıtları her gün kendiliğinden çalışan bir temizlik işi siler. Bütün süreler: [Saklama ve imha politikası](saklama).',
      ],
    },
    {
      heading: 'Yalnız bazı bilgilerini silmek',
      blocks: [
        {
          list: [
            'Telefonda sildiğin bir çalışma oturumu sunucudan da hemen silinir.',
            'Bir gruptan çıktığında o gruptaki üyeliğin hemen silinir.',
            'Veli bağlantını Gruplar ekranından kaldırabilirsin.',
          ],
        },
        `Sorular ve diğer talepler: ${C.contact} · [İletişim](iletisim)`,
      ],
    },
  ],
};
