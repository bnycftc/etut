import { SUBJECT_COLORS, subjectColor } from '../../ui/subject-colors';
import { BRAND_BLUE, DARK, LIGHT, type Palette } from '../../ui/theme';
import { AYT_SUBJECTS_BY_AREA } from '../curriculum';
import { AA_GRAPHIC, AA_TEXT, contrastRatio } from '../contrast';
import { SUBJECTS_BY_EXAM } from '../subjects';

describe('contrast ratio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s theme meets WCAG AA', (_name, p: Palette) => {
  const text: [keyof Palette, keyof Palette][] = [
    ['text', 'background'],
    ['text', 'surface'],
    ['textMuted', 'background'],
    ['textMuted', 'surface'],
    ['accentText', 'accent'],
    ['accentText', 'danger'],
    ['accent', 'surface'],
    ['accent', 'background'],
    ['warning', 'surface'],
    ['warning', 'background'],
    ['danger', 'surface'],
    ['danger', 'background'],
    // Button and selected-chip labels on their fills.
    ['onPrimary', 'primary'],
    ['onDanger', 'dangerFill'],
    // Tonal buttons (no outline: the label is what shows the control): secondary ("Duraklat",
    // the ‹ › steps, the stepper's − +) and the soft destructive one ("Bitir", "Geri al").
    ['accent', 'secondaryFill'],
    ['text', 'secondaryFill'],
    ['danger', 'dangerSoft'],
    ['text', 'dangerSoft'],
    // A fill a screen draws as switched off, with a muted label. (Disabled buttons and chips are
    // their own colours at 40 % opacity: exempt from WCAG as inactive controls.)
    ['textMuted', 'disabled'],
    // The "today" card (soft brand tint) with everything drawn on it.
    ['text', 'accentSoft'],
    ['textMuted', 'accentSoft'],
    ['accent', 'accentSoft'],
    ['success', 'accentSoft'],
    ['streak', 'accentSoft'],
    // Saved / running states.
    ['success', 'surface'],
    ['success', 'successSoft'],
    ['text', 'successSoft'],
    ['textMuted', 'successSoft'],
    ['streak', 'surface'],
    ['streak', 'background'],
  ];
  it.each(text)('text %s on %s ≥ 4.5', (fg, bg) => {
    expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  const graphics: [keyof Palette, keyof Palette][] = [
    ['controlBorder', 'surface'],
    ['controlBorder', 'background'],
    ['controlBorder', 'accentSoft'],
    ['bar', 'surface'],
    ['bar', 'background'],
    ['accent', 'surface'],
    ['primary', 'surface'],
    ['primary', 'background'],
    ['dangerFill', 'surface'],
    ['dangerFill', 'background'],
    ['accent', 'barMuted'],
    // Weekly chart: today's bar stands out from the other days (each bar has its value written
    // above it, so the soft fill is never the only cue).
    ['accent', 'barSoft'],
  ];
  it.each(graphics)('control/graphic %s on %s ≥ 3', (fg, bg) => {
    expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  // Every subject the timer can offer has its own colour, visible on cards and the screen.
  const timerSubjects = [
    ...new Set([...Object.values(SUBJECTS_BY_EXAM).flat(), ...Object.values(AYT_SUBJECTS_BY_AREA).flat()]),
  ];
  it.each(timerSubjects)('subject %s has a colour ≥ 3 on surface and background', (id) => {
    expect(SUBJECT_COLORS[id]).toBeDefined();
    const colour = subjectColor(id, p);
    expect(contrastRatio(colour, p.surface)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    expect(contrastRatio(colour, p.background)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  // A selected subject chip is filled with the subject colour and labelled in `onSubject`
  // (white in light, the dark background in dark); its count badge swaps the two.
  it.each(timerSubjects)('subject %s as a chip fill carries its label ≥ 4.5', (id) => {
    expect(contrastRatio(p.onSubject, subjectColor(id, p))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

// The one brand blue outside the app (`BRAND_BLUE`, kept in sync by src/ui/__tests__/palette.test.ts).
describe('brand blue outside the app meets WCAG AA', () => {
  it.each([
    ['light', BRAND_BLUE.light, LIGHT.surface],
    ['dark', BRAND_BLUE.dark, DARK.surface],
  ])('widget title text (%s) on the widget ≥ 4.5', (_scheme, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // Icons and progress of the Live Activity: the Lock Screen and Dynamic Island are dark; the
  // banner can also be drawn on a light material.
  it.each([
    ['black', '#000000'],
    ['white', '#FFFFFF'],
  ])('Live Activity icons on %s ≥ 3', (_name, bg) => {
    expect(contrastRatio(BRAND_BLUE.dark, bg)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it.each([
    ['light', BRAND_BLUE.light, LIGHT.background],
    ['dark', BRAND_BLUE.dark, DARK.background],
  ])('splash mark (%s) on the splash background ≥ 3', (_scheme, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});
