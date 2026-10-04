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

Uyulacak tasarım kuralları: `docs/hukuk/03-tasarim-kurallari.md`. Plan: `docs/PLAN.md`; araştırma: `docs/arastirma/`;
KVKK belgeleri: `docs/hukuk/kvkk/`.
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
- Bitti demeden önce: `npx tsc --noEmit`, `npx jest`, `npm run test:web`, `npx expo-doctor`,
  `npx expo export --platform ios` (çıktı `dist/`, git'e girmez).
- Web önizleme `npm run web` (8081) yalnız test içindir; mobil ile aynı depolama kodu çalışır
  (README "Web notu"). `testID`'ler Maestro (`e2e/`) ve `scripts/test-web.mjs` tarafından
  kullanılır: değiştirme, yeni etkileşimli öğeye `testID` ver.
- Expo API'leri sürümden sürüme değişir; hafızadan yazma, `https://docs.expo.dev/versions/v57.0.0/` belgelerine bak.
- **Windows'ta iOS yerelde derlenemez** (`expo prebuild --platform ios` Windows'ta çalışmaz,
  Xcode yok). iOS yalnız `.github/workflows/testflight.yml` ile macOS koşucusunda derlenir.
  `ios/` ve `android/` üretilen klasörlerdir; elle oluşturma, git'e koyma.
- TypeScript 6 `types` varsayılanını boş yaptığı için `tsconfig.json` içinde `"types": ["jest"]` gerekli.

<!-- serai:start -->
## Serai

This project is connected to **Serai** — an agent-neutral control plane (receipts, approvals, scoped memory, tool routing, version history). The hub owns policy and audit; the agent (you) owns reasoning.

**Before meaningful work, load the installed `serai-agent-bootstrap` router skill for your current client** — `hub connect` installs it into your home (`~/.claude/skills/`, `~/.agents/skills/`, `~/.hermes/skills/`, `~/.flowly/skills/`), not into this repository, so use your client's skill discovery and do not assume this project contains Serai's source checkout. It defines the session contract, lists the 17 domain sub-skills, and tells you when to load each one.

**Contract (read once, follow always):**
1. Bootstrap exactly once: if the host-injected `Serai scope:` line says `bootstrap=complete`, reuse it and do not call SessionStart again; otherwise call `hub session-start` (CLI) / `hub_session_start` (MCP) once.
2. Route external/credentialed/destructive tools through the hub: `hub_invoke_tool` is the single governed call (policy, approvals, attempt + final receipts, output). The `PreToolUse` hook applies the configured posture — binding blocks/asks (`block` / `needs_approval`), advisory records-only (e.g. under `yolo` mode); `hub mode` shows the active style. Don't double-audit invokes with explicit pre/post hook calls.
3. When Coach surfaces a capability card, teach inside the work: do-then-narrate if safe, else one concise offer; dismiss after two declines/ignores.
4. Close every session with `hook-stop` + Skill Forge (`.agents/skills/serai-skill-forge/`): the hub records the closeout it observed, so you owe no ratings call — correct it only when a skill misled you or was stale (`hub skill rate <slug> misled|stale`), or record `no_skill_reason` when nothing durable was learned.

On filesystem surfaces, Serai is active only when the current repository contains its own `.serai/config.json`. Durable tokens identify the actor and workspace; they never supply project scope. Without that local binding, offer `hub connect` once or proceed without Serai—never load context from another project.

Demo fixture ids are only for `SERAI_RUNTIME_MODE=demo`; real filesystem sessions use the repo-local `.serai/config.json`. Explicit hub-provided scope is reserved for authenticated non-filesystem clients.

**Common commands (real bound repo):**
```bash
hub session-start --surface <surface> --json
```
The repo-local `.serai/config.json` is the authority for workspace and project, and the durable agent token resolves the actor — so no scope flags, and no shell preamble to get them wrong.

If `hub` is not on PATH, call the launcher `hub connect` installed for you by absolute path (`~/.local/bin/hub`) and stay in this project. Never `cd` into Serai's own checkout to bootstrap a different project — the repository you are standing in is what supplies the scope.

Config: `.serai/config.json` (committed). Token: `~/.serai/agent.<surface>.json`, one per surface (legacy single-surface installs may still carry `agent.json`); never committed. Remove this block with `hub disconnect`.
<!-- serai:end -->
