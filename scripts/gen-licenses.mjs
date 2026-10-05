#!/usr/bin/env node
/**
 * Generates `src/legal/licenses.ts` for "Hakkında → Açık kaynak lisansları": the open-source code
 * inside the app with version, license and the license text itself (MIT, BSD and Apache ask for
 * the copyright and permission notice to ship with every copy).
 *
 * 1. npm packages: every package that contributes code to the iOS JavaScript bundle, read from the
 *    source map of `expo export --platform ios` (build-only tooling such as Babel or the Expo CLI
 *    is not in the bundle and so not listed). Their native iOS code ships from the same packages.
 *    The text is the package's own LICENSE / LICENCE / COPYING file.
 * 2. Native libraries that are not npm packages (`NATIVE` below): compiled into the iOS app by
 *    React Native and expo-sqlite. Versions are read from node_modules. Their license texts live
 *    in `scripts/native-licenses/<file>` and must be the upstream file of that version, copied
 *    verbatim; a missing file is reported and the entry shows the license name and source only.
 *
 *   node scripts/gen-licenses.mjs            # runs the export into a temporary folder
 *   node scripts/gen-licenses.mjs dist       # uses an existing `expo export --source-maps` output
 *
 * Re-run after adding or upgrading dependencies.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'legal', 'licenses.ts');
const NM = path.join(ROOT, 'node_modules');
const NATIVE_TEXTS = path.join(ROOT, 'scripts', 'native-licenses');

function findMaps(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...findMaps(p));
    else if (name.endsWith('.map')) out.push(p);
  }
  return out;
}

let distDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
let temp = null;
if (distDir === null) {
  temp = mkdtempSync(path.join(tmpdir(), 'etut-licenses-'));
  distDir = temp;
  const cli = path.join(NM, 'expo', 'bin', 'cli');
  const run = spawnSync(
    process.execPath,
    [cli, 'export', '--platform', 'ios', '--source-maps', '--output-dir', distDir],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } },
  );
  if (run.status !== 0) process.exit(run.status ?? 1);
}

const packages = new Map();
for (const mapFile of findMaps(distDir)) {
  const { sources = [] } = JSON.parse(readFileSync(mapFile, 'utf8'));
  for (const source of sources) {
    const normalized = source.replace(/\\/g, '/');
    const i = normalized.lastIndexOf('node_modules/');
    if (i < 0) continue;
    const parts = normalized.slice(i + 'node_modules/'.length).split('/');
    const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    const dir = normalized.slice(0, i) + 'node_modules/' + name;
    packages.set(name, dir.startsWith('/') || /^[A-Za-z]:/.test(dir) ? dir : path.join(ROOT, dir));
  }
}
if (temp !== null) rmSync(temp, { recursive: true, force: true });

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

const LICENSE_FILE = /^(licen[cs]e|copying)([-.](md|txt|markdown|mit))?$/i;

function clean(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
}

function licenseText(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  const files = names.filter((n) => LICENSE_FILE.test(n)).sort();
  if (files.length === 0) return null;
  return files.map((f) => clean(readFileSync(path.join(dir, f), 'utf8'))).join('\n\n');
}

/**
 * Packages published from a monorepo often ship without their own LICENSE file; the monorepo's
 * root LICENSE applies. Mapped to an installed package that ships that same root file.
 * (Meta's react-native and metro repos carry the same MIT text.)
 */
const MONOREPO_LICENSE = {
  'react/react-native': 'react-native',
  'facebook/react-native': 'react-native',
  'react/metro': 'react-native',
  'facebook/metro': 'react-native',
  'expo/expo': 'expo',
};

function monorepoText(pkg) {
  const url = typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '');
  const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url);
  const host = m === null ? undefined : MONOREPO_LICENSE[m[1]];
  return host === undefined ? null : licenseText(path.join(NM, host));
}

