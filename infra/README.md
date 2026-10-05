# Üretim altyapısı: İlkbyte VPS kurulum runbook'u

Bu klasör yalnız dosya hazırlar. Hiçbir sunucuya bağlanılmadı, hiçbir şey satın alınmadı.
Dayanak: `docs/hukuk/kvkk/00-aktarim-cozumu.md` (kişisel veri Türkiye'de, kendi barındırdığımız
Supabase + GlitchTip), `docs/arastirma/5-1-sunucu-saglayici.md` (İlkbyte Cloud III ana sunucu,
Radore Disk-Core yedek kutusu), `docs/hukuk/kvkk/09-saklama-imha.md` (saklama süreleri).

## Mimari

```
Uygulama ──HTTPS──▶ Caddy (443, Let's Encrypt, Cloudflare YOK)
                     ├─ api.<alan>/auth/v1/*, /rest/v1/*  ──▶ 127.0.0.1:8000 Supabase API ağ geçidi (Envoy)
                     │                                          ├─ auth (GoTrue: anonim + Apple/Google)
                     │                                          └─ rest (PostgREST: yalnız public şemasındaki RPC'ler)
                     ├─ api.<alan>/saglik                    ──▶ "ok" (dış izleme için, veri taşımaz)
                     └─ hata.<alan>                          ──▶ 127.0.0.1:8001 GlitchTip
Postgres (supabase/postgres + pgBackRest) ── WAL arşivi + yedek ──SFTP──▶ Radore (İstanbul), istemci tarafında AES-256
restic (yapılandırma, sertifikalar, erişim kayıtları, GlitchTip dökümü)  ──SFTP──▶ Radore
Studio ve Postgres: yalnız 127.0.0.1; erişim SSH tüneliyle.
```

Dışarı açık portlar yalnız 22, 80, 443 (ufw). Docker'ın yayımladığı portlar ufw'yi atlar; bu
yüzden her yayımlanan port `127.0.0.1`'e bağlıdır (`supabase/docker-compose.override.yml`,
`glitchtip/compose.yml`) ve `healthcheck.sh` dışarıya açık beklenmeyen port olmadığını denetler.

## Sabit sürümler

| Bileşen | Sürüm | Nerede |
|---|---|---|
| Ubuntu | 24.04 LTS | 01-harden.sh denetler |
| Supabase self-hosted dosyaları | `self-hosted/v0.8.2` | 03-supabase.sh `SUPABASE_SELF_HOSTED_TAG` |
| Postgres imajı | `supabase/postgres:17.6.1.136` (+ pgBackRest, `supabase/db/Dockerfile`) | compose; 03 kontrol eder |
| GoTrue / PostgREST / Envoy / Studio … | v0.8.2 compose'undaki etiketler (ör. `supabase/gotrue:v2.196.0`, `postgrest/postgrest:v14.17`) | ilk kurulumda `ETUT_IMAGE_DIGESTS` dosyasına özet değerleri yazılır |
| GlitchTip | `glitchtip/glitchtip:6` + `postgres:18` | 06-glitchtip.sh ilk çekişten sonra `@sha256:` özetine sabitler |
| Caddy | resmi apt deposu (stable) | 05-caddy.sh |
| Docker Engine + compose | resmi apt deposu, `apt-mark hold` | 02-docker.sh (compose ≥ 2.24 gerekli) |
| pgBackRest | PGDG deposu, ≥ 2.46 (SFTP deposu için) | db imajı derlenirken yazdırılır |
| restic | Ubuntu 24.04 paketi | 01-harden.sh |

## 0. bny'nin elle yapacakları (satın alma ve hesap işleri Claude yapmaz)

1. `docs/arastirma/5-1-sunucu-saglayici.md` bölüm 5'teki soruları sağlayıcılara yazılı sor.
2. İlkbyte Cloud III (Ubuntu 24.04) ve Radore Disk-Core satın al; KVKK veri işleme
   sözleşmelerini imzala. Radore kutusunda yalnız SFTP yapabilen `etutbackup` kullanıcısı aç.
3. `.com.tr` alan adı al; `api.` ve `hata.` alt alan adları için A kayıtlarını sunucu IP'sine
   yönlendir (yalnız DNS, vekil yok).
4. Sunucuya kendi SSH açık anahtarını ekle.

## 1. Sunucuyu hazırla

