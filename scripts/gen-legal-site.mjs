// Builds the public web copy of the in-app legal texts (App Store "Privacy Policy URL", K-25/K-42)
// straight from src/strings.ts, so the web page and the app can never drift apart.
//
//   EXPO_PUBLIC_DATA_CONTROLLER_NAME=… EXPO_PUBLIC_DATA_CONTROLLER_CONTACT=… \
//   node scripts/gen-legal-site.mjs <out-dir>
//
// The data controller is read from the same EXPO_PUBLIC_ variables as the app build; nothing
// personal is stored in this public repository. Without them the pages show the placeholder.
// The postal address is never put on the web (bny, 11 Oct 2026): those sentences point to the
// in-app Hakkında screen instead. [AVUKAT TEYİDİ] whether that is enough for the web copy.
// Writes <out-dir>/index.html, aydinlatma.html, gizlilik.html, kullanim.html.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'test-results', 'legal-site'));

function loadStrings() {
  const file = path.join(root, 'src', 'strings.ts');
  const { code } = babel.transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', code)(require, module, module.exports, process);
  return module.exports;
}

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

function page({ title, updated, body, nav }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title === 'Etüt' ? 'Etüt' : `${escape(title)} · Etüt`}</title>
<style>${STYLE}</style>
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

const ADDRESS = '@@ETUT_ADDRESS@@';
process.env.EXPO_PUBLIC_DATA_CONTROLLER_ADDRESS = ADDRESS;
const WEB_ADDRESS = [
  [`Adres: ${ADDRESS}.`, 'Posta adresi uygulamada Hakkında ekranında yazar; istersen e-postayla da bildiririz.'],
  [`${ADDRESS} adresine`, 'uygulamada Hakkında ekranında yazan posta adresine'],
  [` · ${ADDRESS}`, ''],
];
const webText = (text) => {
  const out = WEB_ADDRESS.reduce((t, [from, to]) => t.split(from).join(to), text);
  if (out.includes(ADDRESS)) throw new Error(`address left in: ${text}`);
  return out;
};

const { tr, LEGAL_DOC_IDS, LEGAL_UPDATED, DATA_CONTROLLER } = loadStrings();
const files = { aydinlatma: 'aydinlatma.html', gizlilik: 'gizlilik.html', kullanim: 'kullanim.html' };
const nav = [`<a href="index.html">Etüt</a>`, ...LEGAL_DOC_IDS.map((id) => `<a href="${files[id]}">${escape(tr.legal[id].title)}</a>`)].join('');

mkdirSync(outDir, { recursive: true });
for (const id of LEGAL_DOC_IDS) {
  const doc = tr.legal[id];
  const body = doc.sections
    .map((s) => `<h2>${escape(s.heading)}</h2>\n${s.paragraphs.map((p) => `<p>${escape(webText(p))}</p>`).join('\n')}`)
    .join('\n');
  writeFileSync(path.join(outDir, files[id]), page({ title: doc.title, updated: tr.about.updated(LEGAL_UPDATED), body, nav }));
}
const index = [
  `<p>Etüt, sınava hazırlanan öğrenciler için bir çalışma sayacı ve deneme takip uygulamasıdır. Verilerin telefonunda kalır; uygulama internete bağlanmaz, reklam, analitik ve izleme içermez.</p>`,
  `<p>${LEGAL_DOC_IDS.map((id) => `<a href="${files[id]}">${escape(tr.legal[id].title)}</a>`).join(' · ')}</p>`,
  `<p class="muted">${escape(tr.about.controller)}: ${escape(DATA_CONTROLLER.name)} · ${escape(tr.about.contact)}: ${escape(DATA_CONTROLLER.contact)}</p>`,
].join('\n');
writeFileSync(path.join(outDir, 'index.html'), page({ title: 'Etüt', updated: '', body: index, nav }));
console.log(`legal site: ${LEGAL_DOC_IDS.length + 1} pages in ${outDir}`);
