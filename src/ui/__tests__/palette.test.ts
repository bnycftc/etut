/**
 * One brand blue everywhere: the surfaces that cannot import `palette.ts` at run time write its
 * colours out, and these tests keep them equal. The Live Activity and the widget run their
 * `'widget'` functions in the extension's own runtime (`src/system/ios/*.tsx`); the splash screen
 * colours live in app.json (its marks come from `scripts/gen-icons.mjs`, which imports the palette).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BRAND_BLUE, DARK, LIGHT } from '../palette';

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const hexes = (source: string) => [...new Set(source.match(/#[0-9A-Fa-f]{6}\b/g) ?? [])].sort();

/** White: the Live Activity and widget accent when the system draws them in one colour. */
const WHITE = '#FFFFFF';

describe('brand blue outside the app', () => {
  it('the Live Activity uses the dark brand blue (its Lock Screen and Dynamic Island are dark)', () => {
    const source = read('src/system/ios/timer-activity.tsx');
    expect(source).toContain(`? '${WHITE}' : '${BRAND_BLUE.dark}'`);
    expect(hexes(source)).toEqual([BRAND_BLUE.dark, WHITE].sort());
  });

  it('the widget uses the brand blue of its scheme on the app surface colour', () => {
    const source = read('src/system/ios/today-widget.tsx');
    expect(source).toContain(`dark ? '${BRAND_BLUE.dark}' : '${BRAND_BLUE.light}'`);
    expect(source).toContain(`dark ? '${DARK.surface}' : '${LIGHT.surface}'`);
    expect(hexes(source)).toEqual([...new Set([BRAND_BLUE.dark, BRAND_BLUE.light, DARK.surface, LIGHT.surface, WHITE])].sort());
  });

  it('the splash screen sits on the app background of each scheme', () => {
    const app = JSON.parse(read('app.json')) as { expo: { plugins: unknown[] } };
    const splash = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [
      string,
      { backgroundColor: string; dark: { backgroundColor: string } },
    ];
    expect(splash[1].backgroundColor).toBe(LIGHT.background);
    expect(splash[1].dark.backgroundColor).toBe(DARK.background);
  });

  it('iOS 18+ icon appearances: light, dark and tinted from scripts/gen-icons.mjs', () => {
    const app = JSON.parse(read('app.json')) as { expo: { icon: string; ios: { icon: Record<string, string> } } };
    expect(app.expo.ios.icon).toEqual({
      light: app.expo.icon,
      dark: './assets/icon-dark.png',
      tinted: './assets/icon-tinted.png',
    });
    const icons = read('scripts/gen-icons.mjs');
    // The dark icon is the dark theme's accent on its background.
    expect(icons).toContain('const DARK_ICON_FG = DARK.accent;');
    expect(icons).toContain('fill="${DARK_BG}"');
  });

  it('the brand blue is the accent of light and the chart blue of dark', () => {
    expect(BRAND_BLUE).toEqual({ light: LIGHT.accent, dark: DARK.bar });
  });
});
