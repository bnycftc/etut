import { useColorScheme, useWindowDimensions } from 'react-native';

/**
 * Colour tokens. Checked against WCAG 2.x AA by `src/domain/__tests__/contrast.test.ts`:
 * text ≥ 4.5:1 on `background` and `surface` (and on the soft tints it is drawn on), button
 * labels on their fills, and ≥ 3:1 for `controlBorder` (input, chip and button outlines), chart
 * `bar`s, filled controls and the subject colours (`subject-colors.ts`).
 * `border` is only the hairline around cards and is decorative.
 */
export interface Palette {
  background: string;
  surface: string;
  border: string;
  /** Outline of interactive controls (inputs, chips, secondary buttons). */
  controlBorder: string;
  text: string;
  textMuted: string;
  /** Brand colour for tints, links, progress and text. */
  accent: string;
  accentText: string;
  /** Soft brand tint behind the "today" card. */
  accentSoft: string;
  /** Fill of primary buttons and selected chips, with its label colour. */
  primary: string;
  onPrimary: string;
  /** Saved / done / running. */
  success: string;
  successSoft: string;
  /** Daily streak ("seri"). */
  streak: string;
  warning: string;
  danger: string;
  /** Fill of destructive buttons ("Bitir", "Sil"), with its label colour. */
  dangerFill: string;
  onDanger: string;
  /** Disabled control fill (its label is `textMuted`). */
  disabled: string;
  bar: string;
  barMuted: string;
}

export const LIGHT: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E1E4E8',
  controlBorder: '#848D97',
  text: '#111418',
  textMuted: '#5B6470',
  accent: '#3B5BDB',
  accentText: '#FFFFFF',
  accentSoft: '#F0F3FE',
  primary: '#3B5BDB',
  onPrimary: '#FFFFFF',
  success: '#1F7A45',
  successSoft: '#E6F4EA',
  streak: '#B3460B',
  warning: '#8A5C00',
  danger: '#C21F2B',
  dangerFill: '#C21F2B',
  onDanger: '#FFFFFF',
  disabled: '#E4E7EB',
  bar: '#5873DC',
  barMuted: '#D0D7DE',
};

export const DARK: Palette = {
  background: '#0D1117',
  surface: '#161B22',
  border: '#30363D',
  controlBorder: '#656D76',
  text: '#E6EDF3',
  textMuted: '#9DA7B3',
  accent: '#91A7FF',
  accentText: '#0D1117',
  accentSoft: '#1A2036',
  // iOS-style filled button: white label on a deeper blue than the text accent.
  primary: '#4263EB',
  onPrimary: '#FFFFFF',
  success: '#5CC98A',
  successSoft: '#14261C',
  streak: '#F59E5B',
  warning: '#D29922',
  danger: '#F85149',
  dangerFill: '#D1242F',
  onDanger: '#FFFFFF',
  disabled: '#262C35',
  bar: '#5C7CFA',
  barMuted: '#30363D',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

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
