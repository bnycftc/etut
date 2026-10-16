/**
 * Exam dates for the countdown ("sınava geri sayım"). Checked 2026-10-04 (2028–2029 added 2026-10-16):
 *
 * - ÖSYM had not published its 2027 calendar (osym.gov.tr/Sayfa/SinavTakvimi showed 2026 only;
 *   the 2026 calendar came out mid-November 2025). MEB had not announced LGS 2027 either.
 *   The built-in dates are therefore ESTIMATES, one per exam year, shown as "tahmini"; the student
 *   can set the exact date. When a calendar comes out, its first day goes into
 *   `OFFICIAL_EXAM_DAYS` (one line): it replaces the estimate of that year.
 * - The countdown takes the first built-in date that has not passed (`resolveExamDate`): after an
 *   exam it moves on to the next one by itself, so a passed estimate does not stay on screen until
 *   an update, and a student a year ahead (11th grade) sees their own year once this one is over.
 * - YKS: TYT has been on the 3rd Saturday of June in most recent years (2025-06-21,
 *   2026-06-20, ÖSYM archive), AYT/YDT the next day. Not a rule: 2024 was 8-9 June because
 *   Kurban Bayramı fell on 16-19 June. No bayram falls in June in 2027-2029 (Kurban Bayramı is
 *   mid-May 2027, early May 2028, late April 2029) → TYT 2027-06-19, 2028-06-17, 2029-06-16.
 * - LGS: one day, two sessions; the weekend before YKS lately (2025-06-15 Sunday, 2026-06-13
 *   moved to a Saturday) → the Sunday before TYT: 2027-06-13, 2028-06-11, 2029-06-10.
 * - KPSS: the GY-GK session runs every year ("KPSS Lisans" in even years, "KPSS A Grubu" in
 *   odd years: 2023-07-23, 2025-09-07; 2026-09-06). Önlisans and ortaöğretim KPSS are held only
 *   in even years, so not in 2027. The 2026-KPSS Lisans guide (madde 1.12–1.13) calls the
 *   odd-year session "KPSS A Grubu" and the even-year one "KPSS B Grubu Lisans"; the odd-year
 *   score appears not to count for B-group (memur) posts, which most KPSS students aim at.
 *   Default: the next B-group GY-GK, estimated on the first Sunday of September (2026-09-06
 *   pattern): 2028-09-03, then 2030-09-01 (the next one after 2028, so 2029 has a countdown too).
 *   A-group candidates (2027-KPSS A Grubu, estimated 2027-09-05) set their date by hand.
 */

import { addDays, type DayKey, dayStartMs, DAY_MS } from './istanbul-day';
import type { ExamType } from './profile';

export interface ExamDate {
  /** First day of the exam (Istanbul). */
  day: DayKey;
  /** Not yet announced by ÖSYM/MEB; shown as "tahmini". */
  estimated: boolean;
  /** Days the exam takes, from `day` (YKS: TYT, then AYT/YDT); missing = 1. */
  days?: number;
}

/** Days each exam takes from its first day; missing = 1. */
const EXAM_LENGTH_DAYS: Partial<Record<ExamType, number>> = { YKS: 2 };

/** Estimated first days, one per exam year, oldest first (see the notes above). */
export const ESTIMATED_EXAM_DAYS: Record<ExamType, readonly DayKey[]> = {
  YKS: ['2027-06-19', '2028-06-17', '2029-06-16'],
  LGS: ['2027-06-13', '2028-06-11', '2029-06-10'],
  KPSS: ['2028-09-03', '2030-09-01'],
  DIGER: [],
};

/**
 * First days announced by ÖSYM (YKS, KPSS) and MEB (LGS), e.g. `YKS: ['2027-06-19']`. An official
 * day replaces the estimate of its year and is shown without "tahmini".
 */
export const OFFICIAL_EXAM_DAYS: Record<ExamType, readonly DayKey[]> = {
  YKS: [],
  LGS: [],
  KPSS: [],
  DIGER: [],
};

const yearOf = (day: DayKey) => day.slice(0, 4);

/**
 * The built-in dates of an exam, oldest first: the official days and the estimates of the other
 * years. The lists default to the tables above (tests pass their own).
 */
