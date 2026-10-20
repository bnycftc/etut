#!/usr/bin/env node
/**
 * Framed App Store screenshots (6.9" iPhone, 1320 × 2868, RGB PNG without alpha) from the raw
 * simulator shots of .github/workflows/store-screenshots.yml. Every frame is data in
 * store/app-store/tr/screenshots.json: output name, layout, background, source images and the
 * caption (title lines and sub lines, sentence case: nothing is upper-cased automatically, the
 * Turkish İ/i would go wrong).
 *
 *   npm run store:compose -- --raw <dir> [--raw <dir> …] --out <dir> [--preview <dir>] [--skip-missing]
 *
 * --raw       folders with the raw shots (NN-name.png, koyu-*.png, part-*.png, tam-*.png); searched in order
 * --out       the framed set: only NN-name.png files, what asc-screenshots.yml uploads
 * --preview   contact.png (every frame) and search-row.png (the first three, as App Store search
 *             shows them); never part of the store set
 * --skip-missing  leave out frames whose sources are missing (local previews only)
 *
 * Visual language "Halka": brand gradient (theme primary #3B5BDB → #2A3FA8) or "night" for the dark
 * mode frame, the icon's 270° timer arc as a faint ring behind the card, the real screen in a
 * rounded card with a thin light edge and a soft shadow. No device frame, no drawn Lock Screen or
 * Dynamic Island: the hero frame uses only real renders, cropped (Maestro cropOn, or the luma
 * fallback below when cropOn finds nothing on SpringBoard).
 *
 * Text is drawn with the OFL fonts in store/fonts (Inter 4.1, unmodified, from
 * https://github.com/rsms/inter/releases/tag/v4.1, extras/ttf): Inter Display Bold for titles,
 * Inter Medium for sub lines. resvg draws nothing (no error) without a font and silently falls
 * back to another loaded face for a family it does not know, so every line is measured twice:
 * with both fonts and with only the intended one; the widths must match.
 *
 * Checks (any problem: exit code 1, nothing written): caption length and line count, measured line
 * width, WCAG contrast of the text on both gradient ends (src/domain/contrast.ts), words a store
 * image must not carry (price, LGS, ranking, social, superlatives, streak loss), "requires":
 * ["offline"] only before the store release (GROUPS_PHASE 'off' or 'beta18': the closed beta is
 * TestFlight only and keeps this v0 product page; 'public' uses store/app-store/groups/), output
 * names and sizes of the sources.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

import { Resvg } from '@resvg/resvg-js';

import { AA_TEXT, contrastRatio } from '../src/domain/contrast.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = path.join(ROOT, 'store', 'app-store', 'tr', 'screenshots.json');
export const LICENSE_PATH = path.join(ROOT, 'store', 'fonts', 'OFL.txt');
const FEATURES_PATH = path.join(ROOT, 'src', 'config', 'features.ts');

/** Inter 4.1 release files, byte for byte (OFL: unmodified, so the name "Inter" may be used). */
export const FONTS = {
  display: {
    file: path.join(ROOT, 'store', 'fonts', 'InterDisplay-Bold.ttf'),
    family: 'Inter Display',
    weight: 700,
    sha256: 'b74c8e0dd744b3347faca4c96bc7b2e32f7d6f62300a79b1d1a99331e44a5bc4',
  },
  text: {
    file: path.join(ROOT, 'store', 'fonts', 'Inter-Medium.ttf'),
    family: 'Inter',
    weight: 500,
    sha256: '97ad806f526e41546d46365bb3a393145f75b7b1568913db74549ad8b8dba872',
  },
};

/** App Store Connect 6.9" iPhone portrait: the raw screens and the framed output. */
export const SIZE = { width: 1320, height: 2868 };
export const LIMITS = { titleChars: 35, subChars: 70, lines: 2, lineWidth: 1176, frames: 10 };
export const OUT_NAME = /^\d\d-[a-z0-9-]+\.png$/;

