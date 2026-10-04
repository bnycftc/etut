/**
 * Mock exam (deneme) structure and net calculation for YKS.
 * Net = correct − wrong / 4 (four wrong answers cancel one correct one).
 * Question counts follow the current ÖSYM YKS format (TYT 120, AYT 160, YDT 80).
 */

export type ExamKind = 'TYT' | 'AYT_SAY' | 'AYT_EA' | 'AYT_SOZ' | 'YDT';
export type ExamScope = 'genel' | 'brans';

export interface ExamSection {
  /** Stable id; the display name lives in strings.ts. */
  id: string;
  questions: number;
}

export const EXAM_KINDS: readonly ExamKind[] = ['TYT', 'AYT_SAY', 'AYT_EA', 'AYT_SOZ', 'YDT'];

export const EXAM_SECTIONS: Record<ExamKind, readonly ExamSection[]> = {
  TYT: [
    { id: 'turkce', questions: 40 },
    { id: 'tarih', questions: 5 },
    { id: 'cografya', questions: 5 },
    { id: 'felsefe', questions: 5 },
    { id: 'din', questions: 5 },
    { id: 'matematik', questions: 40 },
    { id: 'fizik', questions: 7 },
    { id: 'kimya', questions: 7 },
    { id: 'biyoloji', questions: 6 },
  ],
  AYT_SAY: [
    { id: 'matematik', questions: 40 },
    { id: 'fizik', questions: 14 },
    { id: 'kimya', questions: 13 },
    { id: 'biyoloji', questions: 13 },
  ],
  AYT_EA: [
    { id: 'matematik', questions: 40 },
    { id: 'edebiyat', questions: 24 },
    { id: 'tarih1', questions: 10 },
    { id: 'cografya1', questions: 6 },
  ],
  AYT_SOZ: [
    { id: 'edebiyat', questions: 24 },
    { id: 'tarih1', questions: 10 },
    { id: 'cografya1', questions: 6 },
    { id: 'tarih2', questions: 11 },
    { id: 'cografya2', questions: 11 },
    { id: 'felsefe_grubu', questions: 12 },
    { id: 'din', questions: 6 },
  ],
  YDT: [{ id: 'yabanci_dil', questions: 80 }],
};

export interface SectionScore {
  sectionId: string;
  questions: number;
  correct: number;
  wrong: number;
}

export type ScoreError = 'not_integer' | 'negative' | 'too_many';

export function net(correct: number, wrong: number): number {
  return correct - wrong / 4;
}

export function validateScore(score: SectionScore): ScoreError | null {
  const { correct, wrong, questions } = score;
  if (!Number.isInteger(correct) || !Number.isInteger(wrong)) return 'not_integer';
  if (correct < 0 || wrong < 0) return 'negative';
  if (correct + wrong > questions) return 'too_many';
  return null;
}

export function totalNet(scores: SectionScore[]): number {
  return scores.reduce((sum, s) => sum + net(s.correct, s.wrong), 0);
}

/** Sections that a mock exam of this kind and scope contains. */
export function sectionsFor(
  kind: ExamKind,
  scope: ExamScope,
  bransSectionId?: string,
): readonly ExamSection[] {
  const all = EXAM_SECTIONS[kind];
  if (scope === 'genel') return all;
  const one = all.find((s) => s.id === bransSectionId);
  return one ? [one] : [];
}

/** Nets are multiples of 0.25; show at most two decimals in Turkish notation. */
export function formatNet(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

export type YksArea = 'sayisal' | 'esit_agirlik' | 'sozel' | 'dil';

/** The AYT/YDT paper that matches a YKS area. */
export function aytKindForArea(area: YksArea | null): ExamKind {
  switch (area) {
    case 'esit_agirlik':
      return 'AYT_EA';
    case 'sozel':
      return 'AYT_SOZ';
    case 'dil':
      return 'YDT';
    default:
      return 'AYT_SAY';
  }
}

/** TYT first, then the paper of the student's area, then the others. */
export function examKindsInOrder(area: YksArea | null): ExamKind[] {
  const preferred = aytKindForArea(area);
  return [
    'TYT',
    preferred,
    ...EXAM_KINDS.filter((k) => k !== 'TYT' && k !== preferred),
  ];
}
