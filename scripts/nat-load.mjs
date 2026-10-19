#!/usr/bin/env node
/**
 * NAT yük testi (infra/yuk-testi.md): tek IP'nin arkasındaki N öğrenci, okul Wi-Fi'ı ya da
 * operatör NAT'ı gibi. Bu makineden çalışan her "öğrenci" ayrı bir supabase-js istemcisidir;
 * hepsi aynı IP'den gider, GoTrue'nun IP başına sınırları (infra/supabase/docker-compose.override.yml)
 * tam bu durumu görür.
 *
 * Her öğrenci: anonim kayıt + profil, sonra her 30 dakikada bir token yenileme ve birkaç salt
 * okuma RPC'si (get_me, my_groups); sonunda hesabını siler (delete_my_account). Süre
 * sıkıştırılır: --olcek 60 ile 30 dakika 30 saniye olur. Bütün sınıf aynı anda kaydolur ve aynı
 * anda yeniler (zil çaldı); bu en kötü durumdur.
 *
 * Yenileme, uygulamadaki gibi src/sync/client.ts sarmalayıcısıyla gider (429 → 503, auth-js
 * yeniden dener, oturum kalır). --ham sarmalayıcıyı kapatır: auth-js'in kendi davranışı, 429
 * kalıcı hata sayılır. "Kaybolan oturum": yenilemesi kalıcı hatayla biten öğrenci; erişim
 * belirtecinin süresi dolmuş olsaydı (uygulama saatlerce kapalı kaldıysa) auth-js oturumu
 * silerdi ve anonim hesaba bir daha girilemezdi.
 *
 *   node scripts/nat-load.mjs                              yerel yığın (npx supabase start)
 *   node scripts/nat-load.mjs --ogrenci 120 --sure 240
 *   node scripts/nat-load.mjs --url https://api.<alan> --key <genel anahtar> --onay
 *
 * Yerel olmayan bir adres --onay ister: sunucuda gerçek anonim hesaplar açılır (sonda silinir)
 * ve GoTrue sınırları o IP için gerçekten dolar (gerçek öğrenciler de 429 alabilir).
 * Çıkış kodu: kaybolan oturum varsa 1.
 */

import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';

const REFRESH_EVERY_MIN = 30;

const { values: args } = parseArgs({
  options: {
    url: { type: 'string' },
    key: { type: 'string' },
    ogrenci: { type: 'string', default: '40' },
    sure: { type: 'string', default: '120' },
    olcek: { type: 'string', default: '60' },
    ham: { type: 'boolean', default: false },
    onay: { type: 'boolean', default: false },
    yardim: { type: 'boolean', short: 'h', default: false },
  },
});

if (args.yardim) {
  console.log(`Kullanım: node scripts/nat-load.mjs [--url U --key K] [--ogrenci N=40] [--sure DAKİKA=120]
                                [--olcek X=60] [--ham] [--onay]
  --sure   benzetilen süre (dakika); her ${REFRESH_EVERY_MIN} dakikada bir yenileme turu
  --olcek  1 gerçek saniye = X benzetilen saniye (60: 30 dk → 30 sn)
  --ham    429 → 503 sarmalayıcısı olmadan (auth-js'in kendi davranışı, karşılaştırma için)
  --onay   yerel olmayan adres için zorunlu`);
  process.exit(0);
}

const students = Number(args.ogrenci);
const minutes = Number(args.sure);
const scale = Number(args.olcek);
if (![students, minutes, scale].every((n) => Number.isFinite(n) && n > 0)) {
  console.error('--ogrenci, --sure ve --olcek pozitif sayı olmalı.');
  process.exit(2);
}