export function builtInExamDates(
  examType: ExamType,
  official: readonly DayKey[] = OFFICIAL_EXAM_DAYS[examType],
  estimated: readonly DayKey[] = ESTIMATED_EXAM_DAYS[examType],
): ExamDate[] {
  const officialYears = new Set(official.map(yearOf));
  const days = EXAM_LENGTH_DAYS[examType];
  const dates: ExamDate[] = [
    ...official.map((day) => ({ day, estimated: false })),
    ...estimated.filter((day) => !officialYears.has(yearOf(day))).map((day) => ({ day, estimated: true })),
  ];
  return dates
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    .map((d) => (days === undefined ? d : { ...d, days }));
}

/** Built-in dates per exam, oldest first. */
export const EXAM_DATES: Record<ExamType, readonly ExamDate[]> = {
  YKS: builtInExamDates('YKS'),
  LGS: builtInExamDates('LGS'),
  KPSS: builtInExamDates('KPSS'),
  DIGER: builtInExamDates('DIGER'),
};

export interface ResolvedExamDate extends ExamDate {
  /** Set by the student (overrides the built-in date). */
  custom: boolean;
}

/**
 * The date the countdown counts down to on `today`. The student's own date when set (it stays once
 * passed: the home screen then asks for a new one); otherwise the first built-in date whose last day
 * is today or later, and after the last one that one (shown as passed). `null` = no date at all
 * ("Diğer" without a date of its own). `dates` defaults to `EXAM_DATES` (tests pass their own).
 */
export function resolveExamDate(
  examType: ExamType,
  custom: DayKey | null,
  today: DayKey,
  dates: readonly ExamDate[] = EXAM_DATES[examType],
): ResolvedExamDate | null {
  // A date the student enters is the first day; the exam keeps its length (YKS: two days).
  if (custom !== null) return { day: custom, estimated: false, custom: true, days: EXAM_LENGTH_DAYS[examType] };
  const next = dates.find((d) => examDaysLeft(d, today) >= 0) ?? dates[dates.length - 1];
  return next === undefined ? null : { ...next, custom: false };
}

/**
 * What the shown exam date is, for the text next to it: set by the student, a built-in estimate,
 * a built-in official date, or no date at all ("Diğer" without a date of its own).
 */
export type ExamDateKind = 'custom' | 'estimated' | 'official' | 'none';

export function examDateKind(date: ResolvedExamDate | null): ExamDateKind {
  if (date === null) return 'none';
  if (date.custom) return 'custom';
  return date.estimated ? 'estimated' : 'official';
}

/** Whole Istanbul days from `today` to `examDay` (0 on the exam day, negative after it). */
export function daysUntil(examDay: DayKey, today: DayKey): number {
  return Math.round((dayStartMs(examDay) - dayStartMs(today)) / DAY_MS);
}

/**
 * The countdown: days left to the exam, 0 on every exam day ("Sınav günü bugün", also on YKS's
 * AYT/YDT day), negative only after the last one.
 */
export function examDaysLeft(exam: Pick<ExamDate, 'day' | 'days'>, today: DayKey): number {
  const left = daysUntil(exam.day, today);
  return left < 0 && left > -(exam.days ?? 1) ? 0 : left;
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

/** A date the student sets must be today or later (at most ~5 years ahead). */
export function isValidCustomExamDay(day: DayKey, today: DayKey): boolean {
  const days = daysUntil(day, today);
  return days >= 0 && days <= 5 * 366;
}

/**
 * The exam date field of Ayarlar saves without a Kaydet button (settings save on change): a date the
 * student may set is returned (= save it) as soon as it is typed, or when the field is left (`left`).
 * Any other edit than typing on after `previous` (deleting, correcting in the middle) waits for the
 * field to be left, so a half-corrected date (31.06 → 3.06) is never saved.
 * `null` = nothing to say yet; `'invalid'` = finished (the year typed, or the field left) but not
 * such a date.
 */
export function readExamDayInput(
  text: string,
  previous: string,
  today: DayKey,
  left: boolean,
): DayKey | 'invalid' | null {
  const day = parseDayInput(text);
  if (day !== null && isValidCustomExamDay(day, today)) return left || text.startsWith(previous) ? day : null;
  if (text.trim() === '') return null;
  return left || /\d{4}\s*$/.test(text) ? 'invalid' : null;
}

/** Day key → `GG.AA.YYYY` for the edit field. */
export function formatDayInput(day: DayKey): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}
