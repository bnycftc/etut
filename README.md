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
| `npm run gen:icons` | Simge, açılış ekranı işaretleri ve favicon'u SVG'den üretir (`assets/`; `-- --preview` 60/120/180 px önizlemeleri `test-results/icons/`'a yazar) |
| `npm run gen:licenses` | Uygulama paketine giren açık kaynak paketlerin listesini üretir (`src/legal/licenses.ts`; bağımlılık değişince yeniden çalıştırın) |
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
  (tabs)/ayarlar.tsx    Sınav/alan değiştirme, günlük hedef, pomodoro, sınav tarihi, yedek, tüm verileri sil, hakkında
  gecmis.tsx            Günlük toplamlar, ders dağılımı, son 7 gün ("elle" kısmı)
  haftalik.tsx          Haftalık özet (toplam, ders dağılımı, en uzun oturum, seri)
  konular.tsx           Konu takibi: konu bazlı süre, "bitti / tekrar lazım", ilerleme
  elle-ekle.tsx         Geçmişe dönük süre ekleme (source = 'manual', "elle" etiketi)
  deneme/yeni.tsx       Deneme girişi
  deneme/[id].tsx       Deneme ayrıntısı / silme / işaretlenen konular
  analiz/[id].tsx       Deneme analizi: yanlış/boş soruların konuları (2. aşama)
  paylas.tsx            Paylaşılabilir 9:16 günlük/haftalık çalışma kartı (açık/koyu)
  yedek.tsx             Yedekle / geri yükle (JSON), CSV dışa aktarma
  hakkinda.tsx          Sürüm, yasal metinler, veri sorumlusu, lisanslar
  yasal/[doc].tsx       Kısa aydınlatma, gizlilik politikası, kullanım şartları (onboarding'den de açılır)
  lisanslar.tsx         Açık kaynak lisansları: npm paketleri + yerel kütüphaneler, satıra dokununca metin
  hatirlaticilar.tsx    Yerel hatırlatıcı ayarları (uzun oturum, pomodoro, günlük, deneme analizi)
  bildirim-izni.tsx     Sistem izin penceresinden önceki açıklama ekranı
src/domain/             Saf TypeScript iş kuralları + Jest testleri
src/storage/            expo-sqlite veritabanı ve kv-store; file-io(.web).ts paylaşım/dosya seçici
src/state/              Uygulama durumu (domain ile depolama arasındaki ince katman);
                        system-sync.tsx sayaç/veri değişince canlı sayacı, widget'ı, hatırlatıcıları eşitler
src/system/             Platform bağdaştırıcıları (varsayılan dosya = boş; .ios.ts / .native.ts = cihaz)
  ios/                  Live Activity ve widget düzenleri ('widget' yönergeli işlevler)
plugins/with-etut-ios.js Yerel config plugin (app.json'da İLK sırada kalmalı)
src/ui/                 Tema (WCAG AA testli), ortak bileşenler, kart, ipucu, azaltılmış hareket
src/legal/licenses.ts   Üretilen lisans listesi ve metinleri (npm run gen:licenses)
src/strings.ts          Kullanıcıya görünen tüm metinler (yasal metinler ve DATA_CONTROLLER dahil)
src/config/features.ts  Özellik bayrakları (GROUPS_ENABLED=false)
src/sync/               Grup sunucusu: tipli RPC API'si, çıkış kuyruğu, nabız (bayrak kapalıyken hiç çalışmaz)
supabase/               Arka uç: migrations/ (SQL, RLS, RPC), tests/ (pgTAP), tests-ts/ (supabase-js), config.toml
infra/                  Üretim sunucusu runbook'u ve betikleri (İlkbyte VPS, yalnız dosya)
index.ts / index.web.ts Giriş noktası (web: SQLite worker'ını ısıtıp expo-router'ı başlatır)
scripts/test-web.mjs    Web duman testi (npm run test:web)
scripts/gen-icons.mjs   Simge ve açılış ekranı (SVG -> PNG, simge alfa kanalsız)
scripts/gen-licenses.mjs Lisans listesi üretici; scripts/native-licenses/ yerel kütüphane metinleri, scripts/package-licenses/ LICENSE dosyasız yayımlanan npm paketlerinin depo metni (upstream, birebir; eksik metin betiği hatayla bitirir)
e2e/                    Maestro akışları (iOS simülatörü, e2e-ios.yml)
ci/ExportOptions.plist  TestFlight ihracat ayarları
.github/workflows/      ci.yml, testflight.yml, e2e-ios.yml
```

## iOS sistem yüzeyleri (kilit ekranı, Dynamic Island, widget, yerel bildirim)

Hepsi cihazda kalır: push yok, sunucu yok, token yok (hukuk/03 K-16). Gösterilen veri saf
`src/domain/` modüllerinde hesaplanır ve testlidir (`live-timer.ts`, `widget-summary.ts`, `reminders.ts`).

- **Canlı sayaç (Live Activity, expo-widgets + @expo/ui):** sayaç başlayınca başlar; mola/devam/
  "Molayı geç"/"Çalışıyordum"da güncellenir, "Bitir"de biter. Süreyi sistem çizer
  (`Text timerInterval` + `pauseTime`); uygulama her saniye güncelleme göndermez. Pomodoro'da
  aşamanın kalan süresi geri sayılır; aşama bitince (`staleDate`) etkinlik sıradaki aşamayı ve onun
  bitiş saatini kendisi gösterir ("Kısa mola · bitiş 10:30"). **Bu yalnız bir aşama için olur:**
  push olmadan kapalı uygulama etkinliği değiştiremez; o aşama da bitince sayaç 0:00'da kalır,
  bitiş saati doğru kalır. Uygulama açıkken her aşama değişiminde, arka plana geçerken de bir kez
  daha güncellenir; kilitli telefonda aşama sonlarını yerel bildirimler duyurur (aşağıda b).
  Ders (ve konu) adı görünür. Apple sınırı: bir Live Activity en çok 8 saat etkin kalır,
  yalnız uygulama ön plandayken başlatılabilir ("Displaying live data with Live Activities"); güncelleme
  ve bitirme arka planda da olur. Bu yüzden uzun oturumda uygulama her açıldığında 6 saatten eski
  etkinliği yenisiyle değiştirir, sistemin 8 saatte bitirdiğini yeniden başlatır. Öğrencinin kendisi
  kaldırdığını uygulama 8 saat dolmadan bir kez görürse kaydeder (`dismissed`) ve o oturumda bir daha
  başlatmaz; kaldırmayı ancak 8 saatten sonra görürse sistemin bitirmesinden ayıramaz ve yenisini
  başlatır. Sistemin bitirdiği etkinlik kilit ekranında 4 saate kadar donmuş kalabilir; expo-widgets
  57.0.x bitmiş etkinlikleri listelemediği için uygulama onu ne sayabilir ne kaldırabilir: o süre
  içinde kilit ekranında yenisinin yanında eskisi de görünebilir, oturum bitince de bir süre kalabilir.
- **Ana ekran widget'ı "Etüt: Bugün"** (küçük, orta, kilit ekranı dikdörtgen): bugünkü süre, seri,
  günlük hedef ilerlemesi. Uygulama zaman çizelgesini App Group'a (`group.com.bnycftc.etut`) yazar,
  widget yalnız okur. Çizelge gece yarısı (İstanbul), pomodoro aşama değişimleri ve hedefe
  ulaşılan an için girdi içerir; sayaç açıkken süre ve hedef çubuğu widget'ta kendiliğinden ilerler.
  Çizelge en çok 40 girdi tutar ve ikinci gece yarısında biter: pomodoroda ilk 34 aşama değişimini
  (25/5/15 ile ≈ 9 saat) kapsar; çizelgenin dışında kalan ilk aşama değişiminden sonrasına uzanan
  girdi saymaz (açık sayaçtan az gösterebilir, fazla göstermez). Tek istisna uzakta kuralı: uygulama
  uzun süre sonra dönünce o süreyi otomatik molaya çevirebilir; öğrenci "Çalışıyordum" demezse widget
  o sürede kaydedilenden fazla saymış olur, sonraki eşitleme düzeltir. Uygulama açıldıkça ve açıkken
  her aşama değişiminde çizelge yenilenir.
- **Uzantı:** `com.bnycftc.etut.ExpoWidgetsTarget` (expo-widgets'ın ürettiği hedef; widget + Live
  Activity aynı uzantıda). Derleme numarası uygulamayla aynıdır (`plugins/with-etut-ios.js`).
- **Gizlilik manifestleri (PrivacyInfo.xcprivacy):** uygulamanınki `app.json` →
  `ios.privacyManifests` ile UserDefaults için `1C8F.1` (App Group'u uzantıyla paylaşma) ekler;
  React Native `pod install`'da pod'ların gerekçelerini buna katar. Uzantıya React Native bu işi
  yapmaz, expo-widgets de manifest yazmaz: `plugins/with-etut-ios.js` uzantının kendi manifestini
  (UserDefaults `1C8F.1`/`CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`; izleme ve toplanan
  veri yok) yazar ve uzantı hedefinin Resources aşamasına ekler. İki iOS iş akışı da her iki
  pakette manifestin varlığını ve `1C8F.1`'i denetler (ITMS-91053 "Missing API declaration").
- **Yerel bildirimler (expo-notifications, yalnız zamanlanmış):** (a) sayaç ayarlanan süre
  (varsayılan 3 saat) duraklatılmadan açık kalınca "Hâlâ çalışıyor musun?" (pomodoro molaları
  sayacı duraklatmaz); (b) pomodoro aşama sonu: sıradaki 40 aşama (25/5/15 ile ≈ 10 sa 50 dk)
  kurulur, plan uygulama açıkken her aşama değişiminde ve arka plana geçerken yenilenir;
  (c) günlük çalışma hatırlatıcısı (saat seçilir, varsayılan kapalı; o gün çalışıldıysa gelmez);
  (d) analizi bekleyen deneme için, denemenin kaydedildiği günün ertesinde 18:00'de tek hatırlatma.
  **Öğrenci hatırlatıcıları açıklama ekranından bir kez onaylamadan hiçbir bildirim kurulmaz**
  (`etut.remindersConfirmed.v1`; o zamana kadar ekranda hepsi "Kapalı" görünür). Bu, sistem izni
  zaten verilmiş olsa da geçerlidir: Android 12 ve öncesinde izin kurulumda verilir ve sistem izin
  penceresi yoktur; "Tüm verileri sil" de işletim sistemindeki izni geri almaz, yalnız onayı siler.
  İzin yalnız öğrenci bir hatırlatıcıyı açtığında, açıklama ekranından sonra istenir (izin zaten
  verilmişse düğme yalnız onaylar); reddedilirse uygulama aynen çalışır. Açıklama ekranı açılacak
  hatırlatıcıları listeler (önerilen: uzun oturum, pomodoro, deneme analizi; günlük kapalı).
  Açıklama ekranında Apple HIG'e göre tek düğme ("Devam et") vardır, sistem izin penceresini açar;
  ekran kaydırılarak kapatılmaz, izin verme ya da reddetme sistem penceresinde yapılır.
  Plan her değişiklikte yeniden hesaplanır ve sistemdekiyle karşılaştırılır (sabit kimlikler):
  aynı bildirim iki kez kurulmaz, biten oturumun bildirimleri iptal edilir. Uygulama açıkken
  bildirim gösterilmez (pomodoro'da mevcut titreşim). Metinler her yaş için nötrdür; kilit ekranında
  göründükleri için ad, süre ve net içermez (deneme hatırlatıcısı yalnız bekleyen deneme sayısını söyler).
  iOS en çok 64 bekleyen bildirim tutar; plan en çok 60 (40 pomodoro + 10 günlük + 1 uzun oturum +
  en çok 2 deneme günü).
- **Push yok:** expo-widgets 57.0.x `enablePushNotifications: false` olsa bile `aps-environment`
  ekliyor; expo-notifications da ekliyor. `plugins/with-etut-ios.js` bunu kaldırır ve **plugins
  listesinde ilk sırada kalmalıdır** (Expo ilk eklentinin mod'larını en son çalıştırır).
  Her iki iOS iş akışı anahtar geri gelirse hata verir. expo-notifications'ın ikili dosyasında
  `registerForRemoteNotifications` çağrısı bulunduğu için App Store Connect yüklemeden sonra
  ITMS-90078 ("Missing Push Notification Entitlement") uyarısı gönderebilir: **bu beklenen
  durumdur, yüklemeyi engellemez. Push yeteneği açılmaz, `aps-environment` eklenmez** (hukuk/03 K-16).
- **Android:** iOS'a özgü kod `.ios.ts` dosyalarında; Android'de canlı sayaç ve widget yok,
  yerel hatırlatıcılar çalışır. Kronometreli kalıcı bildirim expo-notifications ile yapılamıyor
  (`setUsesChronometer` sunulmuyor; ayrı yerel modül gerekir), eklenmedi. Şablonun varsayılan
  depolama izinleri (`READ/WRITE_EXTERNAL_STORAGE`) kullanılmadığı için `app.json` →
  `android.blockedPermissions` ile kaldırılır.
- **Widget düzeni kuralı:** `src/system/ios/*.tsx` içindeki `'widget'` yönergeli işlevler ayrı bir
  JS çalışma ortamında koşar: yalnız props, environment ve `@expo/ui/swift-ui` görünür; dosyadaki
  sabitler, `strings.ts`, yardımcılar görünmez. Babel'ın yardımcı işlev ürettiği söz dizimini
  (nesne/dizi yayma, `for…of`, sınıf) kullanmayın. Metinler props'la hazır gelir (`surface-props.ts`).

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
(15 altı: Gruplar sekmesi yok), `g-tum-verileri-sil` (Ayarlar → sil → ilk açılış),
`h-alan-degistir` (Sayısal → EA: ders ve deneme türleri değişir), `i-yedek` (yedek dosyası →
paylaşım sayfası), `j-kart-paylas` (çalışma kartı, paylaşım sayfası), `k-hakkinda-bos-durum`
(aydınlatma ilk açılıştan, boş durumlar, hakkında, gizlilik),
`l-hatirlaticilar` (onaydan önce hepsi kapalı; hatırlatıcı aç → tek düğmeli açıklama ekranı;
sistem izin penceresi açılmaz, uygulama yeniden başlatılır ve hatırlatıcılar kapalı kalır),
`m-canli-sayac` (ana ekranda Dynamic Island, Bildirim Merkezi'nde kilit ekranı görünümü, mola, pomodoro, bitir).
İlk açılıştan sonraki tek seferlik ipucu `subflows/ipucu-gec.yaml` ile kapatılır.
**`m-canli-sayac`'ın yeşil olması Live Activity'nin çizildiğini kanıtlamaz:** Maestro sistem
(SpringBoard) içeriğini göremeyebilir, bu yüzden oradaki "Fizik"/"Çalışıyorsun" denetimleri isteğe
bağlıdır (görülmezse yalnız uyarı). `m-canli-sayac-0x` ekran görüntüleri artifact'ta elle
incelenmeden canlı sayaç doğrulanmış sayılmaz. Maestro'nun XCTest sürücüsü hiçbir akış başlamadan
zaman aşımına uğrarsa (`IOSDriverTimeoutException`) akışlar bir kez daha çalıştırılır.
Derleme adımı uzantının (`PlugIns/ExpoWidgetsTarget.appex`) gömüldüğünü, App Group'u,
`aps-environment` olmadığını ve uygulama ile uzantıda `PrivacyInfo.xcprivacy` (`1C8F.1`) bulunduğunu da denetler.
Yeni ekran öğesine test gerekiyorsa metni değil `testID`'yi hedefleyin; mevcut `testID`'leri
değiştirmeyin (akışlar ve `scripts/test-web.mjs` bunlara bağlı).

### `testflight.yml` (elle `workflow_dispatch` veya `v*` etiketi)
Yasal yer tutucu kapısı: `src/strings.ts` içinde `[DOLDURULACAK]` kaldıysa derleme yüklenmez.
Tek istisna, elle başlatılan ve `internal_only` işaretli çalıştırmadır
(`gh workflow run testflight.yml -R bnycftc/etut --ref <dal> -f internal_only=true`); böyle bir
derleme **yalnız iç TestFlight** içindir, dış test grubuna ya da App Review'a gönderilmez
(çalıştırma özetinde derleme numarası yazar). İncelemeye yalnız yer tutucusuz derleme gider.
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
   derleme numarası doğrulanır. Aynı denetim gömülü her uzantı için de yapılır (widget/Live Activity
   uzantısı: dağıtım imzası, `com.bnycftc.etut.*` kimliği, uygulamayla aynı sürüm/derleme numarası);
   uygulama ve uzantı imzasında App Group bulunmalı, `aps-environment` bulunmamalıdır; her iki
   pakette `PrivacyInfo.xcprivacy` bulunmalı ve UserDefaults için `1C8F.1` beyan etmelidir.
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

1. **Bundle ID'ler ve App Group:** `com.bnycftc.etut` ve widget uzantısı
   `com.bnycftc.etut.ExpoWidgetsTarget`; ikisinde de **App Groups** yeteneği, grup
   `group.com.bnycftc.etut`. Admin anahtarlı otomatik imzalama (`-allowProvisioningUpdates`)
   App ID'leri, yeteneği ve grubu kendisi kaydeder; ilk çalıştırmada imza hatası alınırsa
   developer.apple.com → Identifiers'da grubu (App Groups) ve iki App ID'yi elle oluşturup ikisinde
   App Groups'u açın, grubu seçin. Push Notifications yeteneği **gerekmez** (yalnız yerel bildirim).
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
  gönderilir; çevrimdışıyken kuyrukta bekler, tekrar gönderim çift kayıt üretmez. Yalnız zamanlar,
  süre ve kaynak gider; ders ve konu cihazda kalır. Hiçbir grupta değilken oturum gönderilmez.
  Sunucuya gitmiş bir kayıt cihazdan silinirse sunucudan da silinir (`delete_session`, kuyrukla).
- Oturum açıkken ve bir gruptayken 5 dakikada bir nabız gider (tek satır güncellenir); "şu an
  çalışıyor" bundan türetilir, "görünmez çalış" bunu grubundan gizler.
- Bayrağı açmadan önce `src/config/features.ts` içindeki `GROUPS_LAUNCH_BLOCKERS` boşalmalı
  (K-23, K-25, K-28/29, K-31, K-37, K-38, K-42); boş değilken bayrak açılırsa Jest kırmızı olur.
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
iOS'ta widget için bugünkü süre, seri ve hedef aynı cihazdaki App Group kabında; canlı sayaçta
ders/konu adı kilit ekranında görünür. "Tüm verileri sil" canlı sayacı bitirir, widget'ı boş
görünüme çevirir ve zamanlanmış hatırlatıcıları iptal eder. Bildirimler yalnız yereldir (push yok).
İstisna (hukuk/03 K-17): yalnız 15 yaş altı beyanında, beyan edilen doğum yılı 15 yaşına
gelene kadar ayrı bir dosyada (`EtutAgeGuard`, `src/storage/age-guard.ts`) kalır; silme sonrası
15+ beyanına geçişi engellemek için. Süresi dolunca açılışta, uygulama kaldırılınca da silinir.

Veri cihazdan yalnız öğrenci dokunduğunda, sistemin paylaşım sayfasıyla çıkar; uygulama hiçbir
ağ isteği atmaz (`test:web` bunu denetler):
- **Yedek** (`Ayarlar → Yedekle ve geri yükle`): `etut-yedek-<gün>.json`, biçim `src/domain/backup.ts`
  (`format: "etut-yedek"`, `schemaVersion: 1`; oturumlar, denemeler + analizler, konu işaretleri,
  ayarlar, profil). İçe aktarma: tam şema doğrulaması (tek hatalı kayıt → hiçbir şey yazılmaz),
  daha yeni sürüm reddedilir, "Birleştir" (bu cihaz kazanır, eksikler eklenir) ya da "Değiştir";
  kimliklere göre idempotent; uygulamanın yazdığı her kayıt geri okunur (ör. bir hafta açık
  kalmış oturum); süre sınırı yok, zaman sınırı var (2016 sonrası başlangıç, dosya tarihinden en
  fazla 1 gün sonra bitiş). "Birleştir"de burada boş olan ayarlar (kaldırılmış hedef dahil) yedekten dolar.
  K-17: yaş yedekle yükseltilemez; yedekteki yaş daha küçükse küçük olan esas alınır (seçicinin
  sunmadığı bir yıl, ör. 2200, yok sayılır), 15 altı bayrağı içe aktarmayla kapanmaz. Dosya
  şifrelenmez (metinde yazıyor).
- **CSV** (KVKK taşınabilirlik): oturumlar ve denemeler; `;` ayraçlı, UTF-8 BOM, ondalık virgül,
  formül enjeksiyonuna karşı korumalı (`src/domain/csv.ts`).
- **Çalışma kartı**: 1080×1920 PNG; yalnız süre, ders dağılımı, seri ve hedef (ad, yaş, okul,
  sınav türü yok).

Yasal metinler (`src/strings.ts` → `legalDocs`) şu anki sunucusuz davranışa göre yazıldı. Veri
sorumlusu adı ve iletişim bilgisi `DATA_CONTROLLER` sabitinde **`[DOLDURULACAK]`**; yayından önce
doldurulmalı.
