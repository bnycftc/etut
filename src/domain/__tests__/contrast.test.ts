import { SUBJECT_COLORS, subjectColor } from '../../ui/subject-colors';
import { DARK, LIGHT, type Palette } from '../../ui/theme';
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
    // Disabled buttons: grey fill, muted label (exempt from WCAG, kept readable anyway).
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
});
