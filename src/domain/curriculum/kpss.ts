/*
 * KPSS Genel Yetenek – Genel Kültür (GY-GK) konu listesi.
 * (Eğitim Bilimleri, ÖABT ve Alan Bilgisi testleri kapsam dışıdır.)
 *
 * Kaynaklar (erişim: 2026-10-04):
 * - ÖSYM KPSS kılavuzu (GY: Türkçe 30, Matematik 30; GK: Tarih 27, Coğrafya 18, Vatandaşlık 9,
 *   Güncel Bilgiler 6): https://www.osym.gov.tr/ (dağılım ikincil kaynaklardan; kılavuz doğrudan
 *   açılmadı).
 * - Yaygın konu listeleri (karşılaştırma için):
 *   https://kpssasistanim.com/blog/2026-kpss-konulari-ve-soru-dagilimi
 *   https://denemekpss.com/blog/kpss-gy-gk-konulari-ve-soru-dagilimi.html
 *   https://kpsshazirlik.com.tr/kpss-konulari
 *   https://www.xyzakademi.com.tr/kpss-konulari/
 *
 * Notlar:
 * - KPSS'de geometri ayrı test değildir; Matematik testindeki geometri soruları "Geometri: ..."
 *   önekiyle matematik listesine eklendi.
 * - Lisans, önlisans ve ortaöğretim GY-GK oturumları aynı ders başlıklarını kullanır; soru
 *   dağılımı ve zorluk farklıdır. Vatandaşlık konuları 2017 anayasa değişikliği sonrası
 *   Cumhurbaşkanlığı Hükümet Sistemi'ne göredir.
 * - Güncel Bilgiler sabit bir müfredata bağlı değildir; yalnız genel başlıklar verildi.
 */
import type { SubjectTopics } from './types';

