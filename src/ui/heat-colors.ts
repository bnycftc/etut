import type { HeatLevel } from '../domain/month-calendar';
import { DARK, type Palette } from './theme';

/**
 * Fills of the monthly calendar (`domain/month-calendar.ts` levels 0…4, more study = stronger
 * brand tint) with the colour of the day number drawn on each. Every pair is ≥ 4.5:1
 * (`src/domain/__tests__/heat-contrast.test.ts`). The shade is never the only cue: every day
 * also has its study time as its accessibility label, and the month's numbers are written out.
 */
export const HEAT_COLORS: Record<'light' | 'dark', readonly { fill: string; text: string }[]> = {
  light: [
    { fill: '#EEF1F5', text: '#111418' },
    { fill: '#D6DEFB', text: '#111418' },
    { fill: '#A3B4F2', text: '#111418' },
    { fill: '#3B5BDB', text: '#FFFFFF' },
    { fill: '#22378F', text: '#FFFFFF' },
  ],
  dark: [
    { fill: '#21262D', text: '#E6EDF3' },
    { fill: '#1F2B57', text: '#E6EDF3' },
    { fill: '#2F4BB0', text: '#FFFFFF' },
    { fill: '#6E8BFF', text: '#0D1117' },
    { fill: '#B4C2FF', text: '#0D1117' },
  ],
};

export function heatColor(level: HeatLevel, palette: Palette): { fill: string; text: string } {
  return HEAT_COLORS[palette === DARK ? 'dark' : 'light'][level];
}
