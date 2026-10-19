// Builds the public web copy of the legal texts (App Store "Privacy Policy URL", K-25/K-42).
//
//   EXPO_PUBLIC_DATA_CONTROLLER_NAME=… EXPO_PUBLIC_DATA_CONTROLLER_CONTACT=… \
//   node scripts/gen-legal-site.mjs [--gruplar] [<out-dir>]
//
// Two sites, never mixed in one output folder:
//   (default)   the device-only site that is published now: index.html, aydinlatma.html,
//               gizlilik.html, kullanim.html, straight from the in-app texts in src/strings.ts so
//               the web page and the app can never drift apart. Default out: test-results/legal-site.
//   --gruplar   the group-version site: one page per module in src/legal/pages (format in
//               src/legal/pages/_shared.ts), plus the archived device texts under
//               gizlilik/arsiv/<date>/. Default out: test-results/legal-site-gruplar.
// Group pages are behind the flag (not a subfolder of the device site) so that nothing about the
// published site changes while the group phase is off, and so that at launch the group pages take
// over the same URLs (gizlilik.html stays the App Store link). Publishing either site is a copy to
// the bnycftc.github.io repository and needs bny's approval.
//
// The data controller is read from the same EXPO_PUBLIC_ variables as the app build; nothing
// personal is stored in this public repository. Without them the pages show the placeholder.
// There is no postal address in the texts (bny, 18 Oct 2026: contact is by e-mail only).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pagesDir = path.join(root, 'src', 'legal', 'pages');

// TypeScript modules of the app, loaded without a bundler: Babel strips the types, relative
// imports load the same way (cached, so each module is evaluated once), packages come from Node.
const tsCache = new Map();
function loadTs(file) {
  const cached = tsCache.get(file);
  if (cached) return cached.exports;
  const { code } = babel.transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  tsCache.set(file, module);
  const localRequire = (spec) => {
    if (!spec.startsWith('.')) return require(spec);
    const base = path.resolve(path.dirname(file), spec);
    const target = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((f) => existsSync(f));
    if (!target) throw new Error(`${path.relative(root, file)}: cannot resolve ${spec}`);
    return loadTs(target);
  };
  new Function('require', 'module', 'exports', 'process', code)(localRequire, module, module.exports, process);
  return module.exports;
}

const loadStrings = () => loadTs(path.join(root, 'src', 'strings.ts'));

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STYLE = `
:root { color-scheme: light dark; --bg: #f6f7f9; --card: #fff; --text: #111827; --muted: #4b5563; --accent: #3b5bdb; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f1218; --card: #171b24; --text: #e5e7eb; --muted: #9ca3af; --accent: #91a7ff; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
article { background: var(--card); border-radius: 16px; padding: 20px; }
h1 { font-size: 28px; line-height: 1.25; margin: 0 0 4px; }
h2 { font-size: 19px; margin: 28px 0 8px; }
p { margin: 0 0 12px; }
.muted { color: var(--muted); font-size: 15px; }
nav a, a { color: var(--accent); }
nav { display: flex; flex-wrap: wrap; gap: 12px 20px; margin: 0 0 16px; font-size: 15px; }
`;

// Lists and tables of the group pages only (the device pages keep STYLE alone, byte for byte).
const GROUP_STYLE = `:root { --line: #e5e7eb; }
@media (prefers-color-scheme: dark) { :root { --line: #2a3140; } }
ul { margin: 0 0 12px; padding-left: 22px; }
li { margin: 0 0 6px; }
.table { overflow-x: auto; margin: 0 0 12px; }
table { border-collapse: collapse; width: 100%; font-size: 15px; line-height: 1.45; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px 8px 0; border-bottom: 1px solid var(--line); min-width: 120px; }
th { font-weight: 600; }
`;

