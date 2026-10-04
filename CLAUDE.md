# CLAUDE.md — Etüt

Sınav öğrencileri için çalışma sayacı + deneme net takibi. Expo SDK 57, TypeScript strict,
expo-router. Kurulum, komutlar ve yayın hattı: `README.md`.

## Mimari özet

- **Arka uç yok (v0).** Ağ çağrısı, analitik, hata raporlama, push, reklam SDK'sı, EAS
  (Build/Update) ve Expo hesabı gerektiren hiçbir şey ekleme. Veri yalnız cihazda.
- `src/domain/` — saf TypeScript, React/Expo importu yok. Tüm iş kuralları burada ve testli:
  - `timer.ts`: süre = zaman damgası − duraklatmalar (asla sayaç tıklamasıyla toplanmaz);
    arka plan kuralı: ≤10 sn tolerans, daha uzunu otomatik "away" molası + "Çalışıyordum" ile geri ekleme.
    Uygulama arka plan olayı olmadan ölürse (zorla kapatma, çökme) soğuk açılışta son
    `lastSeenAt` kalp atışından (5 sn'de bir) sonrası aynı kurala girer (`onAppLaunch`).
  - `istanbul-day.ts`: gün sınırı Europe/Istanbul gece yarısı (sabit UTC+3, DST yok).
  - `daily-totals.ts`: günlük/ders toplamları, gece yarısını aşan oturumu böler.
  - `net.ts`: net = doğru − yanlış/4; TYT/AYT/YDT bölüm ve soru sayıları.
  - `profile.ts`: yaş kuralı (yalnız doğum yılı; belirsizlikte düşük yaş → 15 altı "solo").
- `src/storage/` — `db.ts` (expo-sqlite, `PRAGMA user_version` göçleri; yeni göçü listenin
  sonuna ekle, eskisini değiştirme), `kv.ts` (expo-sqlite/kv-store, senkron: profil ve aktif oturum).
- `src/state/app-state.tsx` — domain ile depolama arasında ince yapıştırıcı; iş kuralı yazma.
- `app/` — ekranlar. Profil yoksa yalnız `onboarding` erişilebilir (`Stack.Protected`).
- `src/strings.ts` — kullanıcıya görünen **tüm** metinler burada; ekranlara metin gömme.

## Ürün/hukuk kuralları

Uyulacak tasarım kuralları: `..\hukuk\03-tasarim-kurallari.md` (bu deponun dışında, salt okunur).
Bu iskelette özellikle:
- K-01/K-02: ana ekran kişisel sayaç; gruplar ikincil ve isteğe bağlı sekme.
- K-15: nötr doğum yılı seçimi, önceden seçili değer yok, yaş ipucu yok.
- K-16: 15 yaş altı → gruplar sekmesi hiç görünmez, veri cihazda, sıfır telemetri.
- K-19: tam doğum tarihi, kimlik, biyometri yok.
- K-09/K-13: sohbet/yorum/akış yok; metinlerde "sosyal ağ / topluluk" dili yok.
Bu listede "yapma" denen bir şey eklenecekse önce bny'ye sor.

## Çalışma kuralları

- Paket eklerken `npx expo install <paket>`; yeni yerel (native) modül eklemeden önce düşün —
  her biri iOS derlemesini CI'da riske atar ve yalnız TestFlight'ta denenebilir.
- Bitti demeden önce: `npx tsc --noEmit`, `npx jest`, `npx expo-doctor`,
  `npx expo export --platform ios` (çıktı `dist/`, git'e girmez).
- Expo API'leri sürümden sürüme değişir; hafızadan yazma, `https://docs.expo.dev/versions/v57.0.0/` belgelerine bak.
- **Windows'ta iOS yerelde derlenemez** (`expo prebuild --platform ios` Windows'ta çalışmaz,
  Xcode yok). iOS yalnız `.github/workflows/testflight.yml` ile macOS koşucusunda derlenir.
  `ios/` ve `android/` üretilen klasörlerdir; elle oluşturma, git'e koyma.
- TypeScript 6 `types` varsayılanını boş yaptığı için `tsconfig.json` içinde `"types": ["jest"]` gerekli.
