import { DARK, LIGHT, type Palette } from '../../ui/theme';
import { AA_GRAPHIC, AA_TEXT, contrastRatio } from '../contrast';

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
  ];
  it.each(text)('text %s on %s ≥ 4.5', (fg, bg) => {
    expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  const graphics: [keyof Palette, keyof Palette][] = [
    ['controlBorder', 'surface'],
    ['controlBorder', 'background'],
    ['bar', 'surface'],
    ['accent', 'surface'],
  ];
  it.each(graphics)('control/graphic %s on %s ≥ 3', (fg, bg) => {
    expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});