```bash
# Kendi bilgisayarından (ilk kez, root ile):
scp -r infra root@<sunucu>:/root/etut-infra      # ya da depoyu sunucuda klonla
ssh root@<sunucu>
mkdir -p /etc/etut && cp /root/etut-infra/etut.conf.example /etc/etut/etut.conf
chmod 600 /etc/etut/etut.conf && nano /etc/etut/etut.conf    # alan adları, e-posta, SSH anahtarı, yedek kutusu
bash /root/etut-infra/scripts/01-harden.sh
```

Doğrula: YENİ bir terminalde `ssh etut@<sunucu>` çalışıyor; `ssh root@<sunucu>` reddediliyor;
`sudo ufw status` yalnız 22/80/443. Sonra `sudo passwd etut` ile sudo parolası ver.

## 2. Docker, Supabase, göçler

Depoyu sunucuda `/opt/etut/repo` altına klonla (özel depo: salt okunur bir deploy anahtarıyla).

```bash
sudo bash /opt/etut/repo/infra/scripts/02-docker.sh
sudo bash /opt/etut/repo/infra/scripts/03-supabase.sh
sudo bash /opt/etut/repo/infra/scripts/04-migrate.sh
```

- 03, resmi `utils/generate-keys.sh` ve `utils/add-new-auth-keys.sh` ile tüm sırları üretir,
  kalan bilinen varsayılanları da değiştirir ve biri kalmışsa durur. Sırlar yalnız
  `/opt/etut/supabase/.env` (600) içindedir; git'e, sohbete ya da e-postaya girmez.
- E-posta ve telefon kaydı kapalı, anonim giriş açık, Apple ile bağlama açık (istemci kimliği
  `com.bnycftc.etut`). `PGRST_DB_SCHEMAS` yalnız `public,graphql_public`: `app` ve `audit`
  şemaları API'de yoktur.
- 04, `supabase/migrations/*.sql` dosyalarını sırayla, her birini bir kez uygular
  (`ops.migrations`) ve pg_cron işlerini listeler (`etut-leaderboards`, `etut-purge`).

Doğrula: `cd /opt/etut/supabase && docker compose ps` hepsi `healthy`.

**Studio'ya erişim (yalnız SSH tüneli):**
```bash
ssh -L 8000:127.0.0.1:8000 etut@<sunucu>
# tarayıcıda http://localhost:8000 — kullanıcı/parola: .env içindeki DASHBOARD_USERNAME / DASHBOARD_PASSWORD
```

## 3. Caddy ve TLS

```bash
sudo bash /opt/etut/repo/infra/scripts/05-caddy.sh
```

Doğrula: `curl https://api.<alan>/saglik` → `ok`; `curl https://api.<alan>/` → 404 (Studio dışarıda yok).
Erişim kayıtları `/var/log/caddy/*-access.log`: istemci IP ve portu, zaman, süre, aktarılan bayt,
host/URI; istek ve yanıt başlıkları silinir (belirteç, cihaz parmak izi tutulmaz). Saklama 400 gün
(5651 m.5/3: en az 1, en fazla 2 yıl). `etut-loghash.timer` her gün döndürülmüş kayıtların SHA-256
değerini zincirli bir deftere yazar; `sudo /opt/etut/bin/log-hash.sh --verify` bütünlüğü denetler.

## 4. GlitchTip

```bash
sudo bash /opt/etut/repo/infra/scripts/06-glitchtip.sh
cd /opt/etut/glitchtip && sudo docker compose exec web ./manage.py createsuperuser
```

Kayıt kapalı, olaylar 90 gün saklanır (kvkk/09). Uygulamaya hata SDK'sı henüz eklenmedi; eklenince
DSN `https://hata.<alan>/...` olur ve 15 yaş altı cihaz modunda hiç başlatılmaz (K-16).

## 5. Yedek

```bash
sudo bash /opt/etut/repo/infra/scripts/07-backup.sh
sudo bash /opt/etut/repo/infra/scripts/08-timers.sh
```

- pgBackRest: Postgres `archive_command` ile her WAL parçasını Radore'ye gönderir (en geç 5 dk,
  `archive_timeout=300`); her gece fark yedeği, pazar tam yedek; 30 gün saklama.
- restic: `/etc/etut`, Caddy yapılandırması/sertifikaları/erişim kayıtları, compose dosyaları ve
  `.env`'ler, GlitchTip dökümü; 30 gün.
- İki şifre (`/etc/etut/secrets/pgbackrest-cipher`, `restic-password`) yedeklenmez. Kurulumda
  çevrimdışı parola yöneticisine kopyala; kaybolursa yedekler okunamaz (bu kriptografik silmeyi de
  mümkün kılar: kvkk/09 §6).

