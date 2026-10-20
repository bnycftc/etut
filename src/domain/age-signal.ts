/**
 * The age band from the declared birth year and Apple's Declared Age Range signal (hukuk/03 K-17:
 * when the two disagree, the lower age wins).
 *
 * The signal can only LOWER the declared band, never raise it: an under-15 declaration stays
 * under 15 whatever the signal says. This also neutralises the iOS < 26 trap, where
 * expo-age-range answers `lowerBound: 18` without asking anyone (the adapter reports
 * 'unavailable' there anyway).
 */

import { ADULT_AGE, type AgeBand, ageBandFor } from './groups';
import { SOLO_AGE_LIMIT } from './profile';

/** What `src/system/age-range` reports: a shared age range, or why there is none. */
export type AgeSignal =
  | 'declined'
  | 'unavailable'
  | { lowerBound: number | null; upperBound: number | null };

export type ResolvedBand = 'under15' | AgeBand;

export interface BandDecision {
  band: ResolvedBand;
  /** 'soloOnly': personal features only, no server account (K-16). */
  action: 'soloOnly' | 'groupsAllowed';
}

const RANK: Record<ResolvedBand, number> = { under15: 0, '15_17': 1, '18_plus': 2 };

/** The highest band the signal allows, or `null` when it does not limit the declared band. */
export function signalCap(signal: AgeSignal): ResolvedBand | null {
  if (typeof signal === 'string') return null;
  const { upperBound } = signal;
  if (upperBound === null || !Number.isFinite(upperBound)) return null;
  if (upperBound < SOLO_AGE_LIMIT) return 'under15';
  if (upperBound < ADULT_AGE) return '15_17';
  return null;
}

export function resolveBand(declaredYear: number, signal: AgeSignal, currentYear: number): BandDecision {
  const declared = ageBandFor(declaredYear, currentYear) ?? 'under15';
  const cap = signalCap(signal);
  const band = cap !== null && RANK[cap] < RANK[declared] ? cap : declared;
  return { band, action: band === 'under15' ? 'soloOnly' : 'groupsAllowed' };
}

/**
 * The birth year to keep on the device once the signal decided the band (src/state/app-state
 * saveProfile; app/(tabs)/gruplar). Unchanged when the declared year already gives that band (the
 * signal never raises it). Otherwise the signal overrides the declared year:
 * - under 15: currentYear − 15, the year closest to the declaration that is still under 15 (lowest
 *   age 14). The profile becomes solo only and the age guard records the year, so "Tüm verileri
 *   sil" cannot raise it; the signal is asked again when the Gruplar sign-up opens next time.
 * - 15–17: currentYear − 16, the lowest age of the band (15): the lower age wins (K-17).
 */
export function birthYearAfterSignal(declaredYear: number, decision: BandDecision, currentYear: number): number {
  const declared = ageBandFor(declaredYear, currentYear) ?? 'under15';
  if (declared === decision.band || decision.band === '18_plus') return declaredYear;
  return decision.band === 'under15' ? currentYear - SOLO_AGE_LIMIT : currentYear - SOLO_AGE_LIMIT - 1;
}
