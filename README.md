# Etüt

Sınav öğrencileri (YKS öncelikli) için çalışma süresi sayacı ve deneme net takibi.
v0: **arka uç yok**, her şey cihazda (expo-sqlite). Ağ çağrısı, analitik, hata raporlama,
reklam, EAS yok. Arayüz Türkçe.

- Expo SDK 57 (React Native 0.86, New Architecture), TypeScript strict, expo-router
- iOS bundle id `com.bnycftc.etut`, Apple takımı `26322AY3MH`
- iOS derlemesi GitHub Actions macOS koşucusunda yapılır ve TestFlight'a yüklenir

## Kurulum

Gereken: Node 24 (`.nvmrc`), npm. Küresel paket gerekmez; her şey `npx` ile çalışır.

```powershell
npm ci
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npx tsc --noEmit` | Tip denetimi |
| `npx jest` | Alan (domain) birim testleri (`src/domain/__tests__`) |
| `npx expo-doctor` | Bağımlılık ve yapılandırma denetimi |
| `npx expo export --platform ios` | iOS JS paketini `dist/` altına üretir (yerel derleme olmadan doğrulama) |
| `npm run web` | Web önizlemesi, sabit port 8081 (`http://localhost:8081`; `npx expo start --web` de çalışır) |
| `npm run test:web` | Web duman testi: geliştirme sunucusunu kendisi açar/kapatır, Playwright ile uygulamayı dener |
| `npm run test:all` | `tsc` + `jest --ci` + `test:web` |
| `npm run test:db` | Arka uç SQL testleri (pgTAP, `npx supabase test db`; Docker + `npx supabase start` gerekir) |
| `npm run test:db:pglite` | Aynı pgTAP testleri Docker olmadan, PGlite (WebAssembly Postgres) üzerinde |
| `npm run test:backend` | supabase-js ile yerel yığına karşı uçtan uca test; Docker/yığın yoksa **ATLANDI** yazar |
| `npx expo install <paket>` | SDK ile uyumlu sürümle paket ekler (npm install yerine bunu kullanın) |

