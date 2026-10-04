/**
 * First-launch profile and the age rule (hukuk/03 K-15, K-16, K-19).
 *
 * Only the birth YEAR is asked, so the exact age is unknown: someone born in year B is either
 * (Y − B − 1) or (Y − B) years old during year Y. When unsure, the lower age wins (K-17):
 * "solo only" (no group features at all) applies unless the student is certainly 15 or older,
 * i.e. Y − B − 1 ≥ 15.
 */

import type { YksArea } from './net';

export const SOLO_AGE_LIMIT = 15;
/** Year range offered by the neutral birth-year picker (no default selection). */
export const BIRTH_YEAR_MIN_AGE = 8;
export const BIRTH_YEAR_MAX_AGE = 70;

export type ExamType = 'YKS' | 'LGS' | 'KPSS' | 'DIGER';
export const EXAM_TYPES: readonly ExamType[] = ['YKS', 'LGS', 'KPSS', 'DIGER'];
export const YKS_AREAS: readonly YksArea[] = ['sayisal', 'esit_agirlik', 'sozel', 'dil'];

export interface Profile {
  birthYear: number;
  examType: ExamType;
  /** Only for YKS. */
  yksArea: YksArea | null;
  /** Under 15 (or possibly under 15): personal features only, groups never shown. */
  soloOnly: boolean;
  createdAt: number;
}

/** Lowest age the student can have at some point during `currentYear`. */
export function minimumAge(birthYear: number, currentYear: number): number {
  return Math.max(0, currentYear - birthYear - 1);
}

export function isSoloOnly(birthYear: number, currentYear: number): boolean {
  return minimumAge(birthYear, currentYear) < SOLO_AGE_LIMIT;
}

/** Newest year first; nothing is pre-selected by the UI. */
export function birthYearOptions(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = currentYear - BIRTH_YEAR_MIN_AGE; y >= currentYear - BIRTH_YEAR_MAX_AGE; y--) {
    years.push(y);
  }
  return years;
}

export interface ProfileInput {
  birthYear: number | null;
  examType: ExamType | null;
  yksArea: YksArea | null;
}

/** Returns a profile if the onboarding answers are complete, otherwise `null`. */
export function buildProfile(
  input: ProfileInput,
  currentYear: number,
  now: number,
): Profile | null {
  const { birthYear, examType } = input;
  if (birthYear === null || examType === null) return null;
  if (!birthYearOptions(currentYear).includes(birthYear)) return null;
  if (examType === 'YKS' && input.yksArea === null) return null;
  return {
    birthYear,
    examType,
    yksArea: examType === 'YKS' ? input.yksArea : null,
    soloOnly: isSoloOnly(birthYear, currentYear),
    createdAt: now,
  };
}

/**
 * Re-evaluates the flag as years pass. It only ever goes from solo → not solo when the
 * declared birth year makes the student certainly 15+; it is never switched back on here.
 */
export function refreshSoloFlag(profile: Profile, currentYear: number): Profile {
  if (profile.soloOnly && !isSoloOnly(profile.birthYear, currentYear)) {
    return { ...profile, soloOnly: false };
  }
  return profile;
}

export function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.birthYear === 'number' &&
    typeof v.examType === 'string' &&
    (EXAM_TYPES as readonly string[]).includes(v.examType) &&
    (v.yksArea === null || (YKS_AREAS as readonly string[]).includes(v.yksArea as string)) &&
    typeof v.soloOnly === 'boolean'
  );
}
