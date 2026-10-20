/**
 * Apple's Declared Age Range (expo-age-range → DeclaredAgeRange `AgeRangeService.requestAgeRange`),
 * hukuk/03 K-17. Asks with the gates 15 and 18, so the shared range is under 15, 15–17 or 18+;
 * `src/domain/age-signal.ts` combines it with the declared birth year. Only the range comes back,
 * no birth date; nothing is sent anywhere from here.
 *
 * - Below iOS 26 the module does not ask anyone and answers `lowerBound: 18` (an "adult"): that is
 *   no signal, so it is reported as 'unavailable' without calling the module.
 * - ERR_AGE_RANGE_USER_DECLINED → 'declined'. Every other failure (ERR_AGE_RANGE_NOT_AVAILABLE:
 *   no Apple Account or no entitlement; invalid request; no view controller) → 'unavailable'.
 *
 * Needs the `com.apple.developer.declared-age-range` entitlement (plugins/with-age-range.js), which
 * only builds with the group module on carry.
 */

import { requestAgeRangeAsync } from 'expo-age-range';
import { Platform } from 'react-native';

import type { AgeSignal } from '../domain/age-signal';

export const AGE_SIGNAL_MIN_IOS = 26;
const GATES = { threshold1: 15, threshold2: 18 } as const;

function iosMajorVersion(): number {
  const version = Platform.Version;
  return typeof version === 'number' ? version : Number.parseInt(String(version), 10);
}

export async function requestAgeSignal(): Promise<AgeSignal> {
  // NaN (unparseable version) fails the comparison too.
  if (!(iosMajorVersion() >= AGE_SIGNAL_MIN_IOS)) return 'unavailable';
  try {
    const range = await requestAgeRangeAsync(GATES);
    return { lowerBound: range.lowerBound ?? null, upperBound: range.upperBound ?? null };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    return code === 'ERR_AGE_RANGE_USER_DECLINED' ? 'declined' : 'unavailable';
  }
}