## 6. Geri yükleme denemesi (ilk hafta, sonra 3 ayda bir)

```bash
sudo /opt/etut/bin/restore-drill.sh
```

Son yedek + WAL ayrı, ağsız bir kapsayıcıya geri yüklenir; canlı veritabanıyla satır sayıları
yan yana yazılır; restic'ten bir dosya geri alınır. Sonucu (tarih, süre, fark) ops kaydına yaz.

### Felaket: yeni sunucuya geri yükleme

1. Radore'de (ya da İlkbyte'ta) yeni bir Ubuntu 24.04 aç; 1–3. adımları uygula, **ama 03'ten sonra
   `docker compose stop db`**.
2. Eski `/etc/etut` ve `.env` dosyalarını restic'ten geri al:
   `restic restore latest --tag etut --target / --include /etc/etut --include /opt/etut/supabase/.env`
   (restic şifresi parola yöneticisinden).
3. Veri dizinini boşalt ve pgBackRest ile geri yükle:
   `docker compose run --rm -u postgres --entrypoint pgbackrest db --stanza=etut --delta restore`
   (belirli ana dönmek için `--type=time --target="2026-11-01 03:00:00+03"`).
4. `docker compose up -d --wait`, `04-migrate.sh` (yalnız eksik göçleri uygular), 05–08.
5. DNS A kaydını yeni IP'ye çevir. Uygulamadaki adres değişmez (alan adı aynı).

## 7. İzleme

`etut-health.timer` 5 dakikada bir `healthcheck.sh` çalıştırır (`journalctl -u etut-health`):
kapsayıcı sağlığı, HTTPS ucu, Auth sağlığı, beklenmeyen açık port, sertifika süresi (≥ 14 gün),
disk (< %80), bellek, son yedek (< 26 saat), WAL arşivi (< 15 dk), sıralama işi (< 15 dk).
Dış izleme: Türkiye'de bir izleme hizmeti ya da ikinci kutudan `curl https://api.<alan>/saglik`
(yalnız "ok" döner, kişisel veri taşımaz).

## 8. Güncelleme

1. Supabase sürüm notlarını oku. `03-supabase.sh` içindeki `SUPABASE_SELF_HOSTED_TAG`'i ve gerekirse
   `EXPECTED_DB_IMAGE` ile `supabase/db/Dockerfile` / override'daki Postgres etiketini değiştir.
2. Önce yedek: `sudo /opt/etut/bin/backup-run.sh`.
3. `/opt/etut/supabase` içinde resmi `sh update.sh` (üç yollu birleştirme), sonra
   `docker compose build db && docker compose pull --ignore-buildable && docker compose up -d --wait`.
4. `04-migrate.sh`, `healthcheck.sh`, uygulamadan duman testi. `ETUT_IMAGE_DIGESTS` dosyasını yenile.

## 9. Uygulamayı bağlama

Derleme ortamında (GitHub Actions gizli değişkeni değil, açık değerler):
`EXPO_PUBLIC_SUPABASE_URL=https://api.<alan>` ve `EXPO_PUBLIC_SUPABASE_KEY=<.env içindeki
SUPABASE_PUBLISHABLE_KEY ya da ANON_KEY>`. Bu anahtar herkese açıktır; erişimi RLS ve RPC'ler
belirler. Sonra `src/config/features.ts` → `GROUPS_ENABLED = true` (ayrı bir sürüm, App Privacy
beyanı güncellenerek: "Data Not Collected" artık doğru değildir; `docs/hukuk/kvkk/11`).

## Saklama ve imha (sunucu tarafı, kvkk/09 ile)

| Veri | Süre | Nasıl |
|---|---|---|
| Profil, üyelik, oturum, günlük toplam | hesap süresince; hesap silmede hemen | `delete_my_account` → `auth.users` silinir, `app.*` zincirleme silinir |
| Kullanılmayan hesap | anonim 6 ay, Apple/Google bağlı 24 ay | `app.purge_expired()` her gün 03:30 (İstanbul) |
| Profilsiz oturum açılmış hesap | 1 gün | aynı iş |
| Hazır tepkiler | 90 gün | aynı iş |
| Veli bildirimleri (bağlantı öğrenci tarafında bitti; yalnız tür ve zaman) | 90 gün; bildirimi olan profilsiz veli hesabı o süre silinmez | aynı iş |
| Katılma istekleri | karar sonrası 30 gün | aynı iş |
| Raporlar (moderasyon kaydı) | kapanıştan sonra 2 yıl; hesap silinince kişi bağı kaldırılır | aynı iş |
| Denetim kaydı `audit.events` (hesap no + işlem + zaman) ve `audit.ip_events` (IP, ayrı tablo) | 395 gün; hesap silmeden sonra da (K-37 trafik istisnası) | aynı iş, yalnız bu iş silebilir |
| Caddy erişim kayıtları | 400 gün | Caddy `roll_keep_for` |
| İmha kaydı `audit.destruction_log` (yalnız sayılar) | 3 yıl | aynı iş |
| Yedekler | 30 gün döngü | pgBackRest / restic |
| GlitchTip olayları | 90 gün | `GLITCHTIP_MAX_EVENT_LIFE_DAYS` |

