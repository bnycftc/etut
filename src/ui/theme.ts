import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  warning: string;
  danger: string;
  bar: string;
  barMuted: string;
}

const light: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E1E4E8',
  text: '#111418',
  textMuted: '#5B6470',
  accent: '#1F6FEB',
  accentText: '#FFFFFF',
  warning: '#9A6700',
  danger: '#CF222E',
  bar: '#1F6FEB',
  barMuted: '#D0D7DE',
};

const dark: Palette = {
  background: '#0D1117',
  surface: '#161B22',
  border: '#30363D',
  text: '#E6EDF3',
  textMuted: '#9DA7B3',
  accent: '#4C8DFF',
  accentText: '#0D1117',
  warning: '#D29922',
  danger: '#F85149',
  bar: '#4C8DFF',
  barMuted: '#30363D',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
