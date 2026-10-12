/**
 * App Store listing in store/app-store/ (written to App Store Connect by
 * .github/workflows/asc-metadata.yml): Apple's length limits, the keyword rules, the "not official"
 * sentence (docs/hukuk/kvkk/11 §5) and no group/social wording while the group module is off.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { GROUPS_ENABLED } from '../config/features';

const STORE = join(__dirname, '..', '..', 'store', 'app-store');
const read = (file: string) => readFileSync(join(STORE, file), 'utf8').trim();

const name = read('tr/name.txt');
const subtitle = read('tr/subtitle.txt');
const keywords = read('tr/keywords.txt');
const promotional = read('tr/promotional_text.txt');
const description = read('tr/description.txt');
const notes = read('review-notes.txt');

it('fits App Store Connect length limits', () => {
  expect(name.length).toBeGreaterThan(0);
  expect(name.length).toBeLessThanOrEqual(30);
  expect(subtitle.length).toBeGreaterThan(0);
  expect(subtitle.length).toBeLessThanOrEqual(30);
  expect(promotional.length).toBeGreaterThan(0);
  expect(promotional.length).toBeLessThanOrEqual(170);
  expect(description.length).toBeGreaterThan(0);
  expect(description.length).toBeLessThanOrEqual(4000);
  expect(notes.length).toBeGreaterThan(0);
  expect(notes.length).toBeLessThanOrEqual(4000);
});

it('keywords: at most 100 bytes, no spaces around commas, no word repeated from the name', () => {
  expect(Buffer.byteLength(keywords, 'utf8')).toBeLessThanOrEqual(100);
  expect(keywords).not.toMatch(/\s,|,\s/);
  const words = keywords.split(',');
  expect(words.every((w) => w.length > 0)).toBe(true);
  expect(new Set(words).size).toBe(words.length);
  const nameWords = name.toLocaleLowerCase('tr').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const w of words) expect(nameWords).not.toContain(w.toLocaleLowerCase('tr'));
});

it('the name is Etüt and neither name nor subtitle names ÖSYM or MEB', () => {
  expect(name).toContain('Etüt');
  for (const text of [name, subtitle]) {
    expect(text.toLocaleUpperCase('tr')).not.toContain('ÖSYM');
    expect(text.toLocaleUpperCase('tr')).not.toContain('MEB');
  }
});

it('the description says the app is not official and keeps data on the phone', () => {
  expect(description).toContain('Etüt resmî bir uygulama değildir; ÖSYM veya MEB ile bağlantısı yoktur.');
  expect(description).toContain('yalnız telefonunda');
});

it('support and marketing URLs are the public site', () => {
  expect(read('tr/support_url.txt')).toBe('https://bnycftc.github.io/etut/');
  expect(read('tr/marketing_url.txt')).toBe('https://bnycftc.github.io/etut/');
});

(GROUPS_ENABLED ? it.skip : it)('no group or social wording while the group module is off', () => {
  for (const text of [name, subtitle, keywords, promotional, description]) {
    const lower = text.toLocaleLowerCase('tr');
    for (const word of ['grup', 'arkadaş', 'sıralama', 'sohbet']) expect(lower).not.toContain(word);
  }
});

it('age-rating.json parses and uses only API value shapes', () => {
  const parsed = JSON.parse(read('age-rating.json')) as { attributes: Record<string, unknown> };
  const entries = Object.entries(parsed.attributes);
  expect(entries.length).toBeGreaterThan(0);
  for (const [, value] of entries) {
    expect(typeof value === 'boolean' || value === 'NONE').toBe(true);
  }
  // v0 answers (docs/hukuk/kvkk/11 §0): no contests, no UGC, no messaging.
  expect(parsed.attributes).toMatchObject({ contests: 'NONE', userGeneratedContent: false, messagingAndChat: false });
});