## Doğrulanamayanlar [KONTROL]

- Kurulum betikleri gerçek bir sunucuda çalıştırılmadı (sunucu yok). Her betik `set -euo pipefail`
  ile ilk hatada durur; ilk kurulumda adım adım izleyin.
- `supabase/postgres:17.6.1.136` imajının Ubuntu tabanlı olup apt ile PGDG pgBackRest'i kurabildiği,
  varsayılan kullanıcısının root olduğu (`supabase/db/Dockerfile` notları) ve pgBackRest'in
  `supabase_admin` ile soket üzerinden bağlanabildiği ilk derlemede doğrulanmalı.
- Envoy ağ geçidinin `X-Forwarded-For`'u Caddy'nin yazdığı istemci IP'siyle başlattığı
  (veritabanı denetim kaydı ilk girdiyi okur) ilk kurulumda bir istekle kontrol edilmeli.
- Caddy `format filter` alan adları (`request>headers`) kurulu Caddy sürümünde `caddy validate`
  ile doğrulanır (05 bunu yapar).
- Radore kutusunun SFTP sunucusunun pgBackRest/restic ile uyumu (ilk `pgbackrest check`).
- Apple ile Giriş belirteci iptali (hesap silmede Apple'a tek seferlik çağrı) henüz yok.
- Resmî self-hosted compose dosyası (depoda değil, kurulumda klonlanır) `analytics` (Logflare) ve
  `vector` servislerini içerebilir. `vector` tüm kapsayıcı günlüklerini (GoTrue / ağ geçidi erişim
  satırları: istemci IP'si, yol) toplayıp ayrı bir şemaya yazar; bu kayıtların saklama süresi
  yukarıdaki tabloda yok. İlk kurulumda `docker compose config --services` ile bak: varsa Studio
  günlük ekranı gerekmediği için kapat (override'da `profiles: ["disabled"]`), ya da saklamayı
  395 güne sabitleyip `docs/hukuk/kvkk/08` #14 ve 09 §7'ye ekle.
- GoTrue `auth.sessions` tablosu her oturum için `ip` ve `user_agent` tutar (sürüme göre). Satır
  hesapla birlikte silinir; anonim hesapta oturum hesap süresince yaşar. Gerçek yığında
  `\d auth.sessions` ile bak; kvkk/08 #14'te "olası" olarak yazılı, kesinleşince güncelle.
- **Hız sınırları:** GoTrue IP başına sınırları `GOTRUE_RATE_LIMIT_HEADER` ile açılır
  (`docker-compose.override.yml`). Okul Wi-Fi'ı ya da operatör NAT'ı arkasında çok öğrenci aynı
  IP'yi paylaşır. Token yenileme 429 alırsa ve erişim belirtecinin süresi dolmuşsa uygulama
  oturumu siler (auth-js 429'u kalıcı sayar); anonim hesaba yeniden girilemez, öğrenci grup
  hesabını kaybeder ve eski hesap 6 ay sonra temizlenene kadar sunucuda kalır. Bu yüzden
  `GOTRUE_RATE_LIMIT_TOKEN_REFRESH` 3000/5 dk'ya çekildi; anonim kayıt sınırı (30/saat/IP) bir
  sınıfın aynı anda kaydolmasına yetmeyebilir. Açılıştan önce GoTrue günlüğünde 429 sayısına
  bakın, gerekirse iki sınırı da yükseltin; uzun vadede Apple/Google hesap bağlama
  (GROUPS_LAUNCH_BLOCKERS).
- `healthcheck.sh` açık `danger` raporunu ve 12 saatten eski raporu `FAIL` olarak yazar; bu yalnız
  `journalctl`e düşer. Operatöre anında, yurt içi bir kanaldan (e-posta / SMS) uyarı gitmesi
  bayrak açılmadan önce kurulmalı (K-28, K-29; `src/config/features.ts` GROUPS_LAUNCH_BLOCKERS).
