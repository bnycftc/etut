/**
 * Mock exam (deneme) structure and net calculation.
 * YKS and KPSS: net = correct − wrong / 4 (four wrong answers cancel one correct one).
 * LGS: net = correct − wrong / 3.
 * Question counts follow the current ÖSYM YKS format (TYT 120, AYT 160, YDT 80), the MEB LGS
 * format (90) and the ÖSYM KPSS GY-GK format (120); sources next to each table below.
 */

import type { ExamType } from './profile';

export type YksExamKind = 'TYT' | 'AYT_SAY' | 'AYT_EA' | 'AYT_SOZ' | 'YDT';
export type ExamKind = YksExamKind | 'LGS' | 'KPSS_GYGK';
export type ExamScope = 'genel' | 'brans';

export interface ExamSection {
  /** Stable id; the display name lives in strings.ts. */
  id: string;
  questions: number;
}

export const YKS_EXAM_KINDS: readonly YksExamKind[] = ['TYT', 'AYT_SAY', 'AYT_EA', 'AYT_SOZ', 'YDT'];
/** Every paper a stored exam (or a backup) may have. */
export const EXAM_KINDS: readonly ExamKind[] = [...YKS_EXAM_KINDS, 'LGS', 'KPSS_GYGK'];

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
  // LGS (MEB merkezî sınav, 8. sınıf): sözel oturum Türkçe 20, T.C. İnkılap Tarihi ve Atatürkçülük
  // 10, Din Kültürü 10, Yabancı Dil 10; sayısal oturum Matematik 20, Fen Bilimleri 20 (90 soru).
  // Ham puan = doğru − yanlış/3. Kaynak: MEB, Merkezî Sınav Başvuru ve Uygulama Kılavuzu 2026,
  // https://www.meb.gov.tr/meb_iys_dosyalar/2026_04/03170012_LGS_Basvuru_ve_Uygulama_Kilavuzu_2026_.pdf
  // (erişim 2026-10-07).
  LGS: [
    { id: 'turkce', questions: 20 },
    { id: 'inkilap', questions: 10 },
    { id: 'din', questions: 10 },
    { id: 'yabanci_dil', questions: 10 },
    { id: 'matematik', questions: 20 },
    { id: 'fen', questions: 20 },
  ],
  // KPSS Genel Yetenek (60) + Genel Kültür (60); ham puan = doğru − yanlış/4. Test toplamları ve
  // puanlama: ÖSYM, 2026 KPSS Kılavuzu (Lisans),
  // https://dokuman.osym.gov.tr/pdfdokuman/2026/KPSS/LISANS/kilavuz_Ld01072026.pdf (erişim
  // 2026-10-07). Ders dağılımı (GY: Türkçe 30, Matematik 30; GK: Tarih 27, Coğrafya 18,
  // Vatandaşlık 9, Güncel Bilgiler 6) ÖSYM soru kitapçıklarının sırasıdır, kılavuzda ayrıca
  // yazmaz; `curriculum/kpss.ts` aynı dağılımı kullanır. Eğitim Bilimleri ve ÖABT kapsam dışı.
  KPSS_GYGK: [
    { id: 'turkce', questions: 30 },
    { id: 'matematik', questions: 30 },
    { id: 'tarih', questions: 27 },
    { id: 'cografya', questions: 18 },
    { id: 'vatandaslik', questions: 9 },
    { id: 'guncel', questions: 6 },
  ],
};

export interface SectionScore {
  sectionId: string;
  questions: number;
  correct: number;
  wrong: number;
}

export type ScoreError = 'not_integer' | 'negative' | 'too_many';

/** How many wrong answers cancel one correct answer on this paper. */
export function wrongsPerCorrect(kind: ExamKind): number {
  return kind === 'LGS' ? 3 : 4;
}

export function net(correct: number, wrong: number, kind: ExamKind): number {
  return correct - wrong / wrongsPerCorrect(kind);
}

export function validateScore(score: SectionScore): ScoreError | null {
  const { correct, wrong, questions } = score;
  if (!Number.isInteger(correct) || !Number.isInteger(wrong)) return 'not_integer';
  if (correct < 0 || wrong < 0) return 'negative';
  if (correct + wrong > questions) return 'too_many';
  return null;
}

export function totalNet(scores: readonly SectionScore[], kind: ExamKind): number {
  return scores.reduce((sum, s) => sum + net(s.correct, s.wrong, kind), 0);
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

/** YKS papers: TYT first, then the paper of the student's area, then the others. */
export function examKindsInOrder(area: YksArea | null): ExamKind[] {
  const preferred = aytKindForArea(area);
  return [
    'TYT',
    preferred,
    ...YKS_EXAM_KINDS.filter((k) => k !== 'TYT' && k !== preferred),
  ];
}

/**
 * Papers a student can enter a mock exam for: TYT and the AYT/YDT paper of the YKS area
 * (ÖSYM puan türleri: SAY, EA, SÖZ use one AYT paper each, DİL uses YDT). Without an area
 * (not a YKS profile) every paper stays available.
 */
export function examKindsForArea(area: YksArea | null): ExamKind[] {
  return area === null ? examKindsInOrder(null) : ['TYT', aytKindForArea(area)];
}

/**
 * Papers a student of this exam type can enter: the YKS papers of the area (above), the LGS paper,
 * the KPSS GY-GK paper. "Diğer" has no paper: a YKS form would give a wrong net there.
 */
export function examKindsFor(examType: ExamType, area: YksArea | null): ExamKind[] {
  switch (examType) {
    case 'YKS':
      return examKindsForArea(area);
    case 'LGS':
      return ['LGS'];
    case 'KPSS':
      return ['KPSS_GYGK'];
    case 'DIGER':
      return [];
  }
}

/**
 * Papers shown in charts and analysis: the student's own papers, plus any other paper the student
 * already has exams of (e.g. after changing the area or the exam), so stored data never disappears.
 */
export function examKindsToShow(
  examType: ExamType,
  area: YksArea | null,
  kindsInUse: Iterable<ExamKind>,
): ExamKind[] {
  const own = examKindsFor(examType, area);
  const used = new Set(kindsInUse);
  const rest = [...examKindsInOrder(area), 'LGS', 'KPSS_GYGK'] as ExamKind[];
  return [...own, ...rest.filter((k) => !own.includes(k) && used.has(k))];
}
