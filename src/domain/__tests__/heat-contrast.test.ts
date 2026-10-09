import { HEAT_COLORS } from '../../ui/heat-colors';
import { AA_TEXT, contrastRatio, relativeLuminance } from '../contrast';

describe.each(['light', 'dark'] as const)('monthly calendar colours (%s)', (theme) => {
  const levels = HEAT_COLORS[theme];

  it('has one fill per level 0…4', () => {
    expect(levels).toHaveLength(5);
  });

  it.each([0, 1, 2, 3, 4])('day numbers on level %i are readable (WCAG AA text)', (level) => {
    const { fill, text } = levels[level];
    expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('more study is always a stronger tint (light: darker, dark: lighter)', () => {
    const lum = levels.map((l) => relativeLuminance(l.fill));
    for (let i = 1; i < lum.length; i++) {
      if (theme === 'light') expect(lum[i]).toBeLessThan(lum[i - 1]);
      else expect(lum[i]).toBeGreaterThan(lum[i - 1]);
    }
  });
});
