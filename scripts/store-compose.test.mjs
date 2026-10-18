/**
 * scripts/store-compose.mjs without a simulator: the committed fonts and captions, the text
 * checks, the luma fallback crops and the output format, on synthetic raw shots.
 *
 *   npm run test:store-compose
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  checkConfig,
  checkFonts,
  decodePng,
  encodePngRgb,
  findBanner,
  findIsland,
  FONTS,
  forbiddenIn,
  LIMITS,
  loadConfig,
  measure,
  pngInfo,
  renderFrame,
  resolveSources,
  SIZE,
} from './store-compose.mjs';

const config = loadConfig();
const dir = mkdtempSync(path.join(tmpdir(), 'store-compose-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** An opaque RGBA image filled by `paint(x, y) → [r, g, b]`. */
function image(width, height, paint) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
const inside = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const save = (name, img) => writeFileSync(path.join(dir, name), encodePngRgb(img.data, img.width, img.height));

// A home screen with the Dynamic Island, and a Notification Center with the Live Activity
// banner (light text rows inside), as the full shots tam-* of store-screenshots.yml.
const ISLAND = { x: 285, y: 42, w: 750, h: 111 };
const BANNER = { x: 48, y: 1500, w: 1224, h: 384 };
const homeScreen = image(SIZE.width, SIZE.height, (x, y) => {
  if (inside(x, y, ISLAND)) return inside(x, y, { x: 900, y: 70, w: 90, h: 50 }) ? [255, 255, 255] : [0, 0, 0];
  return [70 + (x % 97), 120, 190];
});
const lockScreen = image(SIZE.width, SIZE.height, (x, y) => {
  if (inside(x, y, BANNER)) {
    const text = (y > 1530 && y < 1560 && x < 500) || (y > 1600 && y < 1700 && x < 420) || (y > 1780 && y < 1815 && x < 1000);
    return text && x % 4 < 2 ? [255, 255, 255] : [10, 26, 22];
  }
  return [110, 130, 150];
});

test('the fonts are present, unmodified and come with the OFL licence', () => {
  assert.deepEqual(checkFonts(), []);
});

test('Turkish letters have their own glyphs in both fonts', () => {
  for (const face of [FONTS.display, FONTS.text]) {
    const box = (c) => measure(c, face, 96);
    const missing = box(''); // no glyph in Inter: the .notdef box
    for (const [base, accented] of [
      ['I', 'İ'], ['S', 'Ş'], ['s', 'ş'], ['G', 'Ğ'], ['g', 'ğ'], ['C', 'Ç'], ['c', 'ç'],
      ['O', 'Ö'], ['o', 'ö'], ['U', 'Ü'], ['u', 'ü'],
    ]) {
      const a = box(accented);
      assert.ok(a !== undefined, `${face.family}: ${accented} not drawn`);
      assert.ok(a.height > box(base).height + 10, `${face.family}: ${accented} has no mark`);
      assert.notEqual(Math.round(a.width), Math.round(missing.width), `${face.family}: ${accented} is the missing-glyph box`);
    }
    assert.ok(box('ı').height < box('i').height - 10, `${face.family}: ı has a dot`);
  }
});

test('the committed captions pass every check', () => {
  assert.deepEqual(checkConfig(config), []);
  assert.ok(config.frames.length >= 1 && config.frames.length <= LIMITS.frames);
  for (const f of config.frames) {
    assert.ok(f.title.length <= 2 && [...f.title.join(' ')].length <= 35, f.out);
    assert.ok(f.sub.length <= 2 && [...f.sub.join(' ')].length <= 70, f.out);
    assert.deepEqual(forbiddenIn([...f.title, ...f.sub, f.chip ?? ''].join(' ')), [], f.out);
  }
});

