/** Subjects offered by the study timer, per exam type. Display names live in strings.ts. */

import { AYT_SUBJECTS_BY_AREA } from './curriculum';
import type { YksArea } from './net';
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

/**
 * Timer subjects of TYT, which every YKS candidate takes (ÖSYM TYT: Türkçe 40, Temel Matematik 40
 * with the geometry questions, Sosyal Bilimler 20 = Tarih, Coğrafya, Felsefe, Din Kültürü,
 * Fen Bilimleri 20 = Fizik, Kimya, Biyoloji). TYT has no literature and no foreign language test.
 */
export const TYT_SUBJECTS: readonly string[] = [
  'turkce',
  'matematik',
  'geometri',
  'fizik',
  'kimya',
  'biyoloji',
  'tarih',
  'cografya',
  'felsefe',
  'din',
];

/**
 * Subjects a student sees (timer, manual entry, topics). YKS with an area: the AYT/YDT subjects of
 * that area first (`AYT_SUBJECTS_BY_AREA`: SAY = Matematik + Fen; EA = Matematik + TDE-Sosyal-1;
 * SÖZ = TDE-Sosyal-1 + Sosyal-2; DİL = YDT), then the remaining TYT subjects, then `diger`.
 * Every other exam type (and YKS without an area) keeps its full list.
 */
export function subjectsFor(examType: ExamType, yksArea: YksArea | null): readonly string[] {
  const all = SUBJECTS_BY_EXAM[examType];
  if (examType !== 'YKS' || yksArea === null) return all;
  const ayt = AYT_SUBJECTS_BY_AREA[yksArea];
  const tyt = TYT_SUBJECTS.filter((id) => !ayt.includes(id));
  return [...ayt, ...tyt, 'diger'];
}

/** Subject to pre-select so that starting is a single tap. */
export function defaultSubject(
  examType: ExamType,
  lastUsed: string | null,
  yksArea: YksArea | null = null,
): string {
  const list = subjectsFor(examType, yksArea);
  return lastUsed !== null && list.includes(lastUsed) ? lastUsed : list[0];
}
