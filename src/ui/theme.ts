import { Platform, type TextStyle, useColorScheme, useWindowDimensions } from 'react-native';

import { DARK, LIGHT, type Palette } from './palette';

/** Colour tokens live in `palette.ts` (no React Native import, shared with scripts and tests). */
export { BRAND_BLUE, DARK, LIGHT, type Palette } from './palette';

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

/** Spacing: cards 16 apart (`lg`), sections 32 (`xxl`). */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

/**
 * SF Rounded for numbers and screen titles: the system font in its rounded design (iOS maps
 * `ui-rounded` to it; no font file, Dynamic Type works as with the default face). The web
 * preview uses the browser's rounded face where it has one, else the system font; Android keeps
 * its default face.
 */
export const ROUNDED_FONT = Platform.select({ ios: 'ui-rounded', web: 'ui-rounded, System' });

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Type scale. Body text is the system font (SF Pro); numbers and screen titles are rounded with
 * tabular digits, the same "clock voice" as the Live Activity and the widget
 * (`font({ design: 'rounded' })`). Everything scales with Dynamic Type; only the timer digits and
 * the header buttons are capped (`MAX_FONT_SCALE`).
 */
export const typography = {
  /** The running timer's digits. */
  clock: { fontFamily: ROUNDED_FONT, fontSize: 72, fontWeight: '700', letterSpacing: -2, fontVariant: tabular },
  /** The one hero number of a screen: today's total, a net, the time just saved. */
  display: { fontFamily: ROUNDED_FONT, fontSize: 40, fontWeight: '800', letterSpacing: -0.5, fontVariant: tabular },
  /** Numbers in stat tiles and lists ("30 sa 38 dk", "11,5 net"). */
  displaySmall: { fontFamily: ROUNDED_FONT, fontSize: 24, fontWeight: '800', fontVariant: tabular },
  largeTitle: { fontFamily: ROUNDED_FONT, fontSize: 34, fontWeight: '700', fontVariant: tabular },
  title: { fontFamily: ROUNDED_FONT, fontSize: 28, fontWeight: '700', fontVariant: tabular },
  /** Card titles: set apart from the 16 pt body. */
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13 },
  /** Section title above a group, outside its card (written in capitals). */
  section: { fontSize: 13, fontWeight: '600' },
  /** Smallest chart text (axis, values). */
  chartLabel: { fontSize: 12, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

/**
 * Largest Dynamic Type / font scale multiplier for the big timer digits (they must stay on one
 * line). Body text scales without a limit.
 */
export const MAX_FONT_SCALE = { clock: 1.3, header: 1.3 } as const;

/** From this font scale on (iOS accessibility text sizes) side-by-side controls are stacked. */
export const LARGE_TEXT_SCALE = 1.35;

/** True at accessibility text sizes: rows of buttons stack vertically so nothing is clipped. */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}
