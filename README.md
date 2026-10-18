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
| `npx jest` | `src/` altındaki tüm Jest testleri: alan (domain) kuralları, ekran duman testleri (`src/__tests__`), durum, depolama, lisans listesi |
| `npx expo-doctor` | Bağımlılık ve yapılandırma denetimi |
| `npx expo export --platform ios` | iOS JS paketini `dist/` altına üretir (yerel derleme olmadan doğrulama) |
| `npm run web` | Web önizlemesi, sabit port 8081 (`http://localhost:8081`; `npx expo start --web` de çalışır) |
| `npm run test:web` | Web duman testi: geliştirme sunucusunu kendisi açar/kapatır, Playwright ile uygulamayı dener |
| `npm run test:all` | `tsc` + `jest --ci` + `test:web` |
| `npm run test:db` | Arka uç SQL testleri (pgTAP, `npx supabase test db`; Docker + `npx supabase start` gerekir) |
| `npm run test:db:pglite` | Aynı pgTAP testleri Docker olmadan, PGlite (WebAssembly Postgres) üzerinde |
| `npm run test:backend` | supabase-js ile yerel yığına karşı uçtan uca test; Docker/yığın yoksa **ATLANDI** yazar |
| `npm run gen:icons` | Simge, açılış ekranı işaretleri ve favicon'u SVG'den üretir (`assets/`; `-- --preview` 60/120/180 px önizlemeleri `test-results/icons/`'a yazar) |
| `npm run gen:licenses` | Uygulama paketine giren açık kaynak paketlerin listesini üretir (`src/legal/licenses.ts`; bağımlılık değişince yeniden çalıştırın: Jest eski sürümü, CI eksik/fazla paketi yakalar) |
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
  (tabs)/gruplar.tsx    Grup ana ekranı; yalnız bayrak açıkken ve 15+ profillerde sekme olarak görünür
  grup/[id].tsx         Grup: şu an çalışanlar, sıralama, hazır tepkiler, bildir/engelle, kurucu araçları
  veli.tsx              Veli modu (velinin kendi cihazında, yetişkin profille)
  (tabs)/ayarlar.tsx    Sınav/alan değiştirme, günlük hedef, pomodoro, sınav tarihi (düğmesiz: yazılınca ya da alandan
                        çıkınca kaydedilir), yedek, tüm verileri sil ("Önce yedek al" ile), hakkında
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
scripts/store-compose.mjs Çerçeveli App Store görüntüleri (resvg, store/fonts Inter OFL, store/app-store/tr/screenshots.json)
scripts/gen-licenses.mjs Lisans listesi üretici; scripts/native-licenses/ yerel kütüphane metinleri, scripts/package-licenses/ LICENSE dosyasız yayımlanan npm paketlerinin depo metni (upstream, birebir; eksik metin betiği hatayla bitirir)
e2e/                    Maestro akışları (iOS simülatörü, e2e-ios.yml)
ci/ExportOptions.plist  TestFlight ihracat ayarları
.github/workflows/      ci.yml, testflight.yml, e2e-ios.yml, store-screenshots.yml, store-frames.yml, asc-*.yml (App Store Connect)
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
  **Uzakta (Ayarlar → "Uygulamadan çıkınca: Sor", varsayılan):** arka plana geçerken giden son
  güncelleme, uzakta kalınan sürenin nereden itibaren mola sayılacağını da taşır
  (`provisionalAwayAt`: kronometrede ve çalışma bloğunda ayrılma anı, pomodoro molasında molanın
  sonu). Kronometrede ve çalışma bloğunda durum satırı aynı güncellemeyle hemen "Uygulamadan
  çıktın · 10 sn sonra mola sayılır" olur (saatin altında, en çok iki satır); molada
  "Kısa mola" kalır. Sayaç 10 sn tolerans boyunca (molada mola bitene kadar) saymaya devam eder;
  `staleDate` gelince etkinlik kendiliğinden (`isStale`) uzakta görünümüne geçmelidir: saat o andaki
  çalışma süresinde durur (`pauseTime`, elle molayla aynı), simge duraklatma, altında "Uygulamadan
  çıktın · mola sayılıyor" ve "Dönünce “Çalışıyordum” dersen süre eklenir." **iOS simülatöründe bu
  geçiş çizilmedi** (e2e-ios-37-1: Canlı Etkinliklere izin verilmiş, uzakta alanlı güncelleme arka
  plan olayından 70 ms sonra gitmiş, 19 sn sonra bile çalışan görünüm duruyordu); gerçek cihazda
  denenmedi. Bu yüzden dürüst durum metni bayat görünüme bağlı değildir; simülatörde saat saymaya
  devam eder. Geçiş çizilirse duran saat en çok 10 sn geri adım atar (bilinçli). Bu görünüm
  "sıradaki aşama" görünümünden önce gelir; pomodoroda kaybedilen aşamayı (o anki blok, molada
  çıkıldıysa sıradaki blok tam uzunlukta) donmuş gösterir. Aşama sonu yerel bildirimleri pomodoro
  planına göre yine gelir (bilinçli). Uygulama dönünce etkinliği günceller; "Çalışıyordum" denirse
  saat ileri atlar (simülatörde olduğu gibi saat saymaya devam ettiyse, denmezse geri atlar). "Çalışmaya devam say" seçiliyse hiçbir şey
  değişmez, sayaç saymaya devam eder. Zorla kapatmada iOS uygulamanın etkinliklerini de bitirir,
  yeniden açılışta yukarıdaki yeniden başlatma yolu çalışır. Uygulama ön planda çökerse (arka plan
  olayı yok) etkinlik saymaya devam eder: bu boşluk bilinçli olarak kalır (dönünce `onAppLaunch`
  yine molayı sorar).
  Ders (ve konu) adı görünür. Apple sınırı: bir Live Activity en çok 8 saat etkin kalır,
  yalnız uygulama ön plandayken başlatılabilir ("Displaying live data with Live Activities"); güncelleme
  ve bitirme arka planda da olur. Bu yüzden uzun oturumda uygulama her açıldığında 6 saatten eski
  etkinliği yenisiyle değiştirir, sistemin 8 saatte bitirdiğini yeniden başlatır. Öğrencinin kendisi
  kaldırdığını uygulama 8 saat dolmadan bir kez görürse kaydeder (`dismissed`) ve o oturumda bir daha
  başlatmaz; kaldırmayı ancak 8 saatten sonra görürse sistemin bitirmesinden ayıramaz ve yenisini
  başlatır. Telefon yeniden başlayınca da etkinlik kaybolur ve bu, kaldırmadan ayırt edilemez; ama
  yeniden başlatma uygulamayı da yeniden başlatır. Bu yüzden uygulamanın bu açılışta canlı gördüğü
  etkinlik kaybolursa "kaldırıldı" sayılır; açılıştan önce kaybolmuşsa bir kez yeniden başlatılır
  (`retried`), o da kaybolursa kaldırılmış sayılır. Sistemin bitirdiği etkinlik kilit ekranında 4 saate kadar donmuş kalabilir; expo-widgets
  57.0.x bitmiş etkinlikleri listelemediği için uygulama onu ne sayabilir ne kaldırabilir: o süre
  içinde kilit ekranında yenisinin yanında eskisi de görünebilir, oturum bitince de bir süre kalabilir.
- **Ana ekran widget'ı "Etüt: Bugün"** (küçük, orta, kilit ekranı dikdörtgen): bugünkü süre, seri,
  günlük hedef ilerlemesi, sınava kalan gün. Uygulama zaman çizelgesini App Group'a
  (`group.com.bnycftc.etut`) yazar, widget yalnız okur. Çizelge gece yarısı (İstanbul), pomodoro aşama değişimleri ve hedefe
  ulaşılan an için girdi içerir; sayaç açıkken süre ve hedef çubuğu widget'ta kendiliğinden ilerler.
  Sayaç çalışmıyorsa çizelge dördüncü gece yarısına kadar gider; son girdi (seri 0, süre 0) uygulama
  günlerce açılmasa da doğru kalır, widget bayat seri göstermez.
  Sayaç çalışırken çizelge en çok 40 girdi tutar ve ikinci gece yarısında biter: pomodoroda ilk 34 aşama değişimini
  (25/5/15 ile ≈ 9 saat) kapsar; çizelgenin dışında kalan ilk aşama değişiminden sonrasına uzanan
  girdi saymaz (açık sayaçtan az gösterebilir, fazla göstermez). Uzakta kuralı "Sor" iken uygulama
  arka plana geçince widget o andan (pomodoro molasındaysa molanın sonundan) itibaren saymaz:
  toplam donar, "Sayaç açık" notu kalkar. Uzun süre sonra dönüp "Çalışıyordum" denmezse kaydedilen
  de budur; denirse ya da 10 sn içinde dönülürse sonraki eşitleme süreyi ekler. "Çalışmaya devam
  say" seçiliyse widget saymaya devam eder. Uygulama açıldıkça ve açıkken her aşama değişiminde
  çizelge yenilenir.
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
  (c) günlük çalışma hatırlatıcısı (saat seçilir, varsayılan kapalı; o gün çalışıldıysa gelmez).
  Haftanın her günü için bir haftalık tekrarlayan bildirimdir, uygulama açılmasa da her gün gelir;
  atlanan günün yerine o hafta gününe 4 hafta tekil bildirim kurulur, uygulama bir sonraki açılışta
  tekrarlayanı geri koyar (uygulama 4 haftadan uzun açılmazsa yalnız o hafta günü susar);
  (d) analizi bekleyen deneme için, denemenin kaydedildiği günün ertesinde 18:00'de tek hatırlatma.
  **Öğrenci hatırlatıcıları açıklama ekranından bir kez onaylamadan hiçbir bildirim kurulmaz**
  (`etut.remindersConfirmed.v1`; o zamana kadar ekranda hepsi "Kapalı" görünür). Bu, sistem izni
  zaten verilmiş olsa da geçerlidir: Android 12 ve öncesinde izin kurulumda verilir ve sistem izin
  penceresi yoktur; "Tüm verileri sil" de işletim sistemindeki izni geri almaz, yalnız onayı siler.
  İzin yalnız öğrenci bir hatırlatıcıyı açtığında, açıklama ekranından sonra istenir (izin zaten
  verilmişse düğme yalnız onaylar); reddedilirse uygulama aynen çalışır. Açıklama ekranı açılacak
  hatırlatıcıyı listeler: yalnız öğrencinin açtığı gelir, diğerleri kapalı kalır ve tek tek açılır.
  Açıklama ekranında Apple HIG'e göre tek düğme ("Devam et") vardır, sistem izin penceresini açar;
  ekran kaydırılarak kapatılmaz, izin verme ya da reddetme sistem penceresinde yapılır.
  Plan her değişiklikte yeniden hesaplanır ve sistemdekiyle karşılaştırılır (sabit kimlikler):
  aynı bildirim iki kez kurulmaz, biten oturumun bildirimleri iptal edilir. Uygulama açıkken
  bildirim gösterilmez (pomodoro'da mevcut titreşim). Metinler her yaş için nötrdür; kilit ekranında
  göründükleri için ad, süre ve net içermez (deneme hatırlatıcısı yalnız bekleyen deneme sayısını söyler).
  iOS en çok 64 bekleyen bildirim tutar; plan en çok 60 (40 pomodoro + en çok 10 günlük + 1 uzun oturum +
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
ubuntu-latest, üç iş:
- `check`: `npm ci` → `npx tsc --noEmit` → `npx jest --ci` → `npx expo-doctor` →
  `npx expo export --platform ios --source-maps` (cihazın çalıştırdığı paket: Jest'in uygulamadığı
  React Compiler ve `'widget'` düzenlerinin expo-widgets dönüşümü burada derlenir) →
  `node scripts/gen-licenses.mjs dist` ile `src/legal/licenses.ts` yeniden üretilir; fark varsa iş
  düşer (`npm run gen:licenses` çalıştırıp dosyayı commit'leyin).
- `web`: `npx playwright install --with-deps chromium` → `npm run test:web`; düşerse
  `test-results/web` (ekran görüntüleri, geliştirme sunucusu logu) 7 günlük artifact olur.
- `backend`: pgTAP (PGlite ve yerel Supabase yığını) + supabase-js uçtan uca.

### `e2e-ios.yml` (yalnız elle: `workflow_dispatch`)
İnsan test edici olmadan iOS simülatöründe uçtan uca test. Gizli değer gerekmez.
**Push ile tetiklenmez:** macOS koşucu dakikaları pahalı olduğundan yalnız Actions →
"E2E iOS (simulator)" → "Run workflow" ile elle çalıştırılır (ör. iOS'a dokunan bir değişiklikten
ya da TestFlight'a göndermeden önce).
1. macOS 26 koşucusu, Xcode denetimi, Node + Java 17, `npm ci`.
2. `expo prebuild --platform ios --clean --no-install` → `pod install`.
3. `xcodebuild build` Release, `-sdk iphonesimulator`, ad-hoc imzalı (`CODE_SIGN_IDENTITY=-`,
   `CODE_SIGNING_REQUIRED=NO`; sertifika ve profil gerekmez): imzasız derleme yetkileri düşürür, App
   Group olmadan da widget uzantısı düzenleri okuyamaz ve Live Activity boş çizilir. JS paketi
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
20 sn kapalı: uzakta kuralı), `e-deneme` (TYT: 10D 4Y = 9 net, toplam 11,5; listede "11,5 net
kaydedildi" kartı, düzenleme), `f-kucuk-yas` (15 altı: Gruplar sekmesi yok), `g-tum-verileri-sil`
(Ayarlar → sil → "Önce yedek al": paylaşım sayfası iletişim kutusunun üstünde açılır, kapanınca not
görünür, hiçbir şey silinmez → sil → ilk açılış), `h-alan-degistir` (Sayısal → EA: ders ve deneme
türleri değişir; sınav tarihi yazılıp alandan çıkılınca kaydedilir), `i-yedek` (yedek dosyası →
paylaşım sayfası), `j-kart-paylas` (0 dk'da "Paylaş" kapalı ve nedenini söyler; çalıştıktan sonra
çalışma kartı, paylaşım sayfası), `k-hakkinda-bos-durum` (aydınlatma ilk açılıştan, boş durumlar,
boş deneme kartındaki "İlk denemeni ekle" formu açar, hakkında, gizlilik),
`l-hatirlaticilar` (onaydan önce hepsi kapalı; hatırlatıcı aç → tek düğmeli açıklama ekranı;
sistem izin penceresi açılmaz, uygulama yeniden başlatılır ve hatırlatıcılar kapalı kalır),
`m-canli-sayac` (Bildirim Merkezi'nde kilit ekranı görünümü, ana ekranda Dynamic Island, 10 sn'den
uzun çıkınca uzakta görünümü, mola, pomodoro, bitir),
`o-ayarlar-sayac` (Ayarlar → "Sayaç çalışırken": ekranı açık tut kapat/aç, "Çalışmaya devam say";
15 sn ana ekran ve öldür-aç sonrası uzakta kartı yok, kilit ekranındaki ve uygulamadaki saat saymaya
devam eder; sonda aynı ekranda art arda iki değişiklik, "Kapalı" ve yeniden "Açık": React Compiler
altındaki eski `useStored` hatasına karşı, bkz. `src/state/__tests__/use-stored-compiler.test.tsx`),
`p-deneme-duzenle-lgs` (13 yaş LGS: yalnız LGS kâğıdı, net = D − Y/3, kaydet ve düzenle).
İlk açılıştan sonraki tek seferlik ipucu `subflows/ipucu-gec.yaml` ile kapatılır.
**`m-canli-sayac`:** Bildirim Merkezi'ndeki kilit ekranı görünümünde "Fizik" zorunlu denetimdir.
Maestro SpringBoard içeriğini okuyabiliyor: e2e-ios-15-2 ve 21-1 çalıştırmalarında Live Activity
çizilmişken denetim geçti, App Group yetkisinin kaybolduğu 13-1'de etkinlik boş çizildi ve düştü.
Bunu yalnız uygulama arka plandayken yapar: Bildirim Merkezi uygulamanın üstüne çekilince Maestro
uygulamanın kendi ekranını okur ("Fizik" ve "Çalışıyorsun" orada da var) ve izin penceresine
ulaşamaz (e2e-ios-36-1). Kilit ekranında "Çalışıyorsun" bu akışta denetlenemez: CI simülatöründe
Home ile tek bir kaydırma bile 10 sn'lik toleranstan uzun sürüyor (e2e-ios-35-1); onu
`o-ayarlar-sayac` ("Çalışmaya devam say") denetler. Canlı Etkinliklere izin verildikten sonra
uygulamadan ikinci kez çıkılır ve 12 sn'den sonra "Uygulamadan çıktın" zorunlu, "Çalışıyorsun"
yasak denetlenir (`m-canli-sayac-02c-uzakta`; arka plan güncellemesindeki durum metni de, bayat
görünüm de buna uyar, hangisinin çizildiği görüntüden okunur); uygulamaya dönünce "Çalışıyordum"
kartı da zorunludur. Dynamic Island, mola ve pomodoro görünümleri hâlâ yalnız `m-canli-sayac-0x` ekran
görüntüleriyle kanıtlanır; bunlar artifact'ta elle incelenmelidir.
**Yedekten geri yükleme `e2e-ios.yml`'de yok:** içe aktarma dosyayı yalnız sistemin belge seçicisinden
(`expo-document-picker`, UIDocumentPickerViewController) alır. Maestro simülatörün Dosyalar
uygulamasına dosya koyamaz (`addMedia` yalnız fotoğraf/video ekler), dışa aktarılan dosya da paylaşım
sayfasından "Dosyalara Kaydet" ile iOS sürümüne ve dile bağlı sistem ekranlarından geçer. Uygulamada
test için bir derin bağlantı ya da hazır yedek dosyası (fixture) yok ve eklenmez (üretim koduna
yalnız test için bir giriş açmak olur). İş akışı tarafında ise yol var ve çalışıyor:
`store-screenshots.yml` ürettiği demo yedeğini simülatörün "iPhone'umda" klasörüne (File Provider
Storage) kopyalar, `e2e/store/screenshots.yaml` onu uygulamanın kendi "Yedekten geri yükle"
ekranından seçici ile geri yükler. Bir E2E geri yükleme akışı aynı adımla eklenebilir; şimdilik
birleştir/değiştir/geri al akışları Jest'te gerçek depolama katmanıyla
(`src/__tests__/app-real-storage.test.tsx`) ve web duman testinde (`scripts/test-web.mjs`, dosya
seçici Playwright ile beslenir) denenir.
Yeniden denemeler: Maestro'nun XCTest sürücüsü hiçbir akış başlamadan zaman aşımına uğrarsa
(`IOSDriverTimeoutException`) bütün akışlar bir kez daha çalıştırılır. Ardından düşen **her akış**
yeni bir sürücü oturumunda bir kez daha çalışır ve ikinci sonucu sayılır (CI simülatöründe sürücü ara
sıra dokunuş kaçırır ya da takılır). Yeşil bir çalıştırmada da bir akış yeniden denenmiş olabilir:
yeniden denenenler çalıştırma özetinde "Retried once" satırında listelenir.
Derleme adımı uzantının (`PlugIns/ExpoWidgetsTarget.appex`) gömüldüğünü, App Group'u,
`aps-environment` olmadığını ve uygulama ile uzantıda `PrivacyInfo.xcprivacy` (`1C8F.1`) bulunduğunu da denetler.
Yeni ekran öğesine test gerekiyorsa metni değil `testID`'yi hedefleyin; mevcut `testID`'leri
değiştirmeyin (akışlar ve `scripts/test-web.mjs` bunlara bağlı).

### `testflight.yml` (elle `workflow_dispatch` veya `v*` etiketi)
App Store Connect yüklenen her derlemeyi dış teste ya da App Review'a gönderebildiği için iki kapı var:
- **Kapı işi** (`gate`, ubuntu; macOS dakikası harcanmadan): `v*` etiketi `app.json` → `expo.version`
  ile aynı olmalı (`v0.4.0` ↔ `0.4.0`); `internal_only` işaretli değilse yalnız `main`, `main`
  üzerindeki bir commit'e konmuş `v*` etiketi (`git merge-base --is-ancestor`) ya da incelemedeki
  sürümün `release/<sürüm>` dalı (`<sürüm>` = `app.json` → `expo.version`) derlenir; `npm ci`,
  `npx tsc --noEmit`, `npx jest --ci` geçmeli. macOS işi (`needs: gate`) ancak bundan sonra başlar.
- **Veri sorumlusu kapısı:** `DATA_CONTROLLER_NAME`, `DATA_CONTROLLER_CONTACT` gizli değerlerinden
  biri boşsa derleme yüklenmez. Gerçek ad ve e-posta bu herkese açık depoda yoktur: arşiv adımı onları `EXPO_PUBLIC_DATA_CONTROLLER_*` olarak
  JS paketine gömer. `src/strings.ts` her zaman `[DOLDURULACAK]` yer tutucusunu içerir; kapıyı geçmek
  için oraya gerçek değer **yazmayın** (bny kararı, 11 Ekim 2026).

Tek istisna, elle başlatılan ve `internal_only` işaretli çalıştırmadır
(`gh workflow run testflight.yml -R bnycftc/etut --ref <dal> -f internal_only=true`): gizli değerler
olmadan (uygulama yer tutucuyu gösterir) ve `main` / `release/<sürüm>` dışındaki bir daldan da derler. Böyle bir derleme
**yalnız iç TestFlight** içindir, dış test grubuna ya da App Review'a gönderilmez (çalıştırma özetinde
derleme numarası yazar). İncelemeye yalnız gizli değerlerle, `main`'den ya da `release/<sürüm>` dalından derlenmiş sürüm gider.
macOS 26 koşucusu:
1. Veri sorumlusu gizli değerlerini denetler (yukarıda); Xcode sürümünü yazdırır (SDK 57 için 26.4
   altıysa uyarı verir).
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
   Gizli değerler tanımlıysa veri sorumlusu e-postasının `main.jsbundle`'da bulunduğu denetlenir
   (yalnız sayı yazılır, değer asla).
10. Aynı arşiv `ci/ExportOptions.plist` (`app-store-connect`, `upload`) ile App Store Connect'e yüklenir.
11. Hata olursa yalnız loglar (`archive.log`, `export.log`, `upload.log`, `*.xcdistributionlogs`)
    7 günlük artifact olarak saklanır; imzalı arşiv ve IPA yüklenmez (depo herkese açık, artifact'ı
    GitHub'a giriş yapan herkes indirebilir). Xcode betik aşamalarının ortamını ham loga yazdığı için
    veri sorumlusu değerleri yüklemeden önce loglardan silinir ("Scrub data controller from logs").
12. Her durumda: CI'ın oluşturduğu "Created via API" geliştirme sertifikaları iptal edilir,
    API anahtarı ve geçici anahtarlık silinir. Bu adım takımdaki **tüm** "Created via API"
    geliştirme sertifikalarını siler; aynı takımı kullanan CarPlay Medya iş akışıyla aynı anda
    çalıştırmayın (biri diğerinin arşiv sertifikasını iptal edebilir).

Sürüm numarası (`CFBundleShortVersionString`) `app.json` → `expo.version` alanından gelir
(şu an `0.4.0`). Derleme numarası `<çalıştırma numarası>.<deneme numarası>` biçimindedir (ör. `12.1`); "Re-run jobs" deneme numarasını artırdığı için aynı numara iki kez yüklenmez.

### `store-screenshots.yml` (elle ya da `store-screenshots` dalına push)
6.9" iPhone (1320 × 2868) App Store ekran görüntüleri, simülatörde ve gerçekçi demo verisiyle.
Derleme `e2e-ios.yml` ile aynıdır (Release, gömülü JS paketi, ad-hoc imza); `.app` uygulama
kaynaklarının özetine göre önbelleklenir; yalnız akışlar ya da bu iş akışı değiştiyse derleme atlanır.
`e2e/store/demo-backup.js` çalıştırma gününe göre tarihli bir yedek üretir, iş akışı onu simülatörün
"iPhone'umda" klasörüne kopyalar, `e2e/store/screenshots.yaml` uygulamanın "Yedekten geri yükle"
ekranından geri yükleyip görüntüleri alır (düşen deneme bir kez baştan çalışır). Demo verisi her
hafta bir dinlenme günü (pazar) ve daha hafif günler içerir; seri uygulamanın kendi kuralıyla
(haftada 1 dinlenme günü) sürer (`src/domain/__tests__/store-demo-backup.test.ts`). Akış ayrıca
"Çalışmaya devam say" seçip pomodoroyu ~400 sn çalıştırır, sonra gerçek Dynamic Island ve Live
Activity görüntülerini Maestro `cropOn` ile kırpar (`part-*`; tam ekranları `tam-*`). Ardından
simülatör koyu moda alınır ve `e2e/store/screenshots-dark.yaml` "Yedekle ve geri yükle" ekranını
çeker (`koyu-yedek`). Alfa kanalı atılır, boyut denetlenir; çıktı `app-store-screenshots-6.9`
(ham `NN-ad.png` ekranlar) ve `app-store-screenshots-6.9-parts` (`part-*`, `tam-*`, `koyu-*`)
artifact'larıdır. App Store Connect'e hiçbir şey gönderilmez, gizli değer gerekmez.

### `store-frames.yml` (elle, ubuntu, ~2 dk)
Başarılı bir `store-screenshots.yml` çalıştırmasının (`run_id`) iki artifact'ını
`scripts/store-compose.mjs` ile çerçeveler: marka gradyanı (koyu kare için "night"), ikondaki 270°
yay, gerçek ekran yuvarlak kartta, başlık Inter Display Bold, alt satır Inter Medium
(`store/fonts/`, Inter 4.1, OFL-1.1, değiştirilmeden). Sıra, yerleşim ve metinler
`store/app-store/tr/screenshots.json`'da; başlık en çok 35, alt satır en çok 70 karakter, en çok 2
satır, satır genişliği ölçülür, kontrast (WCAG AA) ve yasak sözcükler (fiyat, LGS, sıralama, sosyal,
seri kaybı …) denetlenir; "Hesap yok" karesi yalnız `GROUPS_ENABLED=false` iken çizilir. Sahte cihaz
çerçevesi ya da çizilmiş kilit ekranı yoktur; kahraman karesi yalnız gerçek kırpmaları kullanır
(`cropOn` SpringBoard öğesini bulamazsa `tam-*` görüntülerinden koyu bant aranarak kırpılır).
Başlık değişikliği için 90 dakikalık macOS koşusu gerekmez. Çıktı
`app-store-screenshots-6.9-framed` (yalnız `NN-ad.png`, 1320 × 2868 RGB) ve
`store-frames-preview` (tüm kareler ve arama sonucundaki ilk üç kare). Yerelde:
`npm run store:compose -- --raw <ham klasör> --out test-results/store-framed --preview test-results/store-preview`
(`--skip-missing` eksik kaynaklı kareleri atlar); test: `npm run test:store-compose` (CI'da da koşar).

### App Store Connect iş akışları (yalnız elle, ubuntu)
Hepsi `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_PRIVATE_KEY` ile çalışır; hiçbiri incelemeye göndermez,
derleme bağlamaz, fiyat ya da erişilebilirliğe dokunmaz.
- `asc-key-check.yml`: yalnız okur. Anahtarı (JWT, `GET /v1/apps`), bundle id'leri ve yeteneklerini,
  sertifika/profil sayılarını ve son 3 derlemenin işlenme ve iç TestFlight durumunu yazdırır.
- `asc-metadata.yml`: `store/app-store/` → App Store sayfası (tr ad ve alt başlık, açıklama, anahtar
  kelimeler, tanıtım metni, destek/pazarlama URL'si, kategoriler, yaş derecelendirmesi, içerik
  hakları, telif satırı `DATA_CONTROLLER_NAME`'den, App Review notları). Yazmadan önce Apple
  sınırlarını denetler. Varsayılan **kuru çalıştırma**: şimdiki ve istenen değerleri yazdırır, hiçbir
  şey yazmaz. `apply=true` yalnız farklı olanı yazar; düzenlenebilir sürüm yoksa `app.json` sürümüyle
  oluşturur. App Privacy'ye dokunmaz.
- `asc-privacy-url.yml`: düzenlenebilir uygulama bilgisinin her dilinde Gizlilik Politikası URL'sini
  yazar (varsayılan `https://bnycftc.github.io/etut/gizlilik.html`). Kuru çalıştırması yoktur.
- `asc-screenshots.yml`: başarılı bir `store-frames.yml` (çerçeveli set) ya da `store-screenshots.yml`
  (ham ekranlar) çalıştırmasının (`run_id`) görüntülerini düzenlenebilir sürümün tr `APP_IPHONE_67`
  setine koyar. Düzenlenebilir sürüm, iş akışının çalıştığı dalın `app.json` sürümü değilse kuru
  çalıştırmada da hiçbir şey yazmadan durur (mağaza seti `release/<sürüm>` dalından yüklenir);
  isteğe bağlı `expect_version` girdisi de o sürümle aynı olmalıdır. Varsayılan **kuru çalıştırma** (setteki ve
  yüklenecek dosyaları, sıralarını yazdırır); `apply=true` seti değiştirir: ilk dosyayı yükler,
  eskileri siler, kalanları dosya adı sırasıyla yükler, işlenmelerini bekler ve sırayı düzeltir.
  Fark yoksa yazmaz; yalnız ekran görüntüsü uçlarına yazar.

### GitHub gizli değişkenleri (Settings → Secrets and variables → Actions)

| Ad | Zorunlu | İçerik |
|---|---|---|
| `ASC_KEY_ID` | evet | App Store Connect API anahtar kimliği |
| `ASC_ISSUER_ID` | evet | Issuer ID |
| `ASC_PRIVATE_KEY` | evet | `AuthKey_XXXX.p8` içeriği (ham metin ya da base64) |
| `DIST_CERT_P12_BASE64` | önerilir | Apple Distribution sertifikası .p12 dosyasının base64'ü |
| `DIST_CERT_PASSWORD` | p12 varsa | .p12 parolası |
| `DATA_CONTROLLER_NAME` | evet (`internal_only` dışında) | Veri sorumlusunun adı; Hakkında ve yasal metinlerde görünür, `asc-metadata.yml` telif satırına da yazar |
| `DATA_CONTROLLER_CONTACT` | evet (`internal_only` dışında) | Destek ve KVKK başvurusu e-postası (Hakkında'daki İletişim düğmesi) |

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
sekmesi hiç görünmez (yalnız "yakında" diyen bir sekme App Store 2.1 açısından ret riski). Bayrak açılınca:

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
Onay penceresi önce "Önce yedek al"ı sunar: Yedek ekranındaki dışa aktarmayı çalıştırır, hiçbir şey
silmez ve pencere açık kalır; paylaşım sayfası kapanınca dosyayı bir yere kaydetmenin öğrenciye
kaldığını söyler (Etüt nereye kaydedildiğini bilemez).
iOS'ta widget için bugünkü süre, seri ve hedef aynı cihazdaki App Group kabında; canlı sayaçta
ders/konu adı kilit ekranında görünür. "Tüm verileri sil" canlı sayacı bitirir, widget'ı boş
görünüme çevirir ve zamanlanmış hatırlatıcıları iptal eder. Bildirimler yalnız yereldir (push yok).
İstisna (hukuk/03 K-17): yalnız 15 yaş altı beyanında, beyan edilen doğum yılı 15 yaşına
gelene kadar ayrı bir dosyada (`EtutAgeGuard`, `src/storage/age-guard.ts`) kalır; silme sonrası
15+ beyanına geçişi engellemek için. Süresi dolunca açılışta, uygulama kaldırılınca da silinir.

Veri cihazdan yalnız öğrenci dokunduğunda, sistemin paylaşım sayfasıyla çıkar; uygulama hiçbir
ağ isteği atmaz (`test:web` bunu denetler):
- **Yedek** (`Ayarlar → Yedekle ve geri yükle`): `etut-yedek-<gün>.json`, biçim `src/domain/backup.ts`
  (`format: "etut-yedek"`, `schemaVersion: 2`; 1 sürümlü eski dosyalar da okunur; oturumlar,
  denemeler + analizler, konu işaretleri, ayarlar, profil). İçe aktarma: tam şema doğrulaması (tek
  hatalı kayıt → hiçbir şey yazılmaz), daha yeni sürüm reddedilir, "Birleştir" (bu cihaz kazanır, eksikler eklenir) ya da "Değiştir";
  kimliklere göre idempotent; uygulamanın yazdığı her kayıt geri okunur (ör. bir hafta açık
  kalmış oturum); süre sınırı yok, zaman sınırı var (2016 sonrası başlangıç, dosya tarihinden en
  fazla 1 gün sonra bitiş). "Birleştir"de burada boş olan ayarlar (kaldırılmış hedef dahil) yedekten dolar.
  Sınav tabloları değişirse (ÖSYM soru sayısını değiştirir, bir ders/deneme türü kalkar) eski dosya yine
  yüklenir: şimdiki tabloya uymayan deneme ve net hedefleri atlanır ve önizlemede sayılır. "Değiştir"
  ikinci kez onay ister ve yazmadan önce bu cihazdaki verinin kopyasını kv deposuna alır; yedek
  ekranında bir gün boyunca "Geri al" ile o hâline dönülür ("Tüm verileri sil" kopyayı da siler).
  Kopya alınır alınmaz geri okunur; her şeyi geri getiremeyecekse (okunamıyor ya da tabloya uymayan
  deneme/hedef var) "Değiştir" yapılmaz. "Kopyayı sil" de ikinci kez onay ister.
  K-17: yaş yedekle yükseltilemez; yedekteki yaş daha küçükse küçük olan esas alınır (seçicinin
  sunmadığı bir yıl, ör. 2200, yok sayılır), 15 altı bayrağı içe aktarmayla kapanmaz. Dosya
  şifrelenmez (metinde yazıyor).
- **CSV** (KVKK taşınabilirlik): oturumlar ve denemeler; `;` ayraçlı, UTF-8 BOM, ondalık virgül,
  formül enjeksiyonuna karşı korumalı (`src/domain/csv.ts`).
- **Çalışma kartı**: 1080×1920 PNG; yalnız süre, ders dağılımı, seri ve hedef (ad, yaş, okul,
  sınav türü yok).

Yasal metinler (`src/strings.ts` → `legalDocs`) şu anki sunucusuz davranışa göre yazıldı. Veri
sorumlusunun adı ve e-postası bu herkese açık depoda **yoktur** (bny kararı, 11 Ekim
2026): `DATA_CONTROLLER` sabiti `EXPO_PUBLIC_DATA_CONTROLLER_*` değişkenlerini okur, yoksa
`[DOLDURULACAK]` gösterir. TestFlight derlemesi değerleri `DATA_CONTROLLER_NAME` /
`_CONTACT` gizli değerlerinden alır (yukarıda `testflight.yml`); testler, E2E ve web yer tutucuyu
gösterir. Gerçek değerleri `src/strings.ts`'e yazmayın. Posta adresi uygulamanın hiçbir yerinde
yoktur; iletişim ve KVKK başvurusu yalnız e-postayla (bny kararı, 18 Ekim 2026).