function page({ title, updated, body, nav, style = STYLE }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title === 'Etüt' ? 'Etüt' : `${escape(title)} · Etüt`}</title>
<style>${style}</style>
</head>
<body>
<main>
<nav>${nav}</nav>
<article>
<h1>${escape(title)}</h1>
${updated ? `<p class="muted">${escape(updated)}</p>` : ''}
${body}
</article>
</main>
</body>
</html>
`;
}

const DEVICE_FILES = { aydinlatma: 'aydinlatma.html', gizlilik: 'gizlilik.html', kullanim: 'kullanim.html' };

/** Sections of an in-app legal document (src/strings.ts legalDocs) as HTML. */
const deviceBody = (doc) =>
  doc.sections
    .map((s) => `<h2>${escape(s.heading)}</h2>\n${s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}`)
    .join('\n');

/** The device-only site, unchanged since 0.4.0 (the default run). */
export function buildDeviceSite(outDir) {
  const { tr, LEGAL_DOC_IDS, LEGAL_UPDATED, DATA_CONTROLLER } = loadStrings();
  const files = DEVICE_FILES;
  const nav = [`<a href="index.html">Etüt</a>`, ...LEGAL_DOC_IDS.map((id) => `<a href="${files[id]}">${escape(tr.legal[id].title)}</a>`)].join('');

  mkdirSync(outDir, { recursive: true });
  for (const id of LEGAL_DOC_IDS) {
    const doc = tr.legal[id];
    writeFileSync(path.join(outDir, files[id]), page({ title: doc.title, updated: tr.about.updated(LEGAL_UPDATED), body: deviceBody(doc), nav }));
  }
  const index = [
    `<p>Etüt, sınava hazırlanan öğrenciler için bir çalışma sayacı ve deneme takip uygulamasıdır. Verilerin telefonunda kalır; uygulama internete bağlanmaz, reklam, analitik ve izleme içermez.</p>`,
    `<p>${LEGAL_DOC_IDS.map((id) => `<a href="${files[id]}">${escape(tr.legal[id].title)}</a>`).join(' · ')}</p>`,
    `<p class="muted">${escape(tr.about.controller)}: ${escape(DATA_CONTROLLER.name)} · ${escape(tr.about.contact)}: ${escape(DATA_CONTROLLER.contact)}</p>`,
  ].join('\n');
  writeFileSync(path.join(outDir, 'index.html'), page({ title: 'Etüt', updated: '', body: index, nav }));
  return LEGAL_DOC_IDS.length + 1;
}

// ------------------------------------------------------------------ group version

const SLUG = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Output file of a slug, relative to the site root (posix). */
export const fileOfSlug = (slug) => `${slug}.html`;

/** Every page module of src/legal/pages (files starting with "_" are shared code, not pages). */
export function loadPages() {
  const modules = readdirSync(pagesDir)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .sort()
    .map((f) => ({ file: f, exports: loadTs(path.join(pagesDir, f)) }));
  const seen = new Set();
  for (const { file, exports } of modules) {
    const p = exports.page;
    if (!p || typeof p !== 'object') throw new Error(`src/legal/pages/${file}: no "export const page"`);
    if (typeof p.slug !== 'string' || !SLUG.test(p.slug)) throw new Error(`src/legal/pages/${file}: bad slug ${JSON.stringify(p.slug)}`);
    if (seen.has(p.slug)) throw new Error(`src/legal/pages/${file}: slug "${p.slug}" is used twice`);
    for (const key of ['title', 'updated']) {
      if (typeof p[key] !== 'string' || p[key] === '') throw new Error(`src/legal/pages/${file}: "${key}" missing`);
    }
    if (!Array.isArray(p.sections)) throw new Error(`src/legal/pages/${file}: "sections" missing`);
    seen.add(p.slug);
  }
  return modules;
}

function renderGroupPage(p, { slugs, nav, updatedLabel }) {
  const from = path.posix.dirname(fileOfSlug(p.slug));
  const href = (target) => {
    if (/^https:\/\//.test(target)) return target;
    if (!slugs.has(target)) throw new Error(`${p.slug}: link to unknown page "${target}"`);
    return path.posix.relative(from, fileOfSlug(target));
  };
  // Escape first, then turn [metin](hedef) into links (escaping leaves [ ] ( ) alone).
  const inline = (text) =>
    escape(text).replace(LINK, (_, label, target) => `<a href="${escape(href(target.replace(/&amp;/g, '&')))}">${label}</a>`);
  const block = (b) => {
    if (typeof b === 'string') return `<p>${inline(b)}</p>`;
    if (b && Array.isArray(b.list)) return `<ul>\n${b.list.map((item) => `<li>${inline(item)}</li>`).join('\n')}\n</ul>`;
    if (b && b.table) {
      const head = `<tr>${b.table.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr>`;
      const rows = b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n');
      return `<div class="table"><table>\n<thead>${head}</thead>\n<tbody>\n${rows}\n</tbody>\n</table></div>`;
    }
    throw new Error(`${p.slug}: unknown block ${JSON.stringify(b)}`);
  };
  const body = [
    ...(p.intro ?? []).map(block),
    ...p.sections.map((s) => [`<h2>${escape(s.heading)}</h2>`, ...s.blocks.map(block)].join('\n')),
  ].join('\n');
  const navHtml = nav.map((n) => `<a href="${escape(path.posix.relative(from, fileOfSlug(n.slug)))}">${escape(n.label)}</a>`).join('');
  return page({ title: p.title, updated: updatedLabel(p.updated), body, nav: navHtml, style: STYLE + GROUP_STYLE });
}

/** The group-version site (--gruplar). Returns the number of pages written. */
export function buildGroupSite(outDir) {
  const { tr, LEGAL_DOC_IDS, LEGAL_UPDATED } = loadStrings();
  const modules = loadPages();
  const pages = modules.map((m) => m.exports.page);

  // The archived device version: the in-app texts, frozen at the date the archive page names.
  const archive = modules.map((m) => m.exports.DEVICE_ARCHIVE).find(Boolean);
  const archived = [];
  if (archive) {
    if (archive.updated !== LEGAL_UPDATED) {
      throw new Error(
        `The archived device texts (${archive.dir}) are dated ${archive.updated}, but src/strings.ts now says ${LEGAL_UPDATED}. ` +
          'An archived version must not change: keep the published files of that date and update src/legal/pages/gizlilik-arsiv.ts.',
      );
    }
    for (const id of LEGAL_DOC_IDS) archived.push({ id, slug: `${archive.dir}/${id}` });
  }

  const slugs = new Set([...pages.map((p) => p.slug), ...archived.map((a) => a.slug)]);
  const nav = pages
    .filter((p) => p.nav)
    .sort((a, b) => a.nav.order - b.nav.order)
    .map((p) => ({ slug: p.slug, label: p.nav.label }));

  const write = (slug, html) => {
    const file = path.join(outDir, ...fileOfSlug(slug).split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  for (const p of pages) write(p.slug, renderGroupPage(p, { slugs, nav, updatedLabel: tr.about.updated }));

  const archivePage = pages.find((p) => p.slug === 'gizlilik/arsiv');
  for (const { id, slug } of archived) {
    const from = path.posix.dirname(fileOfSlug(slug));
    const rel = (s) => escape(path.posix.relative(from, fileOfSlug(s)));
    const doc = tr.legal[id];
    const archiveNav = [
      archivePage ? `<a href="${rel(archivePage.slug)}">${escape(archivePage.title)}</a>` : '',
      ...archived.map((a) => `<a href="${rel(a.slug)}">${escape(tr.legal[a.id].title)}</a>`),
    ].join('');
    const current = slugs.has(id) ? ` Geçerli sürüm: <a href="${rel(id)}">${escape(pages.find((p) => p.slug === id).title)}</a>.` : '';
    const body = `<p class="muted">Bu, ${escape(archive.updated)} tarihli eski sürümdür ve artık geçerli değildir.${current}</p>\n${deviceBody(doc)}`;
    write(slug, page({ title: doc.title, updated: tr.about.updated(LEGAL_UPDATED), body, nav: archiveNav }));
  }
  return pages.length + archived.length;
}

function main() {
  const args = process.argv.slice(2);
  const groups = args.includes('--gruplar');
  const unknown = args.filter((a) => a.startsWith('--') && a !== '--gruplar');
  if (unknown.length > 0) throw new Error(`unknown option ${unknown.join(' ')}`);
  const outArg = args.find((a) => !a.startsWith('--'));
  const outDir = path.resolve(outArg ?? path.join(root, 'test-results', groups ? 'legal-site-gruplar' : 'legal-site'));
  const count = groups ? buildGroupSite(outDir) : buildDeviceSite(outDir);
  console.log(`legal site${groups ? ' (gruplar)' : ''}: ${count} pages in ${outDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