const missing = [];
const rows = [];
for (const [name, mapDir] of packages) {
  let dir = mapDir;
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    dir = path.join(NM, name);
    try {
      pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
  }
  if (pkg.name === 'etut') continue;
  const text = licenseText(dir) ?? monorepoText(pkg);
  if (text === null) missing.push(name);
  rows.push({ name, version: String(pkg.version ?? ''), license: licenseOf(pkg), source: null, text });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

// ---------------------------------------------------------------------------------------------
// Native libraries that are not npm packages.

function read(rel) {
  return readFileSync(path.join(NM, rel), 'utf8');
}

function match(text, re, what) {
  const m = re.exec(text);
  if (m === null) throw new Error(`[gen-licenses] version of ${what} not found`);
  return m[1];
}

const podspec = (name) => read(`react-native/third-party-podspecs/${name}.podspec`);
const helpers = read('react-native/scripts/cocoapods/helpers.rb');
const sqliteC = read('expo-sqlite/vendor/sqlite3/sqlite3.c');

/** The public-domain notice at the top of the SQLite amalgamation (sqliteInt.h). */
function sqliteNotice() {
  const start = sqliteC.indexOf('** The author disclaims copyright');
  const end = sqliteC.indexOf('never taking more than you give.', start);
  if (start < 0 || end < 0) throw new Error('[gen-licenses] SQLite notice not found');
  return clean(
    sqliteC
      .slice(start, end + 'never taking more than you give.'.length)
      .split('\n')
      .map((l) => l.replace(/^\*\*\s?/, ''))
      .join('\n'),
  );
}

const NATIVE = [
  {
    name: 'Hermes',
    version: match(read('react-native/sdks/hermes-engine/version.properties'), /HERMES_VERSION_NAME=(\S+)/, 'Hermes'),
    license: 'MIT',
    source: 'https://github.com/facebook/hermes',
    file: 'hermes.txt',
  },
  {
    name: 'folly (RCT-Folly)',
    version: match(helpers, /@@folly_config = \{\s*:version => '([^']+)'/, 'folly'),
    license: 'Apache-2.0',
    source: 'https://github.com/facebook/folly',
    file: 'folly.txt',
  },
  {
    name: 'glog',
    version: match(podspec('glog'), /spec\.version = '([^']+)'/, 'glog'),
    license: 'BSD-3-Clause',
    source: 'https://github.com/google/glog',
    file: 'glog.txt',
  },
  {
    name: 'Boost',
    version: match(podspec('boost'), /spec\.version = '([^']+)'/, 'boost'),
    license: 'BSL-1.0',
    source: 'https://www.boost.org',
    file: 'boost.txt',
  },
  {
    name: 'double-conversion',
    version: match(podspec('DoubleConversion'), /spec\.version = '([^']+)'/, 'double-conversion'),
    license: 'BSD-3-Clause',
    source: 'https://github.com/google/double-conversion',
    file: 'double-conversion.txt',
  },
  {
    name: 'fmt',
    version: match(podspec('fmt'), /spec\.version = "([^"]+)"/, 'fmt'),
    license: 'MIT',
    source: 'https://github.com/fmtlib/fmt',
    file: 'fmt.txt',
  },
  {
    name: 'fast_float',
    version: match(podspec('fast_float'), /spec\.version = "([^"]+)"/, 'fast_float'),
    license: 'Apache-2.0 OR BSL-1.0 OR MIT',
    source: 'https://github.com/fastfloat/fast_float',
    file: 'fast_float.txt',
  },
  {
    name: 'SocketRocket',
    version: match(helpers, /@@socket_rocket_config = \{\s*:version => '([^']+)'/, 'SocketRocket'),
    license: 'BSD-3-Clause',
    source: 'https://github.com/facebookincubator/SocketRocket',
    file: 'socketrocket.txt',
  },
  {
    name: 'SQLite',
    version: match(read('expo-sqlite/vendor/sqlite3/sqlite3.h'), /#define SQLITE_VERSION\s+"([^"]+)"/, 'SQLite'),
    license: 'Public domain',
    source: 'https://sqlite.org/copyright.html',
    text: sqliteNotice(),
  },
];

const nativeRows = NATIVE.map((n) => {
  let text = n.text ?? null;
  if (text === null && n.file && existsSync(path.join(NATIVE_TEXTS, n.file))) {
    text = clean(readFileSync(path.join(NATIVE_TEXTS, n.file), 'utf8'));
  }
  if (text === null) missing.push(`${n.name} (scripts/native-licenses/${n.file})`);
  return { name: n.name, version: n.version, license: n.license, source: n.source, text };
});

// ---------------------------------------------------------------------------------------------
// Output: identical texts (many MIT files differ only in the copyright line) are stored once.

const texts = [];
const textIndex = new Map();
function ref(text) {
  if (text === null) return 'null';
  if (!textIndex.has(text)) {
    textIndex.set(text, texts.length);
    texts.push(text);
  }
  return `T[${textIndex.get(text)}]`;
}

const entry = (r) =>
  `  { name: ${JSON.stringify(r.name)}, version: ${JSON.stringify(r.version)}, license: ${JSON.stringify(r.license)}, source: ${JSON.stringify(r.source)}, text: ${ref(r.text)} },`;
const jsBody = rows.map(entry).join('\n');
const nativeBody = nativeRows.map(entry).join('\n');
const textBody = texts.map((t) => `  ${JSON.stringify(t)},`).join('\n');

writeFileSync(
  OUT,
  `/**
 * GENERATED by scripts/gen-licenses.mjs — do not edit by hand.
 * Open-source code inside the app: npm packages from the iOS bundle's source map, and native
 * libraries compiled in by React Native and expo-sqlite. \`text\` is the license text shipped
 * with the app (\`null\`: not available yet, see the script).
 */

export interface PackageLicense {
  name: string;
  version: string;
  license: string;
  /** Where the code comes from (native libraries only). */
  source: string | null;
  text: string | null;
}

const T: readonly string[] = [
${textBody}
];

export const LICENSES: readonly PackageLicense[] = [
${jsBody}
];

export const NATIVE_LICENSES: readonly PackageLicense[] = [
${nativeBody}
];
`,
);
console.log(
  `[gen-licenses] ${rows.length} packages + ${nativeRows.length} native libraries, ${texts.length} distinct texts → ${path.relative(ROOT, OUT)}`,
);
if (missing.length > 0) {
  console.warn(`[gen-licenses] license text missing for ${missing.length}:\n  ${missing.join('\n  ')}`);
}
