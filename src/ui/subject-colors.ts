import { DARK, type Palette } from './theme';

/**
 * One stable colour per subject, the same on every screen (chips, running timer, history,
 * weekly summary). Related subjects share a family (Matematik blue / Geometri cyan, Türkçe red /
 * Edebiyat pink, Fen green-violet-orange…). Colour is only ever a second cue next to the subject
 * name, never the only one. Each value is ≥ 3:1 against `surface` and `background` of its theme
 * (`src/domain/__tests__/contrast.test.ts` checks every timer subject).
 */
export const SUBJECT_COLORS: Record<string, { light: string; dark: string }> = {
  matematik: { light: '#2563EB', dark: '#60A5FA' },
  geometri: { light: '#0E7490', dark: '#22D3EE' },
  turkce: { light: '#DC2626', dark: '#F87171' },
  edebiyat: { light: '#DB2777', dark: '#F472B6' },
  fizik: { light: '#7C3AED', dark: '#A78BFA' },
  kimya: { light: '#EA580C', dark: '#FB923C' },
  biyoloji: { light: '#15803D', dark: '#4ADE80' },
  fen: { light: '#047857', dark: '#34D399' },
  tarih: { light: '#B45309', dark: '#FBBF24' },
  inkilap: { light: '#9A3412', dark: '#FDBA74' },
  cografya: { light: '#0F766E', dark: '#2DD4BF' },
  felsefe: { light: '#4F46E5', dark: '#818CF8' },
  din: { light: '#4D7C0F', dark: '#A3E635' },
  yabanci_dil: { light: '#C026D3', dark: '#E879F9' },
  vatandaslik: { light: '#0369A1', dark: '#38BDF8' },
  guncel: { light: '#E11D48', dark: '#FB7185' },
  egitim_bilimleri: { light: '#9333EA', dark: '#C084FC' },
  genel: { light: '#475569', dark: '#CBD5E1' },
  diger: { light: '#64748B', dark: '#94A3B8' },
};

/** Colour of `subjectId` in the current theme; unknown ids get the "Diğer" grey. */
export function subjectColor(subjectId: string, palette: Palette): string {
  const entry = SUBJECT_COLORS[subjectId] ?? SUBJECT_COLORS.diger;
  return palette === DARK ? entry.dark : entry.light;
}