**Windows notu:** iOS projesi (`ios/`) Windows'ta üretilemez ve derlenemez
(`expo prebuild --platform ios` Windows'ta reddedilir). iOS yalnız CI'da derlenir.
Expo Go da kullanılmaz; uygulama doğrudan TestFlight derlemesiyle denenir.

**Web notu:** Web yalnız geliştirme/test önizlemesidir (yayın hedefi değil). Mobil ile aynı
`src/storage/db.ts` / `kv.ts`, aynı şema ve göçler çalışır: expo-sqlite web'de SQLite'ı (wa-sqlite)
bir worker'da çalıştırır ve veriyi tarayıcının OPFS'inde (origin private file system) kalıcı tutar.
Bunun için iki şey gerekir, ikisi de hazır:
- Sayfa çapraz köken yalıtımlı olmalı (`SharedArrayBuffer`). Metro'nun `server.enhanceMiddleware`
  kancası HTML belgesine ulaşmaz (belgeyi Expo CLI'nin kendi ara katmanı döndürür); bu yüzden
  `metro.config.js` `Cross-Origin-Opener-Policy: same-origin` ve
  `Cross-Origin-Embedder-Policy: credentialless` başlıklarını geliştirme sunucusunun tüm yanıtlarına ekler.
- Eşzamanlı SQLite çağrıları worker hazır değilken zaman aşımına uğrar; `index.web.ts` worker'ı ilk
  render'dan önce ısıtır (yerel giriş `index.ts` → `expo-router/entry`, değişmedi).

Sınırlar: Chrome/Edge/Firefox'ta çalışır (Safari `credentialless` desteklemez). Aynı tarayıcıda
uygulamayı **tek sekmede** açın: OPFS dosya tutamaçları özeldir, ikinci sekme veritabanını açamaz.
Web verisini sıfırlamak için uygulamadaki "Tüm verileri sil" ya da tarayıcıda site verilerini temizleyin.

## Yapı

```
app/                    Ekranlar (expo-router)
  _layout.tsx           Kök yığın; profil yoksa yalnız onboarding açılır
  onboarding.tsx        İlk açılış: doğum yılı, sınav türü, YKS alanı
  (tabs)/index.tsx      Sayaç (ana ekran, ilk sekme)
  (tabs)/denemeler.tsx  Deneme listesi ve net grafiği
  (tabs)/gruplar.tsx    Bayrak kapalı: "Yakında"; açık: grup ana ekranı (yalnız 15+ profillerde görünür)
  grup/[id].tsx         Grup: şu an çalışanlar, sıralama, hazır tepkiler, bildir/engelle, kurucu araçları
  veli.tsx              Veli modu (velinin kendi cihazında, yetişkin profille)
  (tabs)/ayarlar.tsx    Günlük hedef, pomodoro, sınav tarihi, tüm verileri sil, sürüm
  gecmis.tsx            Günlük toplamlar, ders dağılımı, son 7 gün ("elle" kısmı)
  haftalik.tsx          Haftalık özet (toplam, ders dağılımı, en uzun oturum, seri)
  konular.tsx           Konu takibi: konu bazlı süre, "bitti / tekrar lazım", ilerleme
  elle-ekle.tsx         Geçmişe dönük süre ekleme (source = 'manual', "elle" etiketi)
  deneme/yeni.tsx       Deneme girişi
  deneme/[id].tsx       Deneme ayrıntısı / silme / işaretlenen konular
  analiz/[id].tsx       Deneme analizi: yanlış/boş soruların konuları (2. aşama)
src/domain/             Saf TypeScript iş kuralları + Jest testleri
src/storage/            expo-sqlite veritabanı ve kv-store
src/state/              Uygulama durumu (domain ile depolama arasındaki ince katman)
src/ui/                 Tema, ortak bileşenler, biçimlendirme
src/strings.ts          Kullanıcıya görünen tüm metinler
src/config/features.ts  Özellik bayrakları (GROUPS_ENABLED=false)
src/sync/               Grup sunucusu: tipli RPC API'si, çıkış kuyruğu, nabız (bayrak kapalıyken hiç çalışmaz)
supabase/               Arka uç: migrations/ (SQL, RLS, RPC), tests/ (pgTAP), tests-ts/ (supabase-js), config.toml
infra/                  Üretim sunucusu runbook'u ve betikleri (İlkbyte VPS, yalnız dosya)
index.ts / index.web.ts Giriş noktası (web: SQLite worker'ını ısıtıp expo-router'ı başlatır)
scripts/test-web.mjs    Web duman testi (npm run test:web)
e2e/                    Maestro akışları (iOS simülatörü, e2e-ios.yml)
ci/ExportOptions.plist  TestFlight ihracat ayarları
.github/workflows/      ci.yml, testflight.yml, e2e-ios.yml
```

## Yayın hattı

### `ci.yml` (her push ve PR)
ubuntu-latest: `npm ci` → `npx tsc --noEmit` → `npx jest --ci` → `npx expo-doctor`.

### `e2e-ios.yml` (elle `workflow_dispatch` veya `main`'e push: `app/`, `src/`, `package*.json`, `app.json`, `e2e/`)
İnsan test edici olmadan iOS simülatöründe uçtan uca test. Gizli değer gerekmez.
1. macOS 26 koşucusu, Xcode denetimi, Node + Java 17, `npm ci`.
2. `expo prebuild --platform ios --clean --no-install` → `pod install`.
3. `xcodebuild build` Release, `-sdk iphonesimulator`, `CODE_SIGNING_ALLOWED=NO`: JS paketi
   (`main.jsbundle`) uygulamaya gömülüdür, Metro gerekmez.
4. Koşucunun saat dilimi Europe/Istanbul yapılır (simülatör ana makineninkini kullanır); en yeni iOS
   çalışma zamanında yeni bir iPhone simülatörü oluşturulur, `AppleLanguages=tr`, `AppleLocale=tr_TR`
   yazılıp yeniden başlatılır, uygulama kurulur.
5. Maestro resmi kurulum betiğiyle sabit sürümde (`MAESTRO_VERSION`) kurulur, `e2e/*.yaml` akışları çalışır.
6. Her durumda: ekran görüntüleri, JUnit raporu, Maestro hata ayıklama çıktısı, xcodebuild ve uygulama
   logları `e2e-ios-<numara>` artifact'ı olarak 14 gün saklanır; özet tabloda her akışın sonucu görünür.

Akışlar (`e2e/`, yalnız `testID` seçicileri; ortak adımlar `e2e/subflows/`):
`a-ilk-acilis` (15+ YKS Sayısal → sayaç), `b-sayac` (başla/mola/devam/bitir, bugünkü toplam > 0),
`c-arka-plan` (15 sn ana ekran → "Çalışıyordum, süreye ekle"), `d-kapat-ac` (öldür-aç: sayaç sürer;
20 sn kapalı: uzakta kuralı), `e-deneme` (TYT: 10D 4Y = 9 net, toplam 11,5), `f-kucuk-yas`
(15 altı: Gruplar sekmesi yok), `g-tum-verileri-sil` (Ayarlar → sil → ilk açılış).
Yeni ekran öğesine test gerekiyorsa metni değil `testID`'yi hedefleyin; mevcut `testID`'leri
değiştirmeyin (akışlar ve `scripts/test-web.mjs` bunlara bağlı).

### `testflight.yml` (elle `workflow_dispatch` veya `v*` etiketi)
macOS 26 koşucusu:
1. Xcode sürümünü yazdırır (SDK 57 için 26.4 altıysa uyarı verir).
2. Node kurulur, `npm ci`.
3. `npx expo prebuild --platform ios --clean --no-install` ile `ios/` sıfırdan üretilir.
4. Xcode proje adı bulunur (Expo "Etüt" adındaki `ü`yü atar, proje adı `Ett` olur) ve
   `Info.plist` içindeki `CFBundleVersion` `$(CURRENT_PROJECT_VERSION)` yapılır
   (Expo bunu sabit "1" yazar; aksi hâlde her yükleme aynı derleme numarasıyla reddedilirdi).
5. `pod install`.
6. App Store Connect API anahtarı `~/private_keys/AuthKey_<ID>.p8` olarak yazılır
   (ham .p8 metni ya da base64'ü kabul edilir).
7. İsteğe bağlı: `DIST_CERT_P12_BASE64` varsa Apple Distribution kimliği geçici anahtarlığa alınır.
8. `xcodebuild archive` (workspace, Release, otomatik imzalama, `-allowProvisioningUpdates`,
   `-authenticationKey*`, `DEVELOPMENT_TEAM=26322AY3MH`, `CURRENT_PROJECT_VERSION=<run_number>.<run_attempt>`).
9. `-exportArchive` ile önce diske IPA çıkarılır; imza (Distribution sertifikası), bundle id ve
   derleme numarası doğrulanır.
10. Aynı arşiv `ci/ExportOptions.plist` (`app-store-connect`, `upload`) ile App Store Connect'e yüklenir.
11. Hata olursa arşiv ve loglar 7 günlük artifact olarak saklanır.
12. Her durumda: CI'ın oluşturduğu "Created via API" geliştirme sertifikaları iptal edilir,
    API anahtarı ve geçici anahtarlık silinir. Bu adım takımdaki **tüm** "Created via API"
    geliştirme sertifikalarını siler; aynı takımı kullanan CarPlay Medya iş akışıyla aynı anda
    çalıştırmayın (biri diğerinin arşiv sertifikasını iptal edebilir).

Sürüm numarası (`CFBundleShortVersionString`) `app.json` → `expo.version` alanından gelir
(şu an `0.1.0`). Derleme numarası `<çalıştırma numarası>.<deneme numarası>` biçimindedir (ör. `12.1`); "Re-run jobs" deneme numarasını artırdığı için aynı numara iki kez yüklenmez.

### GitHub gizli değişkenleri (Settings → Secrets and variables → Actions)

| Ad | Zorunlu | İçerik |
|---|---|---|
| `ASC_KEY_ID` | evet | App Store Connect API anahtar kimliği |
| `ASC_ISSUER_ID` | evet | Issuer ID |
| `ASC_PRIVATE_KEY` | evet | `AuthKey_XXXX.p8` içeriği (ham metin ya da base64) |
| `DIST_CERT_P12_BASE64` | önerilir | Apple Distribution sertifikası .p12 dosyasının base64'ü |
| `DIST_CERT_PASSWORD` | p12 varsa | .p12 parolası |

API anahtarı **Admin** rolünde olmalı. CarPlay Medya projesinde aynı takım için bulut tarafından
yönetilen dağıtım imzası ITMS-90035 ile reddedilmişti; bu yüzden `DIST_CERT_P12_BASE64`
tanımlanması önerilir. Aynı gizli değerler CarPlay Medya deposundakilerle aynı olabilir.

### App Store Connect'te elle yapılacaklar

1. **Bundle ID:** developer.apple.com → Identifiers'da `com.bnycftc.etut` yoksa oluşturun
   (Admin anahtarlı otomatik imzalama genelde kendisi kaydeder; ilk çalıştırmada hata alınırsa elle ekleyin).
   Ek yetenek (capability) gerekmez.
2. **Uygulama kaydı:** App Store Connect → Apps → "+" → New App: platform iOS, ad "Etüt"
   (ad başkasına aitse farklı bir mağaza adı seçin), birincil dil Türkçe, bundle id
   `com.bnycftc.etut`, SKU serbest. Kayıt olmadan yükleme reddedilir.
3. **Kategori:** Eğitim (hukuk/03 K-13). Yaş derecelendirme anketini uygulamayla tutarlı doldurun (K-44).
4. **App Privacy:** v0 hiçbir veri toplamaz ve cihaz dışına göndermez → "Data Not Collected".
5. **Şifreleme:** `ITSAppUsesNonExemptEncryption = false` Info.plist'te; TestFlight ihracat sorusu çıkmamalı.
6. **TestFlight:** İlk derleme işlendikten sonra iç test grubuna kendinizi ekleyin.
   Dış test için Beta App Review gerekir.

## Gruplar (arka uç, bayrak arkasında kapalı)

Kişisel veri KVKK gereği Türkiye'deki kendi barındırdığımız Supabase'te tutulacak
(`docs/hukuk/kvkk/00-aktarim-cozumu.md`); sunucu henüz yok. Bu yüzden `src/config/features.ts`
içinde `GROUPS_ENABLED = false`: uygulama hiçbir ağ isteği yapmaz, supabase-js yüklenmez, Gruplar
sekmesi "Yakında" kalır. Bayrak açılınca:

- Gruplar sekmesinde takma adla anonim hesap açılır (sunucuya yalnız yaş **bandı** gider: 15–17 /
  18+; doğum yılı gitmez; 15 altı hiç hesap açamaz, sunucu da reddeder). Sonradan Apple/Google
  bağlama API'si hazır (`linkIdToken`), giriş düğmeleri yerel modül gerektirdiği için eklenmedi.
- Bitirilen oturumlar (sayaç ve "elle") `sync_outbox` kuyruğuna (göç 5) girer ve sabit bir uuid ile
  gönderilir; çevrimdışıyken kuyrukta bekler, tekrar gönderim çift kayıt üretmez. Sunucuya gitmiş
  "elle" kayıt cihazdan silinirse sunucuda kalır (sunucu kayıtları yalnız eklenir).
- Oturum açıkken 5 dakikada bir nabız gider (tek satır güncellenir); "şu an çalışıyor" bundan
  türetilir, "görünmez çalış" bunu grubundan gizler.
- Kurallar sunucuda: tüm tablolarda RLS, yazma yalnız `SECURITY DEFINER` RPC'lerle; 30 üye
  veritabanı kısıtı, 72 saatlik davet kodu + kurucu onayı, kişi başına günde 3 tepki, raporla/engelle,
  veli bağlantısı ve kilitleri, hesap silme. Ayrıntı: `supabase/migrations/`, testler `supabase/tests/`.

Yerel geliştirme: Docker Desktop + `npx supabase start` (yığını `npx supabase stop` ile kapatın).
`npx supabase status` çıktısındaki API adresi ve publishable/anon anahtar `.env.local` dosyasına
(git dışı) `EXPO_PUBLIC_SUPABASE_URL=...` ve `EXPO_PUBLIC_SUPABASE_KEY=...` olarak yazılır. Bu
anahtar herkese açıktır; servis anahtarı ya da başka bir sır asla `EXPO_PUBLIC_*` olmaz.
Üretim kurulumu: `infra/README.md`.

## Gizlilik

v0'da veri yalnız cihazdadır: doğum yılı, sınav türü/alan, çalışma oturumları (konu ve
"elle" bilgisiyle), konu ilerlemesi, denemeler ve analizleri, hedefler. Ad, e-posta, tam doğum
tarihi sorulmaz. Ayarlar → "Tüm verileri sil" veritabanını ve anahtar-değer deposunu temizler.
İstisna (hukuk/03 K-17): yalnız 15 yaş altı beyanında, beyan edilen doğum yılı 15 yaşına
gelene kadar ayrı bir dosyada (`EtutAgeGuard`, `src/storage/age-guard.ts`) kalır; silme sonrası
15+ beyanına geçişi engellemek için. Süresi dolunca açılışta, uygulama kaldırılınca da silinir.
