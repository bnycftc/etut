import { useColorScheme } from 'react-native';

/**
 * Colour tokens. Checked against WCAG 2.x AA by `src/domain/__tests__/contrast.test.ts`:
 * text ≥ 4.5:1 on `background` and `surface` (also `accentText` on `accent`/`danger`), and
 * ≥ 3:1 for `controlBorder` (input, chip and button outlines) and chart `bar`s.
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
  accent: string;
  accentText: string;
  warning: string;
  danger: string;
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
  accent: '#1B64DA',
  accentText: '#FFFFFF',
  warning: '#8A5C00',
  danger: '#C21F2B',
  bar: '#5A8DE0',
  barMuted: '#D0D7DE',
};

export const DARK: Palette = {
  background: '#0D1117',
  surface: '#161B22',
  border: '#30363D',
  controlBorder: '#656D76',
  text: '#E6EDF3',
  textMuted: '#9DA7B3',
  accent: '#4C8DFF',
  accentText: '#0D1117',
  warning: '#D29922',
  danger: '#F85149',
  bar: '#3B6FD0',
  barMuted: '#30363D',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/**
 * Largest Dynamic Type / font scale multiplier for text that must stay on one line or inside a
 * fixed layout (the big timer digits, tab labels). Body text scales without a limit.
 */
export const MAX_FONT_SCALE = { clock: 1.3, compact: 1.6 } as const;