const W = SIZE.width;
const H = SIZE.height;
const TITLE = { size: 96, lineHeight: 108, letterSpacing: -1.5, baselineTwo: 262, baselineOne: 316 };
const SUB = { size: 46, lineHeight: 60, gap: 84 };
const CARD = { y: 700, edge: 'rgba(255,255,255,0.28)', edgeWidth: 3 };
/** screen-bleed: the card runs off the bottom; raw rows from 2581 on (tab bar) stay outside. */
const BLEED = { scale: 0.84, rx: 150 };
/** screen-full: the whole screen, for lists that end at the bottom. */
const FULL = { scale: 0.735, rx: 132 };
const RING = { cx: 660, cy: 1700, r: 820, width: 140, arc: 'rgba(255,255,255,0.08)', track: 'rgba(255,255,255,0.04)' };
const SHADOW = { dy: 30, blur: 45, color: '#0B1A4A', opacity: 0.35 };
const HERO = {
  islandWidth: 960,
  islandCenterY: 660,
  chip: { size: 34, height: 58, padX: 28, x: 72, y: 772 },
  activity: { x: 72, y: 854, width: 1176, radiusPt: 22 },
  screen: { y: 1330, scale: 0.84, rx: 150 },
};
/** Accepted sizes of the cropped real renders (raw pixels, 3× scale). */
export const PART_LIMITS = {
  island: { minWidth: 250, maxWidth: 1000, minAspect: 2.5, maxAspect: 8 },
  activity: { minWidth: 1000, maxWidth: SIZE.width, minAspect: 2.2, maxAspect: 4.5 },
};

/**
 * Lowercase (tr-TR) words a store image must not carry: price claims (App Review 2.3.7), the LGS
 * and school-age audience (K-45), ranking and social language (K-09, K-13), official-looking or
 * absolute claims, pressure and streak loss (docs/hukuk/03). Stems match the start of a word,
 * phrases anywhere.
 */
export const FORBIDDEN_STEMS = [
  'ücret', 'bedava', 'fiyat', 'indirim', 'kampanya',
  'lgs', 'ortaokul', 'ilkokul',
  'sıralama', 'lider', 'arkadaş', 'topluluk', 'sosyal', 'sohbet', 'yarış', 'rakip', 'herkes',
  'ösym', 'meb', 'resmi', 'resmî', 'garanti', 'kesin',
  'kaybet', 'bozul', 'kırıl', 'utan', 'tembel',
];
export const FORBIDDEN_WORDS = ['tl'];
export const FORBIDDEN_PHRASES = ['₺', '8. sınıf', 'en iyi', '1 numara', '#1', 'geride kalma', 'birinci ol'];

// ---------------------------------------------------------------- PNG

