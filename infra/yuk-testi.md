# NAT yük testi (hesap kaybı, WP-H)

Okul Wi-Fi'ı ya da operatör NAT'ı arkasında bir sınıf, hatta bir okul, tek IP'den gelir. GoTrue
IP başına sınır koyar (`supabase/docker-compose.override.yml`):

| Sınır | Değer | Kova |
|---|---|---|
| Anonim kayıt (`GOTRUE_RATE_LIMIT_ANONYMOUS_USERS`) | 300 / saat / IP | ani yük 300 |
| Token yenileme (`GOTRUE_RATE_LIMIT_TOKEN_REFRESH`) | 3000 / 5 dk / IP (10/sn) | ani yük **30** (GoTrue v2.196.0 `apilimiter.go`, ayarlanamaz) |

Yenileme 429 alırsa auth-js bunu kalıcı hata sayar ve erişim belirtecinin süresi dolmuşsa
oturumu siler (`@supabase/auth-js` `lib/fetch.js` `handleError`, `GoTrueClient.js`
`_callRefreshToken`). Anonim hesaba bir daha girilemez. Uygulama bu yüzden yenilemedeki 429'u
503'e çevirir (`src/sync/client.ts`); auth-js 503'ü yeniden dener ve oturumu tutar. Bu test,
o önlemin gerçek yığında tuttuğunu ve sınırların bir sınıfa yettiğini ölçer.

## Betik

`scripts/nat-load.mjs`: N öğrenci bu makineden (tek IP) anonim kaydolur, profil açar, her 30
dakikada bir token yeniler ve birkaç RPC çağırır (`get_me`, `my_groups`); sonunda hesaplarını
siler. Süre sıkıştırılır (`--olcek 60`: 30 dk → 30 sn). Bütün sınıf aynı anda kaydolur ve aynı
tikte yeniler; en kötü durum budur.

Rapor: kayıt (açıldı / 429 / başka hata), yenileme (başarılı / ertelendi / kalıcı hata), RPC,
**kaybolan oturum**, uç türüne göre HTTP durumları ve 429 toplamı. Kaybolan oturum varsa çıkış
kodu 1'dir. `--ham` sarmalayıcıyı kapatır (auth-js'in kendi davranışı): karşılaştırma içindir.

## Adımlar

1. **Yerel yığın** (Docker): `npx supabase start`, sonra
   `node scripts/nat-load.mjs --ogrenci 40 --sure 120` ve `--ham` ile bir kez daha.
   `supabase/config.toml` sınırları üretimle aynıdır; yerel CLI yığını IP başlığı
   (`X-Forwarded-For`) olmadan IP sınırı uygulamayabilir, o zaman 429 sayısı 0 çıkar. Asıl
   ölçüm 2. adımdır.
2. **Sunucu** (bny ile, açılıştan önce; S paketi "NAT denemesi"):
   - Testi gerçek öğrencilerin kullanmadığı bir bağlantıdan çalıştır (ev, mobil hat). Kovalar
     IP başınadır; test o IP'nin kovasını doldurur. 300 kayıtlık bir koşudan sonra o IP bir
     saat kayıt açamayabilir; gerekirse `docker compose restart auth` kovaları sıfırlar
     (bellek içidir).
   - `node scripts/nat-load.mjs --url https://api.<alan> --key <genel anahtar> --ogrenci 40 --sure 120 --onay`
   - Aynısını `--ogrenci 120` (üç sınıf) ve `--ogrenci 350` (kayıt sınırının üstü) ile.
   - Her koşudan sonra GoTrue günlüğünde 429'lara bak:
     `docker compose logs auth --since 30m | grep -c over_request_rate_limit`
   - Betiğin sildiği hesapları doğrula: `audit.destruction_log` içinde `account_on_request`
     satırı sayısı, açılan hesap sayısıyla aynı olmalı.
3. Sonuçları aşağıya yaz. **Kabul:** sarmalayıcı açıkken kaybolan oturum 0; 40 öğrencilik
   koşuda kayıt 429'u 0. Tutmazsa sınırları yükselt, override'daki notu ve bu tabloyu güncelle.

## Sonuçlar

| Tarih | Hedef | Öğrenci | Süre (dk) | Ölçek | Kip | Kayıt açıldı / 429 | Yenileme başarılı / ertelendi / kalıcı | Kaybolan oturum | 429 (signup / refresh / rpc) | GoTrue günlüğü 429 | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |
