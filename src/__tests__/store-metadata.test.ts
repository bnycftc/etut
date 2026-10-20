/**
 * App Store listing in store/app-store/ (written to App Store Connect by
 * .github/workflows/asc-metadata.yml): Apple's length limits, the keyword rules, the "not official"
 * sentence (docs/hukuk/kvkk/11 §5) and the launch phase of the group module.
 *
 * Two listings live side by side: the device-only one (v0) at the root of store/app-store/, and the
 * group version in store/app-store/groups/ (same paths; its *.md files are notes for bny, not
 * listing). Both must pass the listing rules at all times. Which one is live follows GROUPS_PHASE:
 * - 'off' and 'beta18': the root stays v0 (no group wording, 4+ answers). The closed beta goes
 *   through TestFlight (store/testflight/), not through the App Store listing.
 * - 'public': the root files are copies of groups/, byte for byte apart from line endings.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { GROUPS_PHASE, type GroupsPhase } from '../config/features';

const STORE = join(__dirname, '..', '..', 'store', 'app-store');
const GROUPS = join(STORE, 'groups');
const TESTFLIGHT = join(__dirname, '..', '..', 'store', 'testflight');

/** Text of a file without the line-ending difference a Windows checkout adds. */
const norm = (text: string) => text.replace(/\r\n/g, '\n').trim();

/** Listing files of `dir` by relative path ('tr/name.txt'), without groups/ and without notes. */
function listingFiles(dir: string, prefix = ''): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    const rel = prefix + entry;
    if (statSync(path).isDirectory()) {
      if (rel === 'groups') continue;
      for (const [k, v] of listingFiles(path, `${rel}/`)) files.set(k, v);
    } else if (!entry.endsWith('.md')) {
      files.set(rel, norm(readFileSync(path, 'utf8')));
    }
  }
  return files;
}

const root = listingFiles(STORE);
const groups = listingFiles(GROUPS);

interface AgeRating {
  expectedRating: string;
  attributes: Record<string, unknown>;
}

const get = (files: Map<string, string>, file: string) => {
  const text = files.get(file);
  if (text === undefined) throw new Error(`missing ${file}`);
  return text;
};
const ageRating = (files: Map<string, string>) => JSON.parse(get(files, 'age-rating.json')) as AgeRating;
/** Texts customers read on the product page. */
const pageTexts = (files: Map<string, string>) =>
  ['tr/name.txt', 'tr/subtitle.txt', 'tr/keywords.txt', 'tr/promotional_text.txt', 'tr/description.txt', 'tr/whats_new.txt'].map(
    (f) => get(files, f),
  );

const GROUP_WORDS = ['grup', 'arkadaş', 'sıralama', 'sohbet'];
const DEMO_PLACEHOLDER = '[DEMO KODU]';

/** What makes a listing the device-only one (docs/hukuk/kvkk/11 §0). */
function v0Problems(files: Map<string, string>): string[] {
  const problems: string[] = [];
  for (const text of pageTexts(files)) {
    const lower = text.toLocaleLowerCase('tr');
    for (const word of GROUP_WORDS) if (lower.includes(word)) problems.push(`group word "${word}" in the listing`);
  }
  const age = ageRating(files);
  if (age.expectedRating !== '4+') problems.push(`expected rating ${age.expectedRating}, v0 is 4+`);
  for (const [k, v] of Object.entries({ contests: 'NONE', userGeneratedContent: false, messagingAndChat: false, parentalControls: false })) {
    if (age.attributes[k] !== v) problems.push(`age rating ${k} is ${String(age.attributes[k])}, v0 is ${String(v)}`);
  }
  if (get(files, 'review-notes.txt').includes(DEMO_PLACEHOLDER)) problems.push('v0 review notes mention the demo group');
  return problems;
}

/** The rule of each phase for the root listing, given both listings. */
function phaseProblems(phase: GroupsPhase, rootFiles: Map<string, string>, groupFiles: Map<string, string>): string[] {
  if (phase === 'public') {
    const problems: string[] = [];
    for (const file of new Set([...rootFiles.keys(), ...groupFiles.keys()])) {
      if (!rootFiles.has(file)) problems.push(`${file}: only in groups/, copy it to the root`);
      else if (!groupFiles.has(file)) problems.push(`${file}: only at the root, add it to groups/`);
      else if (rootFiles.get(file) !== groupFiles.get(file)) problems.push(`${file}: root differs from groups/`);
    }
    return problems;
  }
  // 'off' and 'beta18': the device-only listing stays.
  return v0Problems(rootFiles);
}

// ---------------------------------------------------------------- rules for both listings

describe.each([
  ['root', root],
  ['groups/', groups],
])('%s listing', (_label, files) => {
  const name = get(files, 'tr/name.txt');
  const subtitle = get(files, 'tr/subtitle.txt');
  const keywords = get(files, 'tr/keywords.txt');
  const promotional = get(files, 'tr/promotional_text.txt');
  const description = get(files, 'tr/description.txt');
  const whatsNew = get(files, 'tr/whats_new.txt');
  const notes = get(files, 'review-notes.txt');

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

  it('price words only in the description and promotional text (Guideline 2.3.7)', () => {
    expect(description.toLocaleLowerCase('tr')).toContain('ücretsiz');
    for (const text of [name, subtitle, keywords]) {
      for (const word of ['ücretsiz', 'bedava', 'free']) expect(text.toLocaleLowerCase('tr')).not.toContain(word);
    }
  });

  it('no LGS or young-age marketing in the listing (K-45)', () => {
    for (const text of [name, subtitle, keywords, promotional, description]) {
      expect(text.toLocaleUpperCase('tr')).not.toContain('LGS');
    }
  });

  it('whats_new.txt ("Sürümde yenilikler", from the second version on): at most 4000 characters, no LGS', () => {
    expect(whatsNew.length).toBeGreaterThan(0);
    expect(whatsNew.length).toBeLessThanOrEqual(4000);
    expect(whatsNew.toLocaleUpperCase('tr')).not.toContain('LGS');
  });

  it('the description says the app is not official and keeps data on the phone', () => {
    expect(description).toContain('Etüt resmî bir uygulama değildir; ÖSYM veya MEB ile bağlantısı yoktur.');
    expect(description).toContain('telefonunda saklanır (iPhone yedeğin açıksa o yedekte de)');
  });

  it('the listing does not say "only on the phone": iOS device backup also holds the data, as the legal texts say', () => {
    for (const text of [promotional, description]) expect(text).not.toContain('yalnız telefonunda');
  });

  it('support and marketing URLs are the public site', () => {
    expect(get(files, 'tr/support_url.txt')).toBe('https://bnycftc.github.io/etut/');
    expect(get(files, 'tr/marketing_url.txt')).toBe('https://bnycftc.github.io/etut/');
  });

  it('age-rating.json parses and uses only API value shapes', () => {
    const entries = Object.entries(ageRating(files).attributes);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, value] of entries) {
      expect(typeof value === 'boolean' || ['NONE', 'INFREQUENT', 'FREQUENT'].includes(value as string)).toBe(true);
    }
  });
});

it('both listings have the same files', () => {
  expect([...groups.keys()].sort()).toEqual([...root.keys()].sort());
});

// ---------------------------------------------------------------- the group version

describe('groups/ listing (0.5.0 public)', () => {
  const page = pageTexts(groups);
  const notes = get(groups, 'review-notes.txt');

  it('positions groups as study tracking, never as a social network or chat (K-13)', () => {
    for (const text of page) {
      const lower = text.toLocaleLowerCase('tr');
      for (const word of ['sosyal', 'topluluk', 'sohbet']) expect(lower).not.toContain(word);
    }
  });

  it('drops the device-only claims that are false with groups', () => {
    for (const text of page) {
      const lower = text.toLocaleLowerCase('tr');
      for (const claim of ['hesapsız', 'internete bağlanmaz', 'hesap yok', 'hiçbir şey göndermez']) expect(lower).not.toContain(claim);
    }
    const shots = JSON.parse(get(groups, 'tr/screenshots.json')) as { frames: { requires?: string[] }[] };
    for (const frame of shots.frames) expect(frame.requires ?? []).not.toContain('offline');
  });

  it('says what goes to the server and that groups are optional', () => {
    const description = get(groups, 'tr/description.txt');
    expect(description).toContain('kayıtların hiçbir sunucuya gitmez');
    expect(description).toContain('Türkiye’deki sunucumuzda');
    expect(description).toContain('Grup hesabını uygulamadan istediğin an silersin.');
  });

  it('age rating: the group answers of the plan, 13+ (K-44, kvkk/11 §2)', () => {
    const age = ageRating(groups);
    expect(age.expectedRating).toBe('13+');
    expect(age.attributes).toMatchObject({
      parentalControls: true,
      ageAssurance: true,
      userGeneratedContent: true,
      messagingAndChat: true,
      socialMedia: false,
      contests: 'FREQUENT',
      advertising: false,
      unrestrictedWebAccess: false,
    });
    expect(Object.keys(age.attributes).sort()).toEqual(Object.keys(ageRating(root).attributes).sort());
  });

  it('review notes: demo code placeholder once (asc-metadata.yml fills it from a secret), no device-only claims', () => {
    expect(notes.split(DEMO_PLACEHOLDER).length - 1).toBe(1);
    expect(notes).not.toMatch(/[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}/);
    expect(notes).not.toContain('no server');
    expect(notes).not.toContain('Data Not Collected');
    expect(notes).toContain('birth year 2000');
    expect(notes).toContain('YKS');
  });
});

