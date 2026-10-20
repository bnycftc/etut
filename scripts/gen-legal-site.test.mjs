/**
 * scripts/gen-legal-site.mjs: both sites build, every page module becomes a page, the group pages
 * carry no placeholder, no internal note and none of the device-only claims, the K-25 sentence is
 * there and every internal link resolves.
 *
 *   node --test scripts/gen-legal-site.test.mjs
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { fileOfSlug, loadPages, pagesDir } from './gen-legal-site.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gen-legal-site.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'legal-site-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const CONTROLLER = { EXPO_PUBLIC_DATA_CONTROLLER_NAME: 'Deneme Kişi', EXPO_PUBLIC_DATA_CONTROLLER_CONTACT: 'deneme@example.com' };

function build(name, args, env) {
  const out = path.join(dir, name);
  const clean = { ...process.env };
  delete clean.EXPO_PUBLIC_DATA_CONTROLLER_NAME;
  delete clean.EXPO_PUBLIC_DATA_CONTROLLER_CONTACT;
  execFileSync(process.execPath, [script, ...args, out], { env: { ...clean, ...env }, stdio: 'pipe' });
  return out;
}

/** Every .html below `root`, as posix paths relative to it. */
function htmlFiles(root, sub = '') {
  return readdirSync(path.join(root, sub), { withFileTypes: true }).flatMap((e) => {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) return htmlFiles(root, rel);
    return e.name.endsWith('.html') ? [rel] : [];
  });
}

const read = (root, rel) => readFileSync(path.join(root, ...rel.split('/')), 'utf8');

/** Visible text of a page: tags dropped, the few entities the generator writes decoded. */
const text = (html) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const groupSite = build('gruplar', ['--gruplar'], CONTROLLER);
const deviceSite = build('cihaz', [], CONTROLLER);
const pages = loadPages().map((m) => ({ file: m.file, ...m.exports.page }));
const archiveFiles = htmlFiles(groupSite).filter((f) => f.startsWith('gizlilik/arsiv/'));
const pageFiles = pages.map((p) => fileOfSlug(p.slug));

test('every module in src/legal/pages becomes a page', () => {
  const modules = readdirSync(pagesDir).filter((f) => f.endsWith('.ts') && !f.startsWith('_'));
  assert.equal(pages.length, modules.length);
  for (const p of pages) {
    const file = fileOfSlug(p.slug);
    assert.ok(existsSync(path.join(groupSite, ...file.split('/'))), `${p.file} → ${file} missing`);
    const html = read(groupSite, file);
    assert.match(html, /^<!doctype html>/);
    assert.ok(html.includes(`<h1>`), `${file}: no heading`);
    assert.ok((p.intro?.length ?? 0) + p.sections.length > 0, `${p.file}: empty page`);
    for (const s of p.sections) assert.ok(s.blocks.length > 0, `${p.file}: empty section "${s.heading}"`);
  }
  // The pages the plan asks for (groups-launch-plan WP-E), the home page and the archive.
  for (const slug of ['index', 'aydinlatma', 'gizlilik', 'kullanim', 'veli', 'cocuk-guvenligi', 'iletisim', 'saklama', 'gizlilik/arsiv']) {
    assert.ok(pages.some((p) => p.slug === slug), `no page "${slug}"`);
  }
  // Nothing else in the output: the page modules plus the archived device texts.
  assert.deepEqual(htmlFiles(groupSite).sort(), [...pageFiles, ...archiveFiles].sort());
  assert.deepEqual(archiveFiles.map((f) => path.posix.basename(f)).sort(), ['aydinlatma.html', 'gizlilik.html', 'kullanim.html']);
});