let url = args.url;
let key = args.key;
if (!url || !key) {
  try {
    const cli = process.env.SUPABASE_CLI ?? 'supabase';
    const status = JSON.parse(execSync(`npx ${cli} status -o json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 }));
    url ??= status.API_URL;
    key ??= status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  } catch {
    console.error('--url / --key verilmedi ve yerel yığın bulunamadı (npx supabase start).');
    process.exit(2);
  }
}

const host = new URL(url).hostname;
const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) || host.endsWith('.localhost');
if (!local && !args.onay) {
  console.error(`${host} yerel değil. Sunucuda gerçek anonim hesaplar açılır ve IP sınırları dolar; ` +
    'infra/yuk-testi.md adımlarını okuyup --onay ile yeniden çalıştırın.');
  process.exit(2);
}

/** HTTP durumları uç türüne göre: signup, refresh, rpc. 429'lar sarmalayıcıdan önce sayılır. */
const http = { signup: new Map(), refresh: new Map(), rpc: new Map() };
const kindOf = (u) =>
  u.includes('/auth/v1/signup') ? 'signup'
    : u.includes('grant_type=refresh_token') ? 'refresh'
      : u.includes('/rest/v1/rpc/') ? 'rpc' : null;

/** src/sync/client.ts keepSessionOn429 ile aynı; --ham ile kapalı. */
async function countingFetch(input, init) {
  const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const response = await fetch(input, init);
  const kind = kindOf(u);
  if (kind) http[kind].set(response.status, (http[kind].get(response.status) ?? 0) + 1);
  if (args.ham || response.status !== 429 || kind !== 'refresh') return response;
  return new Response(await response.text(), { status: 503, statusText: 'Service Unavailable', headers: response.headers });
}

const letters = (i) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
};

const tally = {
  signedUp: 0, signupRefused: 0, signupFailed: 0,
  refreshOk: 0, refreshDeferred: 0, refreshFinal: 0,
  rpcOk: 0, rpcAnon: 0, rpcOther: 0,
  lost: 0, deleted: 0, deleteFailed: 0,
};
const errors = new Map();
const note = (e) => {
  const line = `${e?.name ?? 'Error'}: ${e?.message ?? e}`;
  errors.set(line, (errors.get(line) ?? 0) + 1);
};

function newStudent() {
  const store = new Map();
  const client = createClient(url, key, {
    auth: {
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: countingFetch },
  });
  return { client, store, lost: false };
}

async function rpc(s, fn, params) {
  const { error } = await s.client.rpc(fn, params);
  if (!error) tally.rpcOk += 1;
  else if (error.code === '42501') tally.rpcAnon += 1;
  else {
    tally.rpcOther += 1;
    note({ name: `rpc ${fn}`, message: error.message });
  }
}

async function signUp(s, i) {
  const { error } = await s.client.auth.signInAnonymously();
  if (error) {
    if (error.status === 429) tally.signupRefused += 1;
    else {
      tally.signupFailed += 1;
      note(error);
    }
    return false;
  }
  tally.signedUp += 1;
  await rpc(s, 'save_profile', { p_nickname: `Yuk ${letters(i)}`, p_exam_type: 'YKS', p_yks_area: 'sayisal', p_age_band: '18_plus' });
  return true;
}

async function refreshRound(s) {
  if (s.lost) return;
  const { error } = await s.client.auth.refreshSession();
  if (!error) tally.refreshOk += 1;
  else if (error.name === 'AuthRetryableFetchError') tally.refreshDeferred += 1;
  else {
    tally.refreshFinal += 1;
    note(error);
    s.lost = true;
    tally.lost += 1;
    return;
  }
  await rpc(s, 'get_me');
  await rpc(s, 'my_groups');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const roundMs = (REFRESH_EVERY_MIN * 60_000) / scale;
// auth-js yenilemeyi 30 saniyelik tik içinde başlatır: aynı dakikada açılmış uygulamalar
// en fazla bir tik arayla yeniler.
const tickMs = 30_000 / scale;
const rounds = Math.floor(minutes / REFRESH_EVERY_MIN);

console.log(`Hedef ${host}${local ? ' (yerel)' : ''} · ${students} öğrenci · ${minutes} dk benzetim (${rounds} yenileme turu, ` +
  `tur arası ${(roundMs / 1000).toFixed(1)} sn) · ${args.ham ? 'HAM (sarmalayıcı yok)' : '429 → 503 sarmalayıcı açık'}`);

const started = Date.now();
const all = Array.from({ length: students }, newStudent);
const active = [];
await Promise.all(all.map(async (s, i) => {
  if (await signUp(s, i)) active.push(s);
}));

for (let r = 1; r <= rounds; r += 1) {
  await sleep(roundMs);
  await Promise.all(active.map(async (s) => {
    await sleep(Math.random() * tickMs);
    await refreshRound(s);
  }));
  console.log(`tur ${r}/${rounds}: yenileme tamam ${tally.refreshOk}, ertelenen ${tally.refreshDeferred}, kaybolan ${tally.lost}`);
}

// Temizlik: her hesap kendini siler, kaybolan sayılanlar da (erişim belirteçleri hâlâ geçerli).
await Promise.all(active.map(async (s) => {
  const { error } = await s.client.rpc('delete_my_account');
  if (error) {
    tally.deleteFailed += 1;
    note({ name: 'delete_my_account', message: error.message });
  } else tally.deleted += 1;
}));

const fmt = (m) => [...m].sort(([a], [b]) => a - b).map(([k, v]) => `${k}×${v}`).join(' ') || '-';
console.log(`
Sonuç (${((Date.now() - started) / 1000).toFixed(0)} sn)
  kayıt             : ${tally.signedUp} açıldı, ${tally.signupRefused} reddedildi (429), ${tally.signupFailed} başka hata
  yenileme          : ${tally.refreshOk} başarılı, ${tally.refreshDeferred} ertelendi (oturum kaldı), ${tally.refreshFinal} kalıcı hata
  RPC               : ${tally.rpcOk} başarılı, ${tally.rpcAnon} anon olarak reddedildi (42501), ${tally.rpcOther} başka hata
  KAYBOLAN OTURUM   : ${tally.lost}
  HTTP signup       : ${fmt(http.signup)}
  HTTP refresh      : ${fmt(http.refresh)}
  HTTP rpc          : ${fmt(http.rpc)}
  429 toplam        : ${(http.signup.get(429) ?? 0) + (http.refresh.get(429) ?? 0) + (http.rpc.get(429) ?? 0)}
  temizlik          : ${tally.deleted} hesap silindi, ${tally.deleteFailed} silinemedi`);
if (errors.size > 0) {
  console.log('  hatalar           :');
  for (const [k, v] of errors) console.log(`    ${v}× ${k}`);
}
process.exit(tally.lost > 0 ? 1 : 0);
