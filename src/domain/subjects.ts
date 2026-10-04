/** Subjects offered by the study timer, per exam type. Display names live in strings.ts. */

import type { ExamType } from './profile';

export const SUBJECTS_BY_EXAM: Record<ExamType, readonly string[]> = {
  YKS: [
    'matematik',
    'geometri',
    'turkce',
    'edebiyat',
    'fizik',
    'kimya',
    'biyoloji',
    'tarih',
    'cografya',
    'felsefe',
    'din',
    'yabanci_dil',
    'diger',
  ],
  LGS: ['turkce', 'matematik', 'fen', 'inkilap', 'din', 'yabanci_dil', 'diger'],
  KPSS: [
    'turkce',
    'matematik',
    'tarih',
    'cografya',
    'vatandaslik',
    'guncel',
    'egitim_bilimleri',
    'diger',
  ],
  DIGER: ['genel', 'diger'],
};

/** Subject to pre-select so that starting is a single tap. */
export function defaultSubject(examType: ExamType, lastUsed: string | null): string {
  const list = SUBJECTS_BY_EXAM[examType];
  return lastUsed !== null && list.includes(lastUsed) ? lastUsed : list[0];
}
