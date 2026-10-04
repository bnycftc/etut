/**
 * Exam dates for the countdown ("sınava geri sayım"). Checked 2026-10-04:
 *
 * - ÖSYM had not published its 2027 calendar (osym.gov.tr/Sayfa/SinavTakvimi showed 2026 only;
 *   the 2026 calendar came out mid-November 2025). MEB had not announced LGS 2027 either.
 *   All 2027 dates below are therefore ESTIMATES and shown as "tahmini"; the student can set
 *   the exact date. Replace them once the official calendars are out (expected Nov 2026).
 * - YKS: TYT has been on the 3rd Saturday of June in most recent years (2025-06-21,
 *   2026-06-20, ÖSYM archive) → TYT 2027-06-19 (Saturday), AYT/YDT the next day.
 * - LGS: one day, two sessions; usually a Sunday in mid-June (2025-06-15, 2026-06-13 was moved
 *   to a Saturday) → 2027-06-13 (Sunday).
 * - KPSS: the GY-GK session runs every year ("KPSS Lisans" in even years, "KPSS A Grubu" in
 *   odd years: 2023-07-23, 2025-09-07; 2026-09-06). Önlisans and ortaöğretim KPSS are held only
 *   in even years, so not in 2027. The 2026-KPSS Lisans guide (madde 1.12–1.13) calls the
 *   odd-year session "KPSS A Grubu" and the even-year one "KPSS B Grubu Lisans"; the odd-year
 *   score appears not to count for B-group (memur) posts, which most KPSS students aim at.
 *   Default: the next B-group GY-GK, estimated 2028-09-03 (Sunday; 2026-09-06 pattern).
 *   A-group candidates (2027-KPSS A Grubu, estimated 2027-09-05) set their date by hand.
 */

import { addDays, type DayKey, dayStartMs, DAY_MS } from './istanbul-day';
import type { ExamType } from './profile';

export interface ExamDate {
  /** First day of the exam (Istanbul). */
  day: DayKey;
  /** Not yet announced by ÖSYM/MEB; shown as "tahmini". */
  estimated: boolean;
}

export const EXAM_DATES: Record<ExamType, ExamDate | null> = {
  YKS: { day: '2027-06-19', estimated: true },
  LGS: { day: '2027-06-13', estimated: true },
  KPSS: { day: '2028-09-03', estimated: true },
  DIGER: null,
};

export interface ResolvedExamDate extends ExamDate {
  /** Set by the student (overrides the built-in date). */
  custom: boolean;
}

export function resolveExamDate(examType: ExamType, custom: DayKey | null): ResolvedExamDate | null {
  if (custom !== null) return { day: custom, estimated: false, custom: true };
  const builtIn = EXAM_DATES[examType];
  return builtIn === null ? null : { ...builtIn, custom: false };
}

/** Whole Istanbul days from `today` to `examDay` (0 on the exam day, negative after it). */
export function daysUntil(examDay: DayKey, today: DayKey): number {
  return Math.round((dayStartMs(examDay) - dayStartMs(today)) / DAY_MS);
}

/** `GG.AA.YYYY` (also `/` or `-` separated, one-digit day/month allowed) → day key, or `null`. */
export function parseDayInput(text: string): DayKey | null {
  const match = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*$/.exec(text);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const key: DayKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Reject impossible dates such as 31.02.
  return addDays(key, 0) === key ? key : null;
}

/** Day key → `GG.AA.YYYY` for the edit field. */
export function formatDayInput(day: DayKey): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}