test('the device site is the four pages of the in-app texts, without the group pages', () => {
  assert.deepEqual(htmlFiles(deviceSite).sort(), ['aydinlatma.html', 'gizlilik.html', 'index.html', 'kullanim.html']);
  const index = text(read(deviceSite, 'index.html'));
  assert.ok(index.includes('uygulama internete bağlanmaz'));
  for (const f of htmlFiles(deviceSite)) {
    const html = read(deviceSite, f);
    assert.ok(!/veli\.html|cocuk-guvenligi|saklama\.html|iletisim\.html|gizlilik\/arsiv/.test(html), `${f} links a group page`);
  }
  // The archive holds the same device texts as the device site.
  for (const f of ['aydinlatma.html', 'gizlilik.html', 'kullanim.html']) {
    const archived = archiveFiles.find((a) => a.endsWith(`/${f}`));
    const body = (html) => html.slice(html.indexOf('<h2>'), html.indexOf('</article>'));
    assert.equal(body(read(groupSite, archived)), body(read(deviceSite, f)), `${archived} differs from the device ${f}`);
  }
});

test('no placeholder or internal note on any page', () => {
  const forbidden = [
    /\[[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9 .:/_-]*\]/, // [TARİH], [WEB ADRESİ], [DOLDURULACAK], [KONTROL] …
    /KONTROL/,
    /AVUKAT TEYİDİ/i,
    /İç not/i,
    /Dayanak ve notlar/i,
    /yayımlanmaz\)/i,
    /\bTODO\b|\bTBD\b/,
    /undefined|\[object Object\]|NaN/,
    /\]\(/, // a link the generator did not turn into <a>
  ];
  for (const f of htmlFiles(groupSite)) {
    const t = text(read(groupSite, f));
    for (const re of forbidden) assert.ok(!re.test(t), `${f}: ${re} in "${t.match(re)?.[0]}"`);
    assert.ok(t.includes(CONTROLLER.EXPO_PUBLIC_DATA_CONTROLLER_CONTACT) || f.startsWith('gizlilik/arsiv'), `${f}: no contact address`);
  }
});

test('the page sources in this public repository carry no internal markers', () => {
  for (const f of readdirSync(pagesDir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(path.join(pagesDir, f), 'utf8');
    for (const re of [/\[KONTROL/, /\[AVUKAT TEYİDİ/, /İç not/i, /Dayanak ve notlar/i, /\(yayımlanmaz\)/i]) {
      assert.ok(!re.test(src), `src/legal/pages/${f}: ${re}`);
    }
  }
});

test('the group pages do not repeat the device-only claims', () => {
  const v0 = ['internete bağlanmaz', 'hesap yok', 'hesabı yok', 'sunucu yok', 'sunucusu ve hesabı', 'hiçbir sunucuya göndermez', 'data not collected'];
  // Neither do they promise what the code does not do (Apple/Google sign-in, push, crash SDK).
  const absent = ['apple ile giriş', 'google ile giriş', 'bildirim belirteci', 'push token', 'apns', 'firebase', 'glitchtip', 'hata kayıtları', 'kullanım ölçümü', 'rıza ayarları', 'verilerimi indir', 'satın alma ekranında'];
  for (const f of pageFiles) {
    const t = text(read(groupSite, f)).toLocaleLowerCase('tr');
    for (const s of [...v0, ...absent]) assert.ok(!t.includes(s), `${f}: "${s}"`);
  }
});

test('the child safety page carries the K-25 sentence', () => {
  const t = text(read(groupSite, 'cocuk-guvenligi.html'));
  assert.ok(t.includes('5651 m.2/1-(s) kapsamında olmadığımız görüşündeyiz; ihtiyaten uyguluyoruz.'));
});

test('every internal link resolves', () => {
  let links = 0;
  for (const f of htmlFiles(groupSite)) {
    for (const [, href] of read(groupSite, f).matchAll(/href="([^"]+)"/g)) {
      if (/^https:\/\//.test(href)) continue;
      assert.ok(!/^[a-z]+:/i.test(href), `${f}: unexpected link ${href}`);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), href));
      assert.ok(!target.startsWith('..'), `${f}: ${href} leaves the site`);
      assert.ok(existsSync(path.join(groupSite, ...target.split('/'))), `${f}: ${href} → ${target} does not exist`);
      links++;
    }
  }
  assert.ok(links > 50, `only ${links} links checked`);
});

test('without the data controller variables the pages show the placeholder, as the app does', () => {
  const out = build('gruplar-bos', ['--gruplar'], {});
  const t = text(read(out, 'iletisim.html'));
  assert.ok(t.includes('[DOLDURULACAK]'));
});
