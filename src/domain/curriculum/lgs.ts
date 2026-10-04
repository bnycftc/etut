/*
 * LGS (Liselere Geçiş Sistemi merkezî sınavı) konu listesi – 8. sınıf.
 *
 * Kaynaklar (erişim: 2026-10-04):
 * - MEB, Merkezî Sınav Başvuru ve Uygulama Kılavuzu 2026 (sınav 8. sınıf öğretim programları esas
 *   alınarak; 1. oturum Türkçe, T.C. İnkılap Tarihi ve Atatürkçülük, Din Kültürü, Yabancı Dil;
 *   2. oturum Matematik, Fen Bilimleri; toplam 90 soru). PDF metin olarak okunamadı; bu özet
 *   ikincil kaynaklardaki aktarımlara dayanır:
 *   https://www.meb.gov.tr/meb_iys_dosyalar/2026_04/03170012_LGS_Basvuru_ve_Uygulama_Kilavuzu_2026_.pdf
 * - MEB ODSGM LGS örnek soruları: https://odsgm.meb.gov.tr/www/lgs-kapsamindaki-merkezi-sinava-yonelik-ornek-sorular-yayimlandi/icerik/1321
 * - Maarif Modeli geçişi ve LGS 2027 kapsamı (ikincil kaynaklar):
 *   https://tymm.meb.gov.tr/taslak-cerceve-planlari
 *   https://sertifika.kent.edu.tr/lgsde-yeni-mufredattan-soru-cikacak-mi-2027-2028
 *   https://www.orijinakademi.com/post/t%C3%BCrkiye-y%C3%BCzy%C4%B1l%C4%B1-maarif-modeli-lgs-yi-nas%C4%B1l-de%C4%9Fi%C5%9Ftirecek
 *
 * Kapsam notu: 2026-2027 öğretim yılında Türkiye Yüzyılı Maarif Modeli ortaokulda yalnız 5, 6 ve 7.
 * sınıflarda uygulanıyor; 8. sınıfta önceki (2018 tabanlı) öğretim programları sürüyor. Bu nedenle
 * LGS 2027 kapsamı önceki 8. sınıf programına göredir; bu liste o programın ünitelerini izler.
 * Maarif Modeli'ne uyumlu LGS'nin 2028'de başlaması bekleniyor (ikincil kaynaklar; MEB'in LGS 2027
 * kılavuzu henüz yayımlanmadı). 2028'de ünite adları değişirse yeni id'ler eklenmeli.
 * Belirsizlik: LGS'nin tüm yıl mı yoksa belirli dönem/ünitelerle mi sınırlı olacağı her yıl
 * kılavuzla duyurulur; burada 8. sınıfın tüm üniteleri listelendi.
 */
import type { SubjectTopics } from './types';

