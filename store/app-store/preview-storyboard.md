# App Store önizleme videosu: storyboard (Etüt 0.5.0)

Amaç: inceleyici ve kullanıcı ilk 30 saniyede çekirdek döngüyü görsün: sınav seç → örnek verilerle
dolu uygulama → plandan bir derse başla → netler ve kaçırılan konular → konu ağacı ve net hesapla →
haftalık plan. Abartı, çizilmiş cihaz ya da çizilmiş kilit ekranı yok; yalnız uygulamanın gerçek
ekran kaydı (App Review 2.3.3, 2.3.4).

- Cihaz: iPhone 6.9" simülatör (iPhone 17 Pro Max ya da 16 Pro Max), Türkçe, açık mod, durum
  çubuğu 9:41 (`.github/workflows/store-screenshots.yml` ile aynı hazırlık).
- Akış: `e2e/store/preview.yaml` (Maestro). Pazartesi–Cumartesi, İstanbul saatiyle 04:00'ten sonra
  koşulur: örnek planda Pazar dinlenme günüdür ve örnek veride bugünün çalışması sabahtan başlar.
- Teslim: 886 × 1920, 30 fps, H.264, 25–30 sn, sessiz ya da yalnız uygulama sesi (App Preview,
  iPhone 6.9" `IPHONE_67` seti).

## Sahneler

| Süre | Ekran | Ne görünür | Akıştaki adım |
|---|---|---|---|
| 0–4 sn | Onboarding | YKS → Sayısal → İleri; "YKS'ye N gün" geri sayımı | `exam-type-YKS`, `yks-area-sayisal`, `onboarding-next`, `onboarding-countdown` |
| 4–9 sn | Onboarding son adım → Sayaç | Doğum yılı, "Örnek verilerle gez", dolu ana ekran (bugün, seri, hedef halkası, Bugünün planı) | `birth-year-<yıl>`, `onboarding-demo`, `timer-screen` |
| 9–14 sn | Sayaç | Bugünün planında ilk blokta "Başlat"; sayaç o ders ve konuyla çalışır | `plan-block-start-0`, `timer-clock` |
| 14–20 sn | Denemeler | Net grafiği, ardından "En çok yanlış yaptığın konular" | `tab-exams`, `exams-chart`, `missed-window` |
| 20–25 sn | Net hesapla → Ders karnesi → Konular → Konu detayı | Doğru/yanlış girilir, net çıkar; konu listesi ve bir konunun detayı | `exams-net-calc`, `net-calc`, `open-report`, `report-open-topics`, `topics-screen`, `topic-row-*`, `topic-detail` |
| 25–28 sn | Plan sekmesi | Haftanın planı gün gün | `tab-plan`, `plan-week` |

Kilit ekranı Live Activity ve Dynamic Island bu videoda yok: simülatör kaydı SpringBoard
sunumunu güvenilir göstermiyor ve ekran görüntüsü akışında da yalnız isteğe bağlı kırpma olarak
alınabiliyor. İnceleme notlarının 4. adımı onu gerçek iPhone'da gösterir. Kayıt bunu
gösterebiliyorsa (gerçek cihaz kaydı) 9–14 sn sahnesinin sonuna en çok 2 sn eklenebilir; toplam
30 sn'yi aşmamalı.

## Kayıt (macOS, Xcode 26)

```sh
# Simülatör hazır, uygulama kurulu, durum çubuğu sabit (store-screenshots.yml adımları).
xcrun simctl io booted recordVideo --codec=h264 --force raw-preview.mp4 &
REC=$!
maestro test e2e/store/preview.yaml
kill -INT $REC; wait $REC

# Akışın boşta geçen başını/sonunu kes (-ss/-to kayda bakılarak), 886x1920 30 fps'e çevir.
ffmpeg -ss <başlangıç> -to <bitiş> -i raw-preview.mp4 \
  -vf "scale=886:1920:flags=lanczos,fps=30,format=yuv420p" \
  -c:v libx264 -profile:v high -crf 18 -an 01-onizleme.mp4
```

- Maestro'nun kendi bekleme süreleri yüzünden ham kayıt 30 sn'den uzun çıkar: sahneleri
  tablodaki sürelere göre kırp (ör. `-ss/-to` ile parçala, `concat` ile birleştir). Sahne sırası
  değişmez, hızlandırma yapılmaz.
- Çıktı 15–30 sn olmalı; değilse App Store Connect reddeder.
- Dosya adı `NN-ad.mp4` (ör. `01-onizleme.mp4`); `asc-screenshots.yml` `target: preview-iphone`
  ile yalnız bu biçimi alır (en çok 3 video).
- Videoda örnek veri bandı ("Örnek veriler · Çık") görünür: bu gerçek ekrandır, gizlenmez.
