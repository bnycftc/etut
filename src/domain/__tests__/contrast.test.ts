import { SUBJECT_COLORS, subjectColor, subjectTint } from '../../ui/subject-colors';
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
    // Also the streak badge: a surface pill on the "Bugün" card.
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
    // The goal ring on the "Bugün" card: its fill (brand blue, success and the seal once the goal
    // is met) against the card and against its own track (`barSoft`, with `accent` above). The goal
    // line next to it, or the muted line after Bitir, says it in words.
    ['accent', 'accentSoft'],
    ['success', 'accentSoft'],
    ['success', 'barSoft'],
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

  // The running timer card is the surface tinted with 8 % of the subject colour (`subjectTint`):
  // clock and subject line, the status ("Çalışıyorsun" / "Moladasın" / pomodoro's muted total),
  // the finish questions; its outline is the subject colour while counting, else `controlBorder`.
  // Filled controls sit on the tint too: Devam when paused, and the primary buttons of the Bitir
  // check ("Çalışıyordum, ekle ve bitir", "Hepsini kaydet"), which also come up while it runs.
  const onTint: (keyof Palette)[] = ['text', 'textMuted', 'success', 'warning'];
  const onTintGraphics: (keyof Palette)[] = ['controlBorder', 'primary'];
  it.each(timerSubjects)('running card of %s: its text ≥ 4.5, its outline and filled controls ≥ 3 on the tint', (id) => {
    const tint = subjectTint(id, p);
    for (const fg of onTint) expect(contrastRatio(p[fg], tint)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(subjectColor(id, p), tint)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    for (const fg of onTintGraphics) expect(contrastRatio(p[fg], tint)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  // Informational, below any WCAG threshold on purpose (decorative, the words carry the meaning):
  // the empty goal ring's track still shows on the "Bugün" card at 0 % in the morning, and the
  // card's 1 pt edge sets the soft tint off the page.
  it('goal ring track barSoft on accentSoft ≥ 1.5', () => {
    expect(contrastRatio(p.barSoft, p.accentSoft)).toBeGreaterThanOrEqual(1.5);
  });
  it('hero card edge heroBorder on background ≥ 1.3', () => {
    expect(contrastRatio(p.heroBorder, p.background)).toBeGreaterThanOrEqual(1.3);
  });
});

describe('subject tint', () => {
  it('is 8 % of the subject colour over the surface, as one opaque colour', () => {
    // #7C3AED over #FFFFFF at 0x14/255: 255 + (124 − 255) · 0.0784 = 244.7 → F5, …
    expect(subjectTint('fizik', LIGHT)).toBe('#F5F0FE');
    expect(subjectTint('matematik', DARK)).toMatch(/^#[0-9A-F]{6}$/);
    expect(subjectTint('unknown', LIGHT)).toBe(subjectTint('diger', LIGHT));
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

  // The Live Activity's icon is the subject's colour: the dark one in the Dynamic Island (black)
  // and on a dark Lock Screen, the light one on a light Lock Screen.
  it.each(Object.entries(SUBJECT_COLORS))('Live Activity icon of %s on black and white ≥ 3', (_id, color) => {
    expect(contrastRatio(color.dark, '#000000')).toBeGreaterThanOrEqual(AA_GRAPHIC);
    expect(contrastRatio(color.light, '#FFFFFF')).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it.each([
    ['light', BRAND_BLUE.light, LIGHT.background],
    ['dark', BRAND_BLUE.dark, DARK.background],
  ])('splash mark (%s) on the splash background ≥ 3', (_scheme, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});