/** Width, height and colour type from the IHDR chunk, or null for a non-PNG. */
export function pngInfo(buf) {
  if (buf.length < 26 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** RGB PNG (colour type 2) from RGBA pixels; every pixel must be opaque. Rows use the Up filter. */
export function encodePngRgb(rgba, width, height) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  const prev = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      if (rgba[src + 3] !== 255) throw new Error(`pixel ${x},${y} is not opaque`);
      row[x * 3] = rgba[src];
      row[x * 3 + 1] = rgba[src + 1];
      row[x * 3 + 2] = rgba[src + 2];
    }
    const out = y * (stride + 1);
    raw[out] = 2; // filter: Up
    for (let i = 0; i < stride; i++) raw[out + 1 + i] = (row[i] - prev[i]) & 0xff;
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dataUri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

/** RGBA pixels of a PNG, decoded by resvg (an image drawn 1:1). */
export function decodePng(buf) {
  const info = pngInfo(buf);
  if (info === null) throw new Error('not a PNG');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">
    <image href="${dataUri(buf)}" width="${info.width}" height="${info.height}"/></svg>`;
  const img = new Resvg(svg).render();
  return { width: img.width, height: img.height, data: img.pixels };
}

// ---------------------------------------------------------------- fonts and text

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fontOptions = (files) => ({ fontFiles: files, loadSystemFonts: false, defaultFontFamily: FONTS.text.family });
const BOTH = [FONTS.display.file, FONTS.text.file];

function textElement(line, face, x, y, size, letterSpacing = 0, fill = '#000000', anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="${face.family}" font-weight="${face.weight}" font-size="${size}"${
    letterSpacing !== 0 ? ` letter-spacing="${letterSpacing}"` : ''
  } text-anchor="${anchor}" fill="${fill}">${esc(line)}</text>`;
}

/** Drawn bounding box of one line, or undefined when nothing was drawn (no font loaded). */
export function measure(line, face, size, letterSpacing = 0, files = BOTH) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${size * 3}">${textElement(
    line, face, 10, size * 2, size, letterSpacing)}</svg>`;
  const box = new Resvg(svg, { font: fontOptions(files) }).getBBox();
  return box === undefined || box === null ? undefined : { x: box.x, y: box.y, width: box.width, height: box.height };
}

/** Problems with the font files themselves (present, unmodified, licence next to them). */
export function checkFonts() {
  const problems = [];
  for (const face of Object.values(FONTS)) {
    if (!existsSync(face.file)) {
      problems.push(`font missing: ${path.relative(ROOT, face.file)}`);
      continue;
    }
    const sum = createHash('sha256').update(readFileSync(face.file)).digest('hex');
    if (sum !== face.sha256) problems.push(`font changed: ${path.relative(ROOT, face.file)} (sha256 ${sum})`);
  }
  if (!existsSync(LICENSE_PATH) || !readFileSync(LICENSE_PATH, 'utf8').includes('SIL OPEN FONT LICENSE Version 1.1')) {
    problems.push(`OFL licence text missing: ${path.relative(ROOT, LICENSE_PATH)}`);
  }
  return problems;
}

/** Width of a line in its own face; a problem when the font is not loaded or another face drew it. */
function lineWidth(line, face, size, letterSpacing, problems, label) {
  const both = measure(line, face, size, letterSpacing, BOTH);
  const own = measure(line, face, size, letterSpacing, [face.file]);
  if (both === undefined || own === undefined) {
    problems.push(`${label}: nothing drawn for "${line}" (font not loaded)`);
    return 0;
  }
  if (Math.abs(both.width - own.width) > 0.5) {
    problems.push(`${label}: "${line}" was not drawn in ${face.family} ${face.weight}`);
  }
  return both.width;
}

// ---------------------------------------------------------------- config checks

export function loadConfig(file = CONFIG_PATH) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Words of a line that a store image must not carry (empty when clean). */
export function forbiddenIn(text) {
  const lower = text.toLocaleLowerCase('tr-TR');
  const words = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const hits = [];
  for (const stem of FORBIDDEN_STEMS) if (words.some((w) => w.startsWith(stem))) hits.push(stem);
  for (const word of FORBIDDEN_WORDS) if (words.includes(word)) hits.push(word);
  for (const phrase of FORBIDDEN_PHRASES) if (lower.includes(phrase)) hits.push(phrase);
  return hits;
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** `top` (hex) drawn with opacity `alpha` over `bottom` (hex). */
export function blend(bottom, top, alpha) {
  const b = hexToRgb(bottom);
  const t = hexToRgb(top);
  return rgbToHex(b.map((v, i) => v * (1 - alpha) + t[i] * alpha));
}

function checkText(lines, max, label, problems) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > LIMITS.lines || lines.some((l) => typeof l !== 'string' || l.trim() === '')) {
    problems.push(`${label}: 1 to ${LIMITS.lines} non-empty lines`);
    return;
  }
  const joined = lines.join(' ');
  if ([...joined].length > max) problems.push(`${label}: ${[...joined].length} characters, at most ${max}: "${joined}"`);
  for (const line of lines) {
    if (line !== line.trim() || /\s{2,}/.test(line)) problems.push(`${label}: stray spaces in "${line}"`);
    if (/\p{L}{4,}/u.test(line) && line === line.toLocaleUpperCase('tr-TR')) problems.push(`${label}: "${line}" is all upper case`);
  }
  const hits = forbiddenIn(joined);
  if (hits.length > 0) problems.push(`${label}: not on a store image: ${hits.join(', ')} ("${joined}")`);
}

/**
 * Everything that can be checked without the raw shots. Returns a list of problems (empty = ok).
 * `features` is the text of src/config/features.ts (for "requires": ["offline"]).
 */
export function checkConfig(config, features = readFileSync(FEATURES_PATH, 'utf8')) {
  const problems = [];
  if (config.canvas?.width !== W || config.canvas?.height !== H) problems.push(`canvas must be ${W}x${H}`);
  for (const [name, bg] of Object.entries(config.backgrounds ?? {})) {
    for (const end of [bg.from, bg.to]) {
      for (const [role, colour] of [['title', bg.title], ['sub', bg.sub]]) {
        for (const under of [end, blend(end, '#FFFFFF', 0.08)]) {
          const ratio = contrastRatio(colour, under);
          if (ratio < AA_TEXT) problems.push(`background ${name}: ${role} ${colour} on ${under} is ${ratio.toFixed(2)}:1, below ${AA_TEXT}`);
        }
      }
    }
  }
  const frames = config.frames ?? [];
  if (frames.length < 1 || frames.length > LIMITS.frames) problems.push(`${frames.length} frames, App Store Connect takes 1 to ${LIMITS.frames}`);
  const numbers = new Set();
  frames.forEach((f, i) => {
    const label = f.out ?? `frame ${i + 1}`;
    if (typeof f.out !== 'string' || !OUT_NAME.test(f.out)) problems.push(`${label}: output must be NN-name.png`);
    else {
      const n = Number(f.out.slice(0, 2));
      if (numbers.has(n)) problems.push(`${label}: number used twice`);
      if (n !== i + 1) problems.push(`${label}: frame ${i + 1} must be numbered ${String(i + 1).padStart(2, '0')}`);
      numbers.add(n);
    }
    if (!['hero', 'screen-bleed', 'screen-full'].includes(f.layout)) problems.push(`${label}: unknown layout ${f.layout}`);
    const bg = config.backgrounds?.[f.bg];
    if (bg === undefined) problems.push(`${label}: unknown background ${f.bg}`);
    if (typeof f.screen !== 'string' || !f.screen.endsWith('.png')) problems.push(`${label}: screen must be a .png`);
    checkText(f.title, LIMITS.titleChars, `${label} title`, problems);
    checkText(f.sub, LIMITS.subChars, `${label} sub`, problems);
    for (const line of Array.isArray(f.title) ? f.title : []) {
      const width = lineWidth(line, FONTS.display, TITLE.size, TITLE.letterSpacing, problems, `${label} title`);
      if (width > LIMITS.lineWidth) problems.push(`${label} title: "${line}" is ${Math.round(width)} px wide, at most ${LIMITS.lineWidth}`);
    }
    for (const line of Array.isArray(f.sub) ? f.sub : []) {
      const width = lineWidth(line, FONTS.text, SUB.size, 0, problems, `${label} sub`);
      if (width > LIMITS.lineWidth) problems.push(`${label} sub: "${line}" is ${Math.round(width)} px wide, at most ${LIMITS.lineWidth}`);
    }
    if (f.layout === 'hero') {
      if (typeof f.parts?.island !== 'string' || typeof f.parts?.activity !== 'string') problems.push(`${label}: hero needs parts.island and parts.activity`);
      const crop = f.screenCrop;
      if (!(crop && Number.isInteger(crop.top) && Number.isInteger(crop.bottom) && crop.top >= 0 && crop.bottom <= H && crop.bottom - crop.top >= 600)) {
        problems.push(`${label}: hero needs screenCrop {top, bottom} inside the screen`);
      }
      if (typeof f.chip === 'string') {
        checkText([f.chip], 20, `${label} chip`, problems);
        const chip = config.chip;
        if (!chip || !/^#[0-9A-F]{6}$/i.test(chip.color) || !/^#[0-9A-F]{6}$/i.test(chip.fill) || !(chip.opacity > 0 && chip.opacity < 1)) {
          problems.push('chip: needs {color, fill, opacity}');
        } else if (bg !== undefined) {
          for (const end of [bg.from, bg.to]) {
            const under = blend(end, chip.fill, chip.opacity);
            const ratio = contrastRatio(chip.color, under);
            if (ratio < AA_TEXT) problems.push(`${label} chip: ${ratio.toFixed(2)}:1 on ${under}, below ${AA_TEXT}`);
          }
        }
      }
    }
    for (const req of f.requires ?? []) {
      if (req !== 'offline') problems.push(`${label}: unknown requirement ${req}`);
      else if (!/^export const GROUPS_PHASE(?:: *[A-Za-z]+)? *= *'(?:off|beta18)' *;/m.test(features)) {
        problems.push(`${label}: claims the app works offline, but GROUPS_PHASE is not 'off' or 'beta18' (src/config/features.ts): the store release has groups`);
      }
    }
  });
  return problems;
}

// ---------------------------------------------------------------- sources

/** First folder of `dirs` that has `name`, or null. */
function locate(dirs, name) {
  for (const dir of dirs) {
    const file = path.join(dir, name);
    if (existsSync(file)) return file;
  }
  return null;
}

const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/**
 * The Dynamic Island in a full home screen shot: the black pill centred at the top. Rows whose
 * near-black run through the centre column is at least a fifth of the width; the pill spans the
 * union of those runs.
 */
export function findIsland({ width, height, data }) {
  const dark = (x, y) => luma(data, (y * width + x) * 4) < 20;
  const mid = Math.floor(width / 2);
  let top = -1;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < Math.floor(height * 0.12); y++) {
    const best = [mid, mid - 1];
    if (dark(mid, y)) {
      while (best[0] > 0 && dark(best[0] - 1, y)) best[0]--;
      best[1] = mid;
      while (best[1] < width - 1 && dark(best[1] + 1, y)) best[1]++;
    }
    if (best[1] - best[0] + 1 >= width / 5) {
      if (top < 0) top = y;
      else if (y !== bottom + 1) break;
      bottom = y;
      left = Math.min(left, best[0]);
      right = Math.max(right, best[1]);
    } else if (top >= 0) break;
  }
  return top < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/**
 * The Live Activity banner in a full Notification Center shot: the tallest band of rows that are
 * mostly dark (its text and icon leave at least 40 % of a row dark), short gaps bridged; left and
 * right edge from the dark columns of that band.
 */
export function findBanner({ width, height, data }) {
  const darkRow = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (luma(data, (y * width + x) * 4) < 45) n++;
    darkRow.push(n >= width * 0.4);
  }
  let best = null;
  let start = -1;
  let gap = 0;
  for (let y = 0; y <= height; y++) {
    const dark = y < height && darkRow[y];
    if (dark) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0 && (++gap > 20 || y === height)) {
      const end = y - gap;
      if (best === null || end - start > best[1] - best[0]) best = [start, end];
      start = -1;
      gap = 0;
    }
  }
  if (best === null) return null;
  const [top, bottom] = best;
  const rows = bottom - top + 1;
  let left = -1;
  let right = -1;
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = top; y <= bottom; y++) if (luma(data, (y * width + x) * 4) < 45) n++;
    if (n >= rows * 0.5) {
      if (left < 0) left = x;
      right = x;
    }
  }
  return left < 0 ? null : { x: left, y: top, w: right - left + 1, h: rows };
}

/**
 * A cropped real render for the hero frame: part-<name>.png (Maestro cropOn) when its size is
 * plausible, else the luma crop of the full shot tam-<name>.png (cropOn may find nothing, or
 * another element, on SpringBoard). `{file, buf, info, crop}`, or a problem string.
 */
function resolvePart(dirs, name, kind) {
  const limits = PART_LIMITS[kind];
  const fits = (c) =>
    c.w >= limits.minWidth && c.w <= limits.maxWidth && c.w / c.h >= limits.minAspect && c.w / c.h <= limits.maxAspect;
  const wanted = `a plausible ${kind} (${JSON.stringify(limits)})`;
  let directProblem = null;
  const direct = locate(dirs, name);
  if (direct !== null) {
    const buf = readFileSync(direct);
    const info = pngInfo(buf);
    const crop = info && { x: 0, y: 0, w: info.width, h: info.height };
    if (crop && fits(crop)) return { file: direct, buf, info, crop };
    directProblem = info ? `${name} is ${crop.w}x${crop.h}, not ${wanted}` : `${name} is not a PNG`;
  }
  const fullName = name.replace(/^part-/, 'tam-');
  const full = fullName === name ? null : locate(dirs, fullName);
  const fail = (problem) => (directProblem ? `${directProblem}; ${problem}` : problem);
  if (full === null) return fail(direct === null ? `${name} (or ${fullName}): missing` : `${fullName} missing`);
  const buf = readFileSync(full);
  const info = pngInfo(buf);
  if (info === null) return fail(`${fullName}: not a PNG`);
  const crop = (kind === 'island' ? findIsland : findBanner)(decodePng(buf));
  if (crop === null) return fail(`${fullName}: no ${kind} found`);
  if (!fits(crop)) return fail(`${fullName}: found ${crop.w}x${crop.h} at ${crop.x},${crop.y}, not ${wanted}`);
  return { file: full, buf, info, crop };
}

// ---------------------------------------------------------------- drawing

/**
 * `crop` of an image (raw pixels) drawn at (x, y) with width `width`, clipped to a rounded
 * rectangle, with shadow and light edge. Returns {svg, height}.
 */
function card(id, src, crop, x, y, width, rx, { shadow = true, edge = true } = {}) {
  const s = width / crop.w;
  const height = crop.h * s;
  const ix = x - crop.x * s;
  const iy = y - crop.y * s;
  const r = Math.min(rx, height / 2);
  return {
    height,
    defs: `<clipPath id="clip-${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}"/></clipPath>`,
    svg: `${shadow ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" fill="#000000" filter="url(#shadow)"/>` : ''}
  <g clip-path="url(#clip-${id})"><image href="${dataUri(src.buf)}" x="${ix}" y="${iy}" width="${src.info.width * s}" height="${src.info.height * s}" preserveAspectRatio="none"/></g>
  ${edge ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" fill="none" stroke="${CARD.edge}" stroke-width="${CARD.edgeWidth}"/>` : ''}`,
  };
}

