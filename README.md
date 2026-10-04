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
| `npx expo start --web` | Web önizlemesi (aşağıdaki nota bakın) |
| `npx expo install <paket>` | SDK ile uyumlu sürümle paket ekler (npm install yerine bunu kullanın) |

**Windows notu:** iOS projesi (`ios/`) Windows'ta üretilemez ve derlenemez
(`expo prebuild --platform ios` Windows'ta reddedilir). iOS yalnız CI'da derlenir.
Expo Go da kullanılmaz; uygulama doğrudan TestFlight derlemesiyle denenir.

**Web notu:** `npx expo start --web` paketi derler ama uygulama açılışta durur:
expo-sqlite web'de `SharedArrayBuffer` ister, bu da sayfanın
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` başlıklarıyla sunulmasını gerektirir;
yerel Expo geliştirme sunucusu bu başlıkları göndermiyor (metro `enhanceMiddleware` ve
expo-router `headers` denendi, HTML yanıtına eklenmedi). Web v0'da hedef değildir.

## Yapı

```
app/                    Ekranlar (expo-router)
  _layout.tsx           Kök yığın; profil yoksa yalnız onboarding açılır
  onboarding.tsx        İlk açılış: doğum yılı, sınav türü, YKS alanı
  (tabs)/index.tsx      Sayaç (ana ekran, ilk sekme)
  (tabs)/denemeler.tsx  Deneme listesi ve net grafiği
  (tabs)/gruplar.tsx    "Yakında" (yalnız 15+ profillerde görünür)
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
ci/ExportOptions.plist  TestFlight ihracat ayarları
.github/workflows/      ci.yml, testflight.yml
```

## Yayın hattı

### `ci.yml` (her push ve PR)
ubuntu-latest: `npm ci` → `npx tsc --noEmit` → `npx jest --ci` → `npx expo-doctor`.

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

## Gizlilik

v0'da veri yalnız cihazdadır: doğum yılı, sınav türü/alan, çalışma oturumları (konu ve
"elle" bilgisiyle), konu ilerlemesi, denemeler ve analizleri, hedefler. Ad, e-posta, tam doğum
tarihi sorulmaz. Ayarlar → "Tüm verileri sil" veritabanını ve anahtar-değer deposunu temizler.
İstisna (hukuk/03 K-17): yalnız 15 yaş altı beyanında, beyan edilen doğum yılı 15 yaşına
gelene kadar ayrı bir dosyada (`EtutAgeGuard`, `src/storage/age-guard.ts`) kalır; silme sonrası
15+ beyanına geçişi engellemek için. Süresi dolunca açılışta, uygulama kaldırılınca da silinir.