test('the checks catch price, LGS, ranking and streak-loss words, long and shouted lines, the offline claim', () => {
  for (const text of [
    'Tamamen ücretsiz', 'Bedava', '99 TL', 'LGS denemeleri', 'Türkiye sıralaması', 'Arkadaşlarınla yarış',
    'Seriyi kaybetme', 'Serin bozulmaz', 'En iyi uygulama', '#1 uygulama', 'ÖSYM onaylı', 'Kesin başarı',
  ]) {
    assert.notDeepEqual(forbiddenIn(text), [], text);
  }
  assert.deepEqual(forbiddenIn('Kronometre ya da pomodoro; TYT, AYT netleri'), []);

  const bad = structuredClone(config);
  bad.frames[1].title = ['Bu başlık otuz beş karakterden', 'çok daha uzun'];
  bad.frames[2].sub = ['LGS denemesi ücretsiz'];
  bad.frames[3].title = ['KRONOMETRE'];
  bad.frames[4].title = ['Doğru ve yanlışı gir, net hazır!'];
  const problems = checkConfig(bad, 'export const GROUPS_ENABLED: boolean = true;');
  const has = (...parts) => problems.some((p) => parts.every((s) => p.includes(s)));
  assert.ok(has('02-net-grafigi.png title', 'characters'), problems.join('\n'));
  assert.ok(has('03-yanlis-konular.png sub', 'lgs', 'ücret'), problems.join('\n'));
  assert.ok(has('04-kronometre-pomodoro.png title', 'upper case'), problems.join('\n'));
  assert.ok(has('05-net-hesabi.png title', 'px wide'), problems.join('\n'));
  assert.ok(has('07-veriler-sende.png', 'GROUPS_ENABLED'), problems.join('\n'));
});

test('the luma fallback finds the Dynamic Island and the Live Activity banner in full shots', () => {
  assert.deepEqual(findIsland(homeScreen), ISLAND);
  assert.deepEqual(findBanner(lockScreen), BANNER);
});

test('frames are 1320 × 2868 RGB PNGs without alpha, for every layout and both backgrounds', () => {
  save('tam-dynamic-island.png', homeScreen);
  save('tam-canli-etkinlik.png', lockScreen);
  const screen = image(SIZE.width, SIZE.height, (x, y) => [245, 247, 250 - (y % 40)]);

  const layouts = new Set();
  const backgrounds = new Set();
  for (const frame of config.frames) {
    // One frame per layout and background is enough (each render takes about two seconds).
    if (layouts.has(frame.layout) && backgrounds.has(frame.bg)) continue;
    layouts.add(frame.layout);
    backgrounds.add(frame.bg);
    save(frame.screen, screen);
    const resolved = resolveSources(frame, [dir]);
    assert.equal(resolved.problems, undefined, JSON.stringify(resolved.problems));
    if (frame.layout === 'hero') {
      assert.deepEqual(resolved.sources.island.crop, ISLAND);
      assert.deepEqual(resolved.sources.activity.crop, BANNER);
    }
    const png = renderFrame(config, frame, resolved.sources);
    assert.deepEqual(pngInfo(png), { width: SIZE.width, height: SIZE.height, colorType: 2 }, frame.out);
    const back = decodePng(png);
    assert.equal(back.width, SIZE.width);
    assert.equal(back.height, SIZE.height);
  }
  assert.deepEqual([...layouts].sort(), ['hero', 'screen-bleed', 'screen-full']);
  assert.deepEqual([...backgrounds].sort(), ['brand', 'night']);
});

test('a cropOn result of an implausible size gives way to the crop of the full shot', () => {
  const hero = config.frames.find((f) => f.layout === 'hero');
  save(hero.parts.island, image(120, 120, () => [0, 0, 0]));
  const fallback = resolveSources(hero, [dir]);
  assert.equal(fallback.problems, undefined, JSON.stringify(fallback.problems));
  assert.equal(path.basename(fallback.sources.island.file), 'tam-dynamic-island.png');
  assert.deepEqual(fallback.sources.island.crop, ISLAND);
  save(hero.parts.island, image(750, 111, () => [0, 0, 0]));
  const direct = resolveSources(hero, [dir]);
  assert.equal(path.basename(direct.sources.island.file), hero.parts.island);
});

test('a missing or wrong-size source is reported, not drawn', () => {
  const frame = config.frames.find((f) => f.layout === 'screen-bleed');
  assert.match(resolveSources(frame, [path.join(dir, 'nowhere')]).problems.join(), /missing/);
  save('small.png', image(100, 200, () => [0, 0, 0]));
  assert.match(resolveSources({ ...frame, screen: 'small.png' }, [dir]).problems.join(), /100x200, expected 1320x2868/);
});
