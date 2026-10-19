/**
 * Retention and destruction (source: docs/hukuk/kvkk/09 §7 table, corrected to the code).
 * Server periods: app.purge_expired (latest version: round3 migration, section 6; daily at
 * 03:30 Istanbul), delete_my_account, end_presence; Caddy log roll_keep_for 9600h (400 days);
 * backups: pgBackRest repo1-retention-full=30 (time, weekly full) and restic --keep-within 30d.
 */

import { C, LEGAL_PAGES_UPDATED, type LegalPage, MAILBOX_IN_TURKEY } from './_shared';

export const page: LegalPage = {
  slug: 'saklama',
  title: 'Saklama ve imha politikası',
  updated: LEGAL_PAGES_UPDATED,
  nav: { label: 'Saklama', order: 6 },
  intro: [
    `Veri sorumlusu: ${C.name} · ${C.contact}. Bu politika Etüt kapsamında işlenen kişisel verilerin ne kadar saklandığını ve süre dolunca nasıl silindiğini anlatır. İlke: hiçbir bilgi, işlendiği amaç için gereken süreden ve kanunun öngördüğü süreden uzun tutulmaz.`,
  ],
  sections: [
    {
      heading: 'Nerede tutulur?',
      blocks: [
        {
          list: [
            'Telefonun: sayaç, deneme ve hedef kayıtların, ayarların, doğum yılın; grupları açtıysan grup hesabının giriş anahtarı ve gönderilmeyi bekleyen oturumlar.',
            'Türkiye’deki sunucumuz (yalnız grupları açarsan): grup hesabı, gruplar, çalışma süreleri, güvenlik kayıtları ve sunucu erişim kaydı.',
            'Şifreli yedekler: Türkiye’de, sunucudan ayrı bir yerde.',
            `E-posta kutumuz: bize yazdıkların. ${MAILBOX_IN_TURKEY}`,
          ],
        },
      ],
    },
    {
      heading: 'Süreler',
      blocks: [
        {
          table: {
            head: ['Bilgi', 'Saklama süresi', 'Nasıl silinir?'],
            rows: [
              ['Telefondaki kayıtlar', 'Sen silene kadar', 'Ayarlar → Tüm verileri sil ya da uygulamayı kaldırmak'],
              [
                'Yaş beyanı kaydı (yalnız 15 yaş altı beyanında, yalnız telefonda)',
                '15 yaşına gelinceye kadar',
                'O yıl gelince uygulama açılışta siler; uygulamayı kaldırınca gider',
              ],
              ['Doğum yılı, sınav türü ve alan, deneme netleri', 'Sunucuda hiç tutulmaz', '—'],
              [
                'Grup hesabı: takma ad, yaş bandı ve bildirildiği yıl, grup ayarları',
                'Hesap açık olduğu sürece; 6 ay hiç kullanılmazsa kendiliğinden silinir',
                'Hesap silinince hemen; bağlı bilgilerle birlikte',
              ],
              ['Profili hiç oluşmamış giriş', '1 gün', 'Günlük temizlik işi'],
              [
                'Çalışma oturumları ve günlük toplamlar (ders ve konu yok)',
                'Hesap açık olduğu sürece',
                'Telefonda sildiğin oturum sunucudan da hemen; hesap silinince hemen',
              ],
              ['Grup sıralaması', 'Yalnız bugün ve bu hafta; 5 dakikada bir yeniden hesaplanır', 'Gruptan çıkan ya da kilitlenen kişi bir sonraki hesaplamada çıkar'],
              [
                'Canlı durum (o an çalışılan ders)',
                'Oturum süresince',
                'Oturum bitince silinir; bitirilemezse (ör. bağlantı koptuysa) günlük temizlik işi siler',
              ],
              ['Grup üyelikleri', 'Üyelik süresince', 'Gruptan çıkınca ya da çıkarılınca hemen'],
              ['Davet kodu', '72 saat', 'Süresi dolunca geçersiz olur; kurucu istediği an iptal eder'],
              [
                'Katılma istekleri, ret ve gruptan çıkarma kaydı',
                'Bekleyen istek oluşturulmasından, karar verilmiş istek karardan sonra 30 gün',
                'Günlük temizlik işi',
              ],
              ['Hazır tepkiler', '90 gün', 'Tamamen silinir; sayaç tutulmaz'],
              ['Engellemeler', 'Kaldırılana ya da iki hesaptan biri silinene kadar', 'Hemen'],
              [
                'Bildirimler (raporlar) ve kararlar',
                'Açık bildirim karara kadar (hedef 24 saat); kapandıktan sonra 2 yıl',
                'Günlük temizlik işi; hesabı silinen kişiyle bağlantısı hemen kaldırılır',
              ],
              ['Veli bağlantı kodu', '10 dakika', 'Kullanılınca hemen; süresi dolan kod günlük temizlik işiyle'],
              [
                'Veli bağlantısı ve velinin ayarları',
                'Bağlantı süresince',
                'Veli ya da öğrenci kaldırınca, biri hesabını silince ya da öğrenci 18 yaşını doldurunca hemen',
              ],
              ['Veli hesabı', 'Velinin son kullanımından 6 ay', 'Günlük temizlik işi'],
              ['Veliye giden bağlantı bildirimleri (yalnız ne olduğu ve tarihi)', '90 gün', 'Günlük temizlik işi'],
              ['Sınır sayaçları (deneme ve gönderim sınırları için)', '2 gün', 'Günlük temizlik işi'],
              [
                'Güvenlik kayıtları (işlem, zaman, hesap numarası, IP adresi)',
                '395 gün; hesap silinse de',
                'Günlük temizlik işi',
              ],
              [
                'Sunucu erişim kaydı (IP adresi ve port, zaman, istenen adres, veri miktarı)',
                '400 gün; hesap silinse de',
                'Kayıt dosyaları süresi dolunca kendiliğinden silinir',
              ],
              ['İmha kaydı (yalnız tarih, veri türü, kaç kayıt silindiği, yöntem)', '3 yıl', 'Günlük temizlik işi'],
              ['Şifreli yedekler', '30 günlük döngü', 'Döngüyle; silinen bilgi en geç 40 gün içinde yedeklerden de çıkar'],
              ['Bize yazdığın e-postalar', 'Konu kapandıktan sonra 1 yıl', 'Elle'],
              ['KVKK başvuruları ve cevaplarımız', '3 yıl', 'Elle'],
            ],
          },
        },
        'Güvenlik kayıtları ve sunucu erişim kaydı, saldırıları geriye dönük inceleyebilmek ve 5651 sayılı Kanun kapsamında yer sağlayıcı sayılmamız ihtimalinde trafik bilgisini en az 1 yıl saklama yükümlülüğünü karşılamak için tutulur; yalnız yasal bir talep ya da güvenlik incelemesi için açılır. Erişim kaydına istek içeriği ve başlıkları yazılmaz.',
      ],
    },
    {
      heading: 'Nasıl silinir?',
      blocks: [
        {
          list: [
            'Veritabanında satır silinir; hesaba bağlı bütün satırlar zincirleme olarak birlikte silinir.',
            'Süresi dolan kayıtları her gün kendiliğinden çalışan bir temizlik işi siler. Her silme imha kaydına yazılır: tarih, veri türü, silinen kayıt sayısı ve yöntem; kişisel veri yazılmaz.',
            'Kayıt dosyaları süresi dolunca döndürülerek silinir.',
            'Yedekler şifrelidir ve 30 günlük döngüyle yenilenir; eski yedekler silinir.',
            'Telefondaki kayıtları Ayarlar → Tüm verileri sil siler; grupları açtıysan aynı işlem sunucudaki grup hesabını da siler.',
          ],
        },
      ],
    },
    {
      heading: 'Gözden geçirme',
      blocks: [
        'Bu politikayı yılda bir gözden geçirir, süreler ya da yöntemler değişirse güncelleriz. Sorumlu kişi veri sorumlusunun kendisidir. Haklarını ve başvuru yolunu [Aydınlatma metni](aydinlatma) anlatır.',
      ],
    },
  ],
};