export const KPSS_TOPICS: SubjectTopics = {
  turkce: [
    { id: 'kpss.turkce.sozcukte-anlam', name: 'Sözcükte Anlam' },
    { id: 'kpss.turkce.cumlede-anlam', name: 'Cümlede Anlam' },
    { id: 'kpss.turkce.paragrafta-anlam', name: 'Paragrafta Anlam' },
    { id: 'kpss.turkce.paragraf-yapisi', name: 'Paragrafta Yapı (Sıralama, Bölme, Tamamlama)' },
    { id: 'kpss.turkce.ses-bilgisi', name: 'Ses Bilgisi' },
    { id: 'kpss.turkce.yapi-bilgisi', name: 'Yapı Bilgisi (Kök, Ek, Gövde)' },
    { id: 'kpss.turkce.isim-soylu-sozcukler', name: 'İsim Soylu Sözcükler' },
    { id: 'kpss.turkce.fiiller', name: 'Fiiller ve Fiilimsiler' },
    { id: 'kpss.turkce.edat-baglac-unlem', name: 'Edat, Bağlaç, Ünlem' },
    { id: 'kpss.turkce.cumlenin-ogeleri', name: 'Cümlenin Ögeleri' },
    { id: 'kpss.turkce.cumle-turleri', name: 'Cümle Türleri' },
    { id: 'kpss.turkce.yazim-kurallari', name: 'Yazım Kuralları' },
    { id: 'kpss.turkce.noktalama', name: 'Noktalama İşaretleri' },
    { id: 'kpss.turkce.anlatim-bozukluklari', name: 'Anlatım Bozuklukları' },
    { id: 'kpss.turkce.sozel-mantik', name: 'Sözel Mantık' },
  ],
  matematik: [
    { id: 'kpss.matematik.temel-kavramlar', name: 'Temel Kavramlar' },
    { id: 'kpss.matematik.sayi-basamaklari', name: 'Sayı Basamakları' },
    { id: 'kpss.matematik.bolme-bolunebilme', name: 'Bölme ve Bölünebilme' },
    { id: 'kpss.matematik.asal-carpanlar', name: 'Asal Çarpanlara Ayırma' },
    { id: 'kpss.matematik.ebob-ekok', name: 'EBOB – EKOK' },
    { id: 'kpss.matematik.rasyonel-sayilar', name: 'Rasyonel Sayılar' },
    { id: 'kpss.matematik.ondalik-sayilar', name: 'Ondalık Sayılar' },
    { id: 'kpss.matematik.basit-esitsizlikler', name: 'Basit Eşitsizlikler' },
    { id: 'kpss.matematik.mutlak-deger', name: 'Mutlak Değer' },
    { id: 'kpss.matematik.uslu-sayilar', name: 'Üslü Sayılar' },
    { id: 'kpss.matematik.koklu-sayilar', name: 'Köklü Sayılar' },
    { id: 'kpss.matematik.carpanlara-ayirma', name: 'Çarpanlara Ayırma' },
    { id: 'kpss.matematik.denklem-cozme', name: 'Birinci Dereceden Denklemler' },
    { id: 'kpss.matematik.oran-oranti', name: 'Oran – Orantı' },
    { id: 'kpss.matematik.sayi-problemleri', name: 'Sayı ve Kesir Problemleri' },
    { id: 'kpss.matematik.yas-problemleri', name: 'Yaş Problemleri' },
    { id: 'kpss.matematik.isci-problemleri', name: 'İşçi Problemleri' },
    { id: 'kpss.matematik.yuzde-kar-zarar', name: 'Yüzde ve Kâr – Zarar Problemleri' },
    { id: 'kpss.matematik.karisim-problemleri', name: 'Karışım Problemleri' },
    { id: 'kpss.matematik.hareket-problemleri', name: 'Hareket Problemleri' },
    { id: 'kpss.matematik.kumeler', name: 'Kümeler' },
    { id: 'kpss.matematik.fonksiyonlar', name: 'Fonksiyonlar ve İşlem' },
    { id: 'kpss.matematik.moduler-aritmetik', name: 'Modüler Aritmetik' },
    { id: 'kpss.matematik.permutasyon-kombinasyon', name: 'Permütasyon ve Kombinasyon' },
    { id: 'kpss.matematik.olasilik', name: 'Olasılık' },
    { id: 'kpss.matematik.tablo-grafik', name: 'Tablo ve Grafik Yorumlama' },
    { id: 'kpss.matematik.sayisal-mantik', name: 'Sayısal Mantık' },
    { id: 'kpss.matematik.geometri-acilar-ucgenler', name: 'Geometri: Açılar ve Üçgenler' },
    { id: 'kpss.matematik.geometri-dortgenler', name: 'Geometri: Çokgenler ve Dörtgenler' },
    { id: 'kpss.matematik.geometri-cember-daire', name: 'Geometri: Çember ve Daire' },
    { id: 'kpss.matematik.geometri-analitik', name: 'Geometri: Analitik Geometri' },
    { id: 'kpss.matematik.geometri-kati-cisimler', name: 'Geometri: Katı Cisimler' },
  ],
  tarih: [
    { id: 'kpss.tarih.islamiyet-oncesi', name: 'İslamiyet Öncesi Türk Tarihi' },
    { id: 'kpss.tarih.ilk-turk-islam-devletleri', name: 'İlk Türk-İslam Devletleri' },
    { id: 'kpss.tarih.turkiye-selcuklu', name: 'Türkiye Selçuklu Devleti' },
    { id: 'kpss.tarih.osmanli-kurulus', name: 'Osmanlı Devleti Kuruluş Dönemi' },
    { id: 'kpss.tarih.osmanli-yukselme', name: 'Osmanlı Devleti Yükselme Dönemi' },
    { id: 'kpss.tarih.osmanli-kultur-medeniyet', name: 'Osmanlı Kültür ve Medeniyeti' },
    { id: 'kpss.tarih.osmanli-17-yuzyil', name: '17. Yüzyılda Osmanlı (Duraklama)' },
    { id: 'kpss.tarih.osmanli-18-yuzyil', name: '18. Yüzyılda Osmanlı (Gerileme)' },
    { id: 'kpss.tarih.osmanli-19-yuzyil', name: '19. Yüzyılda Osmanlı (Dağılma)' },
    { id: 'kpss.tarih.osmanli-20-yuzyil', name: '20. Yüzyılda Osmanlı (Trablusgarp, Balkan ve I. Dünya Savaşı)' },
    { id: 'kpss.tarih.kurtulus-savasi-hazirlik', name: 'Kurtuluş Savaşı Hazırlık Dönemi' },
    { id: 'kpss.tarih.kurtulus-savasi-muharebeler', name: 'Kurtuluş Savaşı Muharebeler Dönemi' },
    { id: 'kpss.tarih.lozan', name: 'Mudanya Ateşkesi ve Lozan Barış Antlaşması' },
    { id: 'kpss.tarih.ataturk-inkilaplari', name: 'Atatürk İnkılapları' },
    { id: 'kpss.tarih.ataturk-ilkeleri', name: 'Atatürk İlkeleri' },
    { id: 'kpss.tarih.ataturk-donemi-ic-politika', name: 'Atatürk Dönemi İç Politika' },
    { id: 'kpss.tarih.ataturk-donemi-dis-politika', name: 'Atatürk Dönemi Dış Politika' },
    { id: 'kpss.tarih.cagdas-turk-dunya', name: 'Çağdaş Türk ve Dünya Tarihi' },
  ],
  cografya: [
    { id: 'kpss.cografya.cografi-konum', name: 'Türkiye’nin Coğrafi Konumu' },
    { id: 'kpss.cografya.yer-sekilleri', name: 'Türkiye’nin Yer Şekilleri' },
    { id: 'kpss.cografya.iklim-bitki-ortusu', name: 'Türkiye’nin İklimi ve Bitki Örtüsü' },
    { id: 'kpss.cografya.su-toprak', name: 'Su Kaynakları ve Topraklar' },
    { id: 'kpss.cografya.nufus', name: 'Türkiye’de Nüfus' },
    { id: 'kpss.cografya.yerlesme-goc', name: 'Yerleşme ve Göç' },
    { id: 'kpss.cografya.tarim', name: 'Tarım' },
    { id: 'kpss.cografya.hayvancilik', name: 'Hayvancılık' },
    { id: 'kpss.cografya.madenler-enerji', name: 'Madenler ve Enerji Kaynakları' },
    { id: 'kpss.cografya.sanayi', name: 'Sanayi' },
    { id: 'kpss.cografya.ulasim-ticaret', name: 'Ulaşım ve Ticaret' },
    { id: 'kpss.cografya.turizm', name: 'Turizm' },
    { id: 'kpss.cografya.bolgeler-projeler', name: 'Bölgeler ve Kalkınma Projeleri' },
    { id: 'kpss.cografya.dogal-afetler', name: 'Doğal Afetler ve Çevre Sorunları' },
  ],
  vatandaslik: [
    { id: 'kpss.vatandaslik.hukukun-temel-kavramlari', name: 'Hukukun Temel Kavramları' },
    { id: 'kpss.vatandaslik.devlet-bicimleri', name: 'Devlet Biçimleri ve Hükümet Sistemleri' },
    { id: 'kpss.vatandaslik.anayasa-tarihi', name: 'Türk Anayasa Tarihi' },
    { id: 'kpss.vatandaslik.anayasa-1982-ilkeler', name: '1982 Anayasası’nın Temel İlkeleri' },
    { id: 'kpss.vatandaslik.temel-hak-odevler', name: 'Temel Hak ve Ödevler' },
    { id: 'kpss.vatandaslik.yasama', name: 'Yasama' },
    { id: 'kpss.vatandaslik.yurutme', name: 'Yürütme' },
    { id: 'kpss.vatandaslik.yargi', name: 'Yargı' },
    { id: 'kpss.vatandaslik.idare-hukuku', name: 'İdari Yapı ve İdare Hukuku' },
  ],
  guncel: [
    { id: 'kpss.guncel.turkiye-gundemi', name: 'Türkiye Gündemi ve Önemli Gelişmeler' },
    { id: 'kpss.guncel.dunya-gundemi', name: 'Dünya Gündemi ve Uluslararası Kuruluşlar' },
    { id: 'kpss.guncel.ekonomi-projeler', name: 'Ekonomi ve Büyük Projeler' },
    { id: 'kpss.guncel.bilim-teknoloji', name: 'Bilim, Teknoloji ve Sağlık' },
    { id: 'kpss.guncel.kultur-sanat-spor', name: 'Kültür, Sanat ve Spor' },
  ],
};