function captionSvg(frame, bg) {
  const titleFirst = frame.title.length === 2 ? TITLE.baselineTwo : TITLE.baselineOne;
  const parts = frame.title.map((line, i) =>
    textElement(line, FONTS.display, W / 2, titleFirst + i * TITLE.lineHeight, TITLE.size, TITLE.letterSpacing, bg.title, 'middle'),
  );
  const subFirst = titleFirst + (frame.title.length - 1) * TITLE.lineHeight + SUB.gap;
  frame.sub.forEach((line, i) => parts.push(textElement(line, FONTS.text, W / 2, subFirst + i * SUB.lineHeight, SUB.size, 0, bg.sub, 'middle')));
  return parts.join('\n  ');
}

function ringSvg() {
  const { cx, cy, r, width, arc, track } = RING;
  // 270° clockwise from 12 o'clock to 9 o'clock, like the icon's timer arc.
  const d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${width}"/>
  <path d="${d}" fill="none" stroke="${arc}" stroke-width="${width}" stroke-linecap="round"/>`;
}

/** The SVG of one frame. `sources`: {screen, island?, activity?} as returned by resolveSources. */
export function frameSvg(config, frame, sources) {
  const bg = config.backgrounds[frame.bg];
  const defs = [
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg.from}"/><stop offset="1" stop-color="${bg.to}"/></linearGradient>`,
    `<filter id="shadow" filterUnits="userSpaceOnUse" x="-400" y="-400" width="${W + 800}" height="${H + 800}"><feDropShadow dx="0" dy="${SHADOW.dy}" stdDeviation="${SHADOW.blur}" flood-color="${SHADOW.color}" flood-opacity="${SHADOW.opacity}"/></filter>`,
  ];
  const body = [];
  const screen = sources.screen;
  if (frame.layout === 'hero') {
    const { island, activity } = sources;
    const islandCard = card('island', island, island.crop, (W - HERO.islandWidth) / 2,
      HERO.islandCenterY - (island.crop.h * HERO.islandWidth) / island.crop.w / 2, HERO.islandWidth, Infinity, { edge: false });
    const s = HERO.activity.width / activity.crop.w;
    const activityCard = card('activity', activity, activity.crop, HERO.activity.x, HERO.activity.y, HERO.activity.width,
      HERO.activity.radiusPt * 3 * s, { edge: false });
    const crop = { x: 0, y: frame.screenCrop.top, w: screen.info.width, h: frame.screenCrop.bottom - frame.screenCrop.top };
    const screenWidth = W * HERO.screen.scale;
    const screenCard = card('screen', screen, crop, (W - screenWidth) / 2, HERO.screen.y, screenWidth, HERO.screen.rx);
    defs.push(islandCard.defs, activityCard.defs, screenCard.defs);
    body.push(ringSvg(), screenCard.svg, islandCard.svg, activityCard.svg);
    if (typeof frame.chip === 'string') {
      const c = HERO.chip;
      const box = measure(frame.chip, FONTS.text, c.size);
      const chipWidth = Math.round((box?.width ?? 0) + 2 * c.padX);
      body.push(`<rect x="${c.x}" y="${c.y}" width="${chipWidth}" height="${c.height}" rx="${c.height / 2}" fill="${config.chip.fill}" fill-opacity="${config.chip.opacity}"/>`,
        textElement(frame.chip, FONTS.text, c.x + chipWidth / 2, c.y + c.height / 2 + c.size * 0.36, c.size, 0, config.chip.color, 'middle'));
    }
  } else {
    const { scale, rx } = frame.layout === 'screen-bleed' ? BLEED : FULL;
    const width = Math.round(W * scale);
    const screenCard = card('screen', screen, { x: 0, y: 0, w: screen.info.width, h: screen.info.height }, Math.round((W - width) / 2), CARD.y, width, rx);
    defs.push(screenCard.defs);
    body.push(ringSvg(), screenCard.svg);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs.join('\n  ')}</defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${body.join('\n  ')}
  ${captionSvg(frame, bg)}
