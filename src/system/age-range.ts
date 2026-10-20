/** Android and web: no age signal, the declared band stands. The iOS version is `age-range.ios.ts`. */

import type { AgeSignal } from '../domain/age-signal';

export async function requestAgeSignal(): Promise<AgeSignal> {
  return 'unavailable';
}