// ---------------------------------------------------------------- the phase decides the root

it(`the root listing follows GROUPS_PHASE ('${GROUPS_PHASE}')`, () => {
  expect(phaseProblems(GROUPS_PHASE, root, groups)).toEqual([]);
});

// Each phase's rule, also for the phases the repository is not in yet. The device-only listing is a
// fixture here (the real root becomes the group version at 'public').
describe('phase rule', () => {
  const v0 = new Map(groups);
  for (const file of ['tr/promotional_text.txt', 'tr/description.txt', 'tr/whats_new.txt']) v0.set(file, 'Çalışma sayacı ve deneme takibi.');
  v0.set('review-notes.txt', 'On-device study timer.');
  v0.set(
    'age-rating.json',
    JSON.stringify({
      expectedRating: '4+',
      attributes: { contests: 'NONE', userGeneratedContent: false, messagingAndChat: false, parentalControls: false },
    }),
  );

  it("'off': the root is v0, the group version may not be at the root", () => {
    expect(phaseProblems('off', v0, groups)).toEqual([]);
    expect(phaseProblems('off', groups, groups)).toEqual(
      expect.arrayContaining(['group word "grup" in the listing', 'expected rating 13+, v0 is 4+', 'v0 review notes mention the demo group']),
    );
  });

  it("'beta18': the root stays v0", () => {
    expect(phaseProblems('beta18', v0, groups)).toEqual([]);
    expect(phaseProblems('beta18', groups, groups).length).toBeGreaterThan(0);
  });

  it("'public': the root must equal groups/", () => {
    expect(phaseProblems('public', groups, groups)).toEqual([]);
    expect(phaseProblems('public', v0, groups).length).toBeGreaterThan(0);
    const missing = new Map(groups);
    missing.delete('tr/whats_new.txt');
    expect(phaseProblems('public', missing, groups)).toEqual(['tr/whats_new.txt: only in groups/, copy it to the root']);
  });
});

// ---------------------------------------------------------------- TestFlight (closed beta)

describe('store/testflight (closed beta, entered by hand)', () => {
  const read = (file: string) => norm(readFileSync(join(TESTFLIGHT, file), 'utf8'));
  const whatToTest = read('tr/what_to_test.txt');
  const description = read('tr/beta_description.txt');
  const notes = read('beta-review-notes.txt');

  it('fits the TestFlight limits (4000 characters each)', () => {
    for (const text of [whatToTest, description, notes]) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(4000);
    }
  });

  it('says the beta is 18+ only', () => {
    expect(whatToTest).toContain('18 yaş ve üstü');
    expect(description).toContain('18 yaş ve üstü');
    expect(notes).toContain('18+');
  });

  it('no LGS marketing, no social-network wording, not official (K-45, K-13)', () => {
    for (const text of [whatToTest, description]) {
      expect(text.toLocaleUpperCase('tr')).not.toContain('LGS');
      for (const word of ['sosyal', 'topluluk', 'sohbet']) expect(text.toLocaleLowerCase('tr')).not.toContain(word);
    }
    expect(description).toContain('Etüt resmî bir uygulama değildir; ÖSYM veya MEB ile bağlantısı yoktur.');
  });

  it('Beta App Review notes: demo code placeholder once, never a real code', () => {
    expect(notes.split(DEMO_PLACEHOLDER).length - 1).toBe(1);
    expect(notes).not.toMatch(/[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}/);
  });
});