</svg>`;
}

/** Pixels in the caption band close to the title colour: a few thousand at least when text was drawn. */
function captionPixels(pixels, colour) {
  const [r, g, b] = hexToRgb(colour);
  let n = 0;
  for (let y = 150; y < 560; y++) {
    for (let x = 72; x < W - 72; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(pixels[i] - r) + Math.abs(pixels[i + 1] - g) + Math.abs(pixels[i + 2] - b) < 60) n++;
    }
  }
  return n;
}

/** Renders one frame to an RGB PNG buffer, with the post-render checks. */
export function renderFrame(config, frame, sources) {
  const bg = config.backgrounds[frame.bg];
  const img = new Resvg(frameSvg(config, frame, sources), { font: fontOptions(BOTH) }).render();
  if (img.width !== W || img.height !== H) throw new Error(`${frame.out}: rendered ${img.width}x${img.height}`);
  const drawn = captionPixels(img.pixels, bg.title);
  if (drawn <= 2000) throw new Error(`${frame.out}: caption not drawn (${drawn} text pixels)`);
  return encodePngRgb(img.pixels, img.width, img.height);
}

/** Sources of a frame from the raw folders, or a list of problems. */
export function resolveSources(frame, dirs) {
  const problems = [];
  const sources = {};
  const screenFile = locate(dirs, frame.screen);
  if (screenFile === null) problems.push(`${frame.out}: ${frame.screen} missing`);
  else {
    const buf = readFileSync(screenFile);
    const info = pngInfo(buf);
    if (info === null || info.width !== W || info.height !== H) {
      problems.push(`${frame.out}: ${frame.screen} is ${info ? `${info.width}x${info.height}` : 'not a PNG'}, expected ${W}x${H}`);
    } else sources.screen = { file: screenFile, buf, info };
  }
  if (frame.layout === 'hero') {
    for (const kind of ['island', 'activity']) {
      const part = resolvePart(dirs, frame.parts[kind], kind);
      if (typeof part === 'string') problems.push(`${frame.out}: ${part}`);
      else sources[kind] = part;
    }
  }
  return problems.length > 0 ? { problems } : { sources };
}

// ---------------------------------------------------------------- previews

function sheet(files, columns, scale, gap) {
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const rows = Math.ceil(files.length / columns);
  const width = gap + columns * (w + gap);
  const height = gap + rows * (h + gap);
  const images = files.map((buf, i) =>
    `<image href="${dataUri(buf)}" x="${gap + (i % columns) * (w + gap)}" y="${gap + Math.floor(i / columns) * (h + gap)}" width="${w}" height="${h}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#E9ECF2"/>${images.join('')}</svg>`;
  const img = new Resvg(svg).render();
  return encodePngRgb(img.pixels, img.width, img.height);
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const args = { raw: [], out: null, preview: null, config: CONFIG_PATH, skipMissing: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--raw') args.raw.push(path.resolve(argv[++i]));
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--preview') args.preview = path.resolve(argv[++i]);
    else if (a === '--config') args.config = path.resolve(argv[++i]);
    else if (a === '--skip-missing') args.skipMissing = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (args.raw.length === 0 || args.out === null) throw new Error('usage: store-compose --raw <dir> [--raw <dir>] --out <dir> [--preview <dir>] [--skip-missing]');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const problems = [...checkFonts(), ...checkConfig(config)];
  if (problems.length > 0) {
    console.error(`[store-compose] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const planned = [];
  const missing = [];
  for (const frame of config.frames) {
    const resolved = resolveSources(frame, args.raw);
    if (resolved.problems === undefined) planned.push([frame, resolved.sources]);
    else if (args.skipMissing && resolved.problems.every((p) => p.includes('missing'))) missing.push(...resolved.problems);
    else problems.push(...resolved.problems);
  }
  if (problems.length > 0) {
    console.error(`[store-compose] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  if (planned.length === 0) {
    console.error('[store-compose] no frame has its sources');
    process.exit(1);
  }
  mkdirSync(args.out, { recursive: true });
  const written = [];
  for (const [frame, sources] of planned) {
    const started = Date.now();
    const png = renderFrame(config, frame, sources);
    writeFileSync(path.join(args.out, frame.out), png);
    written.push(png);
    const from = Object.entries(sources)
      .map(([k, s]) => `${k} ${path.basename(s.file)}${s.crop && (s.crop.x || s.crop.y) ? ` @${s.crop.x},${s.crop.y} ${s.crop.w}x${s.crop.h}` : ''}`)
      .join(', ');
    console.log(`[store-compose] ${frame.out}  ${W}x${H} RGB  ${Math.round(png.length / 1024)} KB  ${Date.now() - started} ms  (${from})`);
  }
  for (const m of missing) console.warn(`[store-compose] skipped: ${m}`);
  if (args.preview !== null) {
    mkdirSync(args.preview, { recursive: true });
    writeFileSync(path.join(args.preview, 'contact.png'), sheet(written, 4, 0.25, 24));
    writeFileSync(path.join(args.preview, 'search-row.png'), sheet(written.slice(0, 3), 3, 1 / 3, 32));
    console.log(`[store-compose] previews in ${args.preview}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
