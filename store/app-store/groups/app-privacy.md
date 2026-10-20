# App Privacy cevapları — grup sürümü (0.5.0 public)

App Store Connect > Uygulama > App Privacy. Bu bölüm API ile yazılmıyor (asc-metadata.yml App
Privacy'ye dokunmaz); aşağıdaki cevaplar elle girilir. Herkese açık sürümden önce, gönderilecek
derlemeyle karşılaştırılarak girilir (K-44 engeli). Kapalı beta (GROUPS_PHASE 'beta18') için App
Privacy değişmez; TestFlight bu etiketi göstermez.

Gönderilen derlemede bir SDK, izin ya da sunucuya giden yeni bir veri eklenirse bu liste yeniden
doldurulur. app.json `ios.privacyManifests` aynı veri türlerini taşır (WP-F).

## Ön sorular

- Privacy Policy URL: gruplu gizlilik metninin web adresi (src/config/legal.ts `PRIVACY_NOTICE_URL`).
- Do you or your third-party partners collect data from this app? → **Yes**
- Tracking: hiçbir satırda "Used to track you" işaretlenmez. ATT istemi yok.

## Toplanan veri türleri

Her satırda: **Linked to the user: Yes**, **Used for tracking: No**, amaç yalnız **App Functionality**.

| Apple veri türü | Ne | Nerede |
|---|---|---|
| Identifiers > **User ID** | Hesap kimliği (UUID) ve takma ad | auth.users, app.profiles |
| User Content > **Other User Content** | Grup adı (kullanıcının yazdığı metin) | app.groups |
| Usage Data > **Other Usage Data** | Çalışma oturumları (ders, konu, süre), "şu an çalışıyor" durumu, günlük toplamlar, hazır tepkiler, grup üyelikleri | app.study_sessions, app.presence, app.daily_totals, app.reactions |
| Diagnostics > **Other Diagnostic Data** | Güvenlik kaydındaki IP adresi ve işlem zamanı (5651, 395 gün) | audit.ip_events |
| Other Data > **Other Data Types** | Yaş bandı (15–17 / 18+; doğum yılı gönderilmez), sınav türü ve alan | app.profiles |
| User Content > **Customer Support** | Uygulama içi KVKK başvurusu ve şikâyet metni (en çok 2000 karakter serbest metin, talep türü) ve cevabımız | app.dsr_requests (WP-C) |

## Toplanmayanlar (No)

- Contact Info (ad, e-posta, telefon, adres): toplanmıyor. Anonim hesapta e-posta boş kalır
  (supabase/tests-ts/auth-anon.test.ts, WP-H). Apple/Google ile giriş yok.
- Identifiers > Device ID: yok (push yok, kurulum kimliği sunucuya gitmez).
- Usage Data > Product Interaction, Advertising Data: yok (analitik ve reklam yok).
- Diagnostics > Crash Data, Performance Data: yok (uygulamada çökme raporu SDK'sı yok).
- Location, Contacts, Health & Fitness, Financial Info, Sensitive Info, Browsing/Search History,
  Audio, Photos or Videos, Purchases: yok.

## Girdikten sonra

- Etiketin önizlemesini gizlilik metni ve Data safety (Android) ile karşılaştır: aynı şeyleri
  söylemeli (kvkk/11 §5).
- 15 yaş altı cihaz modunda veri toplanmaz; etiket hesaplı kullanıcıya göredir, fark gizlilik
  metninde anlatılır.
