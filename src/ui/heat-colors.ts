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
    { fill: '#EEF1F5', text: '#111827' },
    { fill: '#C9D4F9', text: '#111827' },
    { fill: '#8FA4F0', text: '#111827' },
    { fill: '#3B5BDB', text: '#FFFFFF' },
    { fill: '#1E2F7A', text: '#FFFFFF' },
  ],
  dark: [
    { fill: '#1A2136', text: '#E9EDF6' },
    { fill: '#233366', text: '#E9EDF6' },
    { fill: '#3A56C4', text: '#FFFFFF' },
    { fill: '#7F9BFF', text: '#0B0F1A' },
    { fill: '#C6D2FF', text: '#0B0F1A' },
  ],
};

export function heatColor(level: HeatLevel, palette: Palette): { fill: string; text: string } {
  return HEAT_COLORS[palette === DARK ? 'dark' : 'light'][level];
}