export const LGS_TOPICS: SubjectTopics = {
  turkce: [
    { id: 'lgs.turkce.sozcukte-anlam', name: 'Sözcükte Anlam' },
    { id: 'lgs.turkce.deyim-atasozu', name: 'Deyimler ve Atasözleri' },
    { id: 'lgs.turkce.cumlede-anlam', name: 'Cümlede Anlam' },
    { id: 'lgs.turkce.paragrafta-anlam', name: 'Paragrafta Anlam' },
    { id: 'lgs.turkce.metin-turleri', name: 'Metin Türleri' },
    { id: 'lgs.turkce.soz-sanatlari', name: 'Söz Sanatları' },
    { id: 'lgs.turkce.fiilimsiler', name: 'Fiilimsiler' },
    { id: 'lgs.turkce.cumlenin-ogeleri', name: 'Cümlenin Ögeleri' },
    { id: 'lgs.turkce.fiilde-cati', name: 'Fiilde Çatı' },
    { id: 'lgs.turkce.cumle-turleri', name: 'Cümle Türleri' },
    { id: 'lgs.turkce.yazim-kurallari', name: 'Yazım Kuralları' },
    { id: 'lgs.turkce.noktalama', name: 'Noktalama İşaretleri' },
    { id: 'lgs.turkce.anlatim-bozukluklari', name: 'Anlatım Bozuklukları' },
    { id: 'lgs.turkce.sozel-mantik', name: 'Sözel Mantık ve Görsel Okuma' },
  ],
  matematik: [
    { id: 'lgs.matematik.carpanlar-katlar', name: 'Çarpanlar ve Katlar' },
    { id: 'lgs.matematik.uslu-ifadeler', name: 'Üslü İfadeler' },
    { id: 'lgs.matematik.karekoklu-ifadeler', name: 'Kareköklü İfadeler' },
    { id: 'lgs.matematik.veri-analizi', name: 'Veri Analizi' },
    { id: 'lgs.matematik.olasilik', name: 'Basit Olayların Olma Olasılığı' },
    { id: 'lgs.matematik.cebirsel-ifadeler', name: 'Cebirsel İfadeler ve Özdeşlikler' },
    { id: 'lgs.matematik.dogrusal-denklemler', name: 'Doğrusal Denklemler' },
    { id: 'lgs.matematik.esitsizlikler', name: 'Eşitsizlikler' },
    { id: 'lgs.matematik.ucgenler', name: 'Üçgenler' },
    { id: 'lgs.matematik.eslik-benzerlik', name: 'Eşlik ve Benzerlik' },
    { id: 'lgs.matematik.donusum-geometrisi', name: 'Dönüşüm Geometrisi' },
    { id: 'lgs.matematik.geometrik-cisimler', name: 'Geometrik Cisimler' },
  ],
  fen: [
    { id: 'lgs.fen.mevsimler-iklim', name: 'Mevsimler ve İklim' },
    { id: 'lgs.fen.dna-genetik-kod', name: 'DNA ve Genetik Kod' },
    { id: 'lgs.fen.kalitim', name: 'Kalıtım' },
    { id: 'lgs.fen.mutasyon-modifikasyon', name: 'Mutasyon ve Modifikasyon' },
    { id: 'lgs.fen.adaptasyon-evrim', name: 'Adaptasyon ve Doğal Seçilim' },
    { id: 'lgs.fen.biyoteknoloji', name: 'Biyoteknoloji' },
    { id: 'lgs.fen.basinc', name: 'Basınç' },
    { id: 'lgs.fen.periyodik-sistem', name: 'Periyodik Sistem' },
    { id: 'lgs.fen.fiziksel-kimyasal-degisim', name: 'Fiziksel ve Kimyasal Değişimler' },
    { id: 'lgs.fen.kimyasal-tepkimeler', name: 'Kimyasal Tepkimeler' },
    { id: 'lgs.fen.asitler-bazlar', name: 'Asitler ve Bazlar' },
    { id: 'lgs.fen.maddenin-isi-etkilesimi', name: 'Maddenin Isı ile Etkileşimi' },
    { id: 'lgs.fen.kimya-endustrisi', name: 'Türkiye’de Kimya Endüstrisi' },
    { id: 'lgs.fen.basit-makineler', name: 'Basit Makineler' },
    { id: 'lgs.fen.besin-zinciri-enerji', name: 'Besin Zinciri ve Enerji Akışı' },
    { id: 'lgs.fen.fotosentez-solunum', name: 'Fotosentez ve Solunum' },
    { id: 'lgs.fen.madde-donguleri', name: 'Madde Döngüleri ve Çevre Sorunları' },
    { id: 'lgs.fen.surdurulebilir-kalkinma', name: 'Sürdürülebilir Kalkınma' },
    { id: 'lgs.fen.elektrik-yukleri', name: 'Elektrik Yükleri ve Elektriklenme' },
    { id: 'lgs.fen.elektrik-enerjisi', name: 'Elektrik Enerjisinin Dönüşümü' },
  ],
  inkilap: [
    { id: 'lgs.inkilap.bir-kahraman-doguyor', name: 'Bir Kahraman Doğuyor' },
    { id: 'lgs.inkilap.milli-uyanis', name: 'Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar' },
    { id: 'lgs.inkilap.milli-bir-destan', name: 'Millî Bir Destan: Ya İstiklal Ya Ölüm!' },
    { id: 'lgs.inkilap.ataturkculuk-cagdaslasma', name: 'Atatürkçülük ve Çağdaşlaşan Türkiye' },
    { id: 'lgs.inkilap.demokratiklesme', name: 'Demokratikleşme Çabaları' },
    { id: 'lgs.inkilap.dis-politika', name: 'Atatürk Dönemi Türk Dış Politikası' },
    { id: 'lgs.inkilap.ataturkun-olumu', name: 'Atatürk’ün Ölümü ve Sonrası' },
  ],
  din: [
    { id: 'lgs.din.kader-inanci', name: 'Kader İnancı' },
    { id: 'lgs.din.zekat-sadaka', name: 'Zekât ve Sadaka' },
    { id: 'lgs.din.din-ve-hayat', name: 'Din ve Hayat' },
    { id: 'lgs.din.hz-muhammedin-ornekligi', name: 'Hz. Muhammed’in Örnekliği' },
    { id: 'lgs.din.kuran-ozellikleri', name: 'Kur’an-ı Kerim ve Özellikleri' },
  ],
  yabanci_dil: [
    { id: 'lgs.yabanci_dil.friendship', name: 'Friendship' },
    { id: 'lgs.yabanci_dil.teen-life', name: 'Teen Life' },
    { id: 'lgs.yabanci_dil.in-the-kitchen', name: 'In the Kitchen' },
    { id: 'lgs.yabanci_dil.on-the-phone', name: 'On the Phone' },
    { id: 'lgs.yabanci_dil.the-internet', name: 'The Internet' },
    { id: 'lgs.yabanci_dil.adventures', name: 'Adventures' },
    { id: 'lgs.yabanci_dil.tourism', name: 'Tourism' },
    { id: 'lgs.yabanci_dil.chores', name: 'Chores' },
    { id: 'lgs.yabanci_dil.science', name: 'Science' },
    { id: 'lgs.yabanci_dil.natural-forces', name: 'Natural Forces' },
  ],
};
