/**
 * The "Yakında" preview of the Groups tab (src/ui/groups-teaser.tsx) while GROUPS_ENABLED is off.
 * It must not be able to reach the network or the group account (no src/sync, no device storage,
 * no supabase), and its words stay within the design rules (K-09, K-13; no date, no pressure).
 * Rendering, the tab for 15+ and its absence under 15: src/__tests__/groups-screens.test.tsx.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { tr } from '../../strings';

const SRC = resolve(__dirname, '../..');
const ROOT = resolve(SRC, '..');
const EXTENSIONS = ['.ts', '.tsx', '.native.ts', '.native.tsx', '.ios.ts', '.ios.tsx', '.web.ts', '.web.tsx'];

/** Every file a specifier can load on any platform (`x.ios.ts` next to `x.ts`, `x/index.ts`). */
function resolveLocal(from: string, specifier: string): string[] {
  const base = specifier.startsWith('@/') ? join(SRC, specifier.slice(2)) : resolve(dirname(from), specifier);
  const candidates = [...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => join(base, 'index' + ext))];
  const found = candidates.filter((file) => existsSync(file));
  if (found.length === 0) throw new Error(`cannot resolve ${specifier} from ${from}`);
  return found;
}

/** Local files and packages reachable from `entry` through imports and requires, type-only imports left out. */
function importGraph(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    const specifiers = [
      ...source.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm),
      ...source.matchAll(/\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const specifier of specifiers) {
      if (specifier.startsWith('.') || specifier.startsWith('@/')) queue.push(...resolveLocal(file, specifier));
      else packages.add(specifier);
    }
  }
  return { files: [...files].map((f) => relative(ROOT, f).replace(/\\/g, '/')).sort(), packages: [...packages].sort() };
}

function allText(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allText);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(allText);
  return [];
}

describe('groups "Yakında" preview', () => {
  const graph = importGraph(join(SRC, 'ui/groups-teaser.tsx'));

  it('reaches no network, sync or storage code', () => {
    expect(graph.files.filter((f) => /^src\/(sync|storage|state|system)\//.test(f))).toEqual([]);
    expect(graph.files.filter((f) => f.startsWith('src/config/'))).toEqual([]);
    // On-device only: icons and the haptic tap of shared components.
    const allowed = new Set(['react', 'react-native', 'expo-symbols', 'expo-haptics']);
    expect(graph.packages.filter((p) => !allowed.has(p))).toEqual([]);
    for (const file of graph.files) {
      // Code only: comments may name the server ("supabase/migrations").
      const code = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '');
      expect([file, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|supabase/i.test(code)]).toEqual([file, false]);
    }
  });

  it('offers nothing to press or fill in (no account can start from it)', () => {
    const source = readFileSync(join(SRC, 'ui/groups-teaser.tsx'), 'utf8');
    expect(source).not.toMatch(/\b(Button|Pressable|TextField|TextInput|Switch|ToggleRow|onPress|router)\b/);
  });

  const words = allText(tr.groupsTeaser);
  const lower = words.map((w) => w.toLocaleLowerCase('tr'));

  it('says it is not open yet and that the app works fully without it', () => {
    expect(tr.groupsTeaser.badge).toBe('Yakında');
    expect(tr.groupsTeaser.notOpenTitle).toBe('Henüz açık değil');
    expect(tr.groupsTeaser.notOpenBody).toContain('gruplar olmadan da tam çalışır');
    expect(tr.groupsTeaser.data).toContain('açıldığında ayrıca bilgilendirip onayını isteyeceğiz');
  });

  it('has no social-network, chat, feed or ranking wording (K-09, K-13)', () => {
    const banned = ['sosyal', 'topluluk', 'arkadaş', 'sohbet', 'özel mesaj', 'akış', 'takip', 'beğen', 'yorum', 'sıralama', 'lider', 'herkese açık', 'tüm türkiye'];
    for (const text of lower) for (const word of banned) expect([text, text.includes(word)]).toEqual([text, false]);
  });

  it('names no date and puts no pressure (no FOMO)', () => {
    const months = /(^|[^a-zçğıöşü])(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)([^a-zçğıöşü]|$)/;
    const pressure = ['kaçırma', 'acele', 'son şans', 'hemen', 'sınırlı', 'ilk sen', 'bekleme listesi', 'çok yakında', 'bu ay', 'bu yaz'];
    for (const text of lower) {
      expect([text, /\b20\d\d\b/.test(text) || months.test(text)]).toEqual([text, false]);
      for (const word of pressure) expect([text, text.includes(word)]).toEqual([text, false]);
    }
  });

  it('the parent part keeps the student in charge and rules out surveillance', () => {
    const { control, notSees } = tr.groupsTeaser.parent;
    expect(control).toContain('sen açarsın');
    expect(control).toContain('istediğin an kapatırsın');
    expect(control).toContain('veli kodu');
    expect(notSees).toBe('Konum, ekran ya da ayrıntılı geçmiş yok.');
  });
});
