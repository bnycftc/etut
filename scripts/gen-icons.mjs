#!/usr/bin/env node
/**
 * Draws the app icon, splash marks and favicon from SVG (no fonts: the "E" is plain shapes, so
 * the result is the same on every machine) and writes PNGs into assets/.
 *
 *   node scripts/gen-icons.mjs            # writes assets/*.png
 *   node scripts/gen-icons.mjs --preview  # also writes small-size previews to test-results/icons/
 *
 * assets/icon.png is 1024×1024 without an alpha channel (App Store requirement): the RGBA output
 * of resvg is written as an RGB PNG. The splash colours come from src/ui/palette.ts (the brand blue
 * and the backgrounds; Node strips its types, and says once that it reads it as a module).
 *
 * iOS 18+ icon appearances (app.json `ios.icon`): icon-dark.png is the mark in the dark accent on
 * the dark background, icon-tinted.png a white mark on black. The system tints that one by its
 * luminance, and Expo flattens the tinted (and light) variant onto white, so it must be opaque.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

import { Resvg } from '@resvg/resvg-js';

import { BRAND_BLUE, DARK, LIGHT } from '../src/ui/palette.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

/** Theme colours (src/ui/palette.ts): the splash screen shows the brand blue on the background. */
const LIGHT_BG = LIGHT.background;
const LIGHT_ACCENT = BRAND_BLUE.light;
const DARK_BG = DARK.background;
const DARK_ACCENT = BRAND_BLUE.dark;
/** The dark icon: the app's dark text accent on its dark background (the Halka dark theme). */
const DARK_ICON_FG = DARK.accent;

/** `#RRGGBB` at `alpha` as an SVG colour (the faint track of the timer arc). */
function rgba(hex, alpha) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
const LIGHT_TRACK = rgba(LIGHT_ACCENT, 0.18);
const DARK_TRACK = rgba(DARK_ACCENT, 0.22);

/** Timer arc (three quarters, clockwise from the top) around a geometric "E", plus the crown. */
function mark({ fg, track }) {
  const cx = 512;
  const cy = 560;
  const r = 300;
  const w = 84;
  // 270° arc from 12 o'clock to 9 o'clock, clockwise.
  const arc = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
  const x = 402;
  const t = 64;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${w}"/>
    <path d="${arc}" fill="none" stroke="${fg}" stroke-width="${w}" stroke-linecap="round"/>
    <rect x="${cx - 64}" y="128" width="128" height="62" rx="24" fill="${fg}"/>
    <rect x="${x}" y="410" width="${t}" height="300" rx="10" fill="${fg}"/>
    <rect x="${x}" y="410" width="226" height="${t}" rx="10" fill="${fg}"/>
    <rect x="${x}" y="528" width="196" height="${t}" rx="10" fill="${fg}"/>
    <rect x="${x}" y="646" width="226" height="${t}" rx="10" fill="${fg}"/>`;
}

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4C6EF5"/>
      <stop offset="1" stop-color="#2A3FA8"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${mark({ fg: '#FFFFFF', track: 'rgba(255,255,255,0.24)' })}
</svg>`;

const ICON_DARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${DARK_BG}"/>
  ${mark({ fg: DARK_ICON_FG, track: rgba(DARK_ICON_FG, 0.22) })}
</svg>`;

const ICON_TINTED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#000000"/>
  ${mark({ fg: '#FFFFFF', track: 'rgba(255,255,255,0.24)' })}
</svg>`;

/** Transparent splash mark (the splash background colour comes from app.json). */
const splashSvg = (accent, track) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${mark({ fg: accent, track })}
</svg>`;

function render(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** PNG from RGBA pixels; `alpha: false` drops the alpha channel (colour type 2, RGB). */
function encodePng(rgba, width, height, alpha) {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * channels + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = row + 1 + x * channels;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      if (alpha) raw[dst + 3] = rgba[src + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // colour type
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writePng(file, svg, width, alpha) {
  const image = render(svg, width);
  const pixels = image.pixels;
  if (!alpha) {
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 255) throw new Error(`${file}: the icon must be fully opaque`);
    }
  }
  writeFileSync(file, encodePng(pixels, image.width, image.height, alpha));
  console.log(`[gen-icons] ${path.relative(ROOT, file)} ${image.width}x${image.height}${alpha ? ' RGBA' : ' RGB'}`);
}

writePng(path.join(ASSETS, 'icon.png'), ICON_SVG, 1024, false);
writePng(path.join(ASSETS, 'icon-dark.png'), ICON_DARK_SVG, 1024, false);
writePng(path.join(ASSETS, 'icon-tinted.png'), ICON_TINTED_SVG, 1024, false);
writePng(path.join(ASSETS, 'favicon.png'), ICON_SVG, 48, false);
writePng(path.join(ASSETS, 'splash-icon.png'), splashSvg(LIGHT_ACCENT, LIGHT_TRACK), 512, true);
writePng(path.join(ASSETS, 'splash-icon-dark.png'), splashSvg(DARK_ACCENT, DARK_TRACK), 512, true);

if (process.argv.includes('--preview')) {
  const out = path.join(ROOT, 'test-results', 'icons');
  mkdirSync(out, { recursive: true });
  for (const size of [60, 120, 180]) writePng(path.join(out, `icon-${size}.png`), ICON_SVG, size, false);
  writePng(path.join(out, 'icon-dark-180.png'), ICON_DARK_SVG, 180, false);
  writePng(path.join(out, 'icon-tinted-180.png'), ICON_TINTED_SVG, 180, false);
  // Splash marks on their backgrounds, as the system shows them.
  for (const [name, bg, accent, track] of [
    ['splash-light', LIGHT_BG, LIGHT_ACCENT, LIGHT_TRACK],
    ['splash-dark', DARK_BG, DARK_ACCENT, DARK_TRACK],
  ]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" fill="${bg}"/>${mark({ fg: accent, track })}</svg>`;
    writePng(path.join(out, `${name}.png`), svg, 256, false);
  }
}
