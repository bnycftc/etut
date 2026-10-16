/**
 * Colour tokens ("Halka"), without any React Native import so that scripts (`scripts/gen-icons.mjs`)
 * and tests can read them too. Screens get them through `usePalette()` in `theme.ts`.
 *
 * Checked against WCAG 2.x AA by `src/domain/__tests__/contrast.test.ts`: text ≥ 4.5:1 on
 * `background` and `surface` and on every tonal fill it is drawn on (button labels on their fills,
 * the label of a selected subject chip on the subject colour), and ≥ 3:1 for `controlBorder`
 * (input and chip outlines), chart `bar`s, filled controls and the subject colours
 * (`subject-colors.ts`). `border` (the dark hero card's edge) and the tonal fills against the
 * surface are decorative: a tonal control is recognised by its label.
 */
export interface Palette {
  /** Screen background: blue-grey paper (light), designed navy-black (dark). */
  background: string;
  /** Cards. */
  surface: string;
  /** Decorative edge: the hero card in dark mode, sheets and bars. */
  border: string;
  /** Outline of what can be typed into or picked: inputs and unselected chips. */
  controlBorder: string;
  text: string;
  textMuted: string;
  /** The brand blue for tints, links, progress and text (labels of secondary buttons). */
  accent: string;
  accentText: string;
  /** Soft brand tint of the hero ("Bugün") card. */
  accentSoft: string;
  /** Tonal fill of secondary buttons (iOS "tinted"); the label is `accent`. */
  secondaryFill: string;
  /** Fill of primary buttons and selected chips, with its label colour. */
  primary: string;
  onPrimary: string;
  /** Label of a chip filled with its subject colour (selected subject). */
  onSubject: string;
  /** Saved / done / running. */
  success: string;
  successSoft: string;
  /** Daily streak ("seri"). */
  streak: string;
  warning: string;
  danger: string;
  /** Tonal fill of a reversible destructive action ("Bitir", "Geri al"); the label is `danger`. */
  dangerSoft: string;
  /** Full red fill, only for the final destructive confirmation ("Evet, hepsini sil"). */
  dangerFill: string;
  onDanger: string;
  /** Grey fill for a control a screen draws as switched off itself (buttons and chips use opacity). */
  disabled: string;
  /** Chart bars, and the weekly chart's highlighted day is `accent`. */
  bar: string;
  /**
   * The other days of the weekly chart: soft, so today's `accent` bar stands out (≥ 3:1 apart).
   * Every bar has its value written above it, so the fill is never the only cue.
   */
  barSoft: string;
  /** Empty bar / progress track. */
  barMuted: string;
}

export const LIGHT: Palette = {
  background: '#F3F5FA',
  surface: '#FFFFFF',
  border: '#E3E7F0',
  controlBorder: '#7B8597',
  text: '#111827',
  textMuted: '#59627A',
  accent: '#3B5BDB',
  accentText: '#FFFFFF',
  accentSoft: '#E9EEFC',
  secondaryFill: '#E1E8FB',
  primary: '#3B5BDB',
  onPrimary: '#FFFFFF',
  onSubject: '#FFFFFF',
  success: '#1F7A45',
  successSoft: '#E3F3E8',
  streak: '#6342C7',
  warning: '#8A5C00',
  danger: '#C21F2B',
  dangerSoft: '#FBE8EA',
  dangerFill: '#C21F2B',
  onDanger: '#FFFFFF',
  disabled: '#E6E9F0',
  bar: '#4F6BE0',
  barSoft: '#B5C3F4',
  barMuted: '#D6DCEA',
};

export const DARK: Palette = {
  background: '#0B0F1A',
  surface: '#151B2B',
  border: '#273149',
  controlBorder: '#6E7993',
  text: '#E9EDF6',
  textMuted: '#A2ABBF',
  accent: '#93A8FF',
  accentText: '#0B0F1A',
  accentSoft: '#1D2744',
  secondaryFill: '#243359',
  // iOS-style filled button: white label on a deeper blue than the text accent.
  primary: '#3D5FE0',
  onPrimary: '#FFFFFF',
  // The light subject colours of the dark theme carry a dark label.
  onSubject: '#0B0F1A',
  success: '#5CC98A',
  successSoft: '#142A1E',
  streak: '#B9A8FF',
  warning: '#E0A72E',
  danger: '#FF6F66',
  dangerSoft: '#3A1B20',
  dangerFill: '#C92A33',
  onDanger: '#FFFFFF',
  disabled: '#232B3D',
  bar: '#5C7CFA',
  barSoft: '#3A4C85',
  barMuted: '#2A3350',
};

/**
 * The one brand blue outside the app's screens, where this file cannot be imported at run time:
 * the Live Activity and the widget (their `'widget'` functions run in the extension's own
 * runtime, so the values are written out there), the splash screen (`app.json`,
 * `scripts/gen-icons.mjs`). `light` on light backgrounds; `dark` on dark ones and on the Lock
 * Screen. `src/ui/__tests__/palette.test.ts` checks those files against these values.
 */
export const BRAND_BLUE = { light: LIGHT.accent, dark: DARK.bar } as const;
