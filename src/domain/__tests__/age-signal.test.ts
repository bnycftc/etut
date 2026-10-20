import { type AgeSignal, resolveBand } from '../age-signal';

const YEAR = 2026;
// Lowest possible age in 2026: 2015 → 10, 2009 → 16, 2000 → 25.
const UNDER_15 = 2015;
const TEEN = 2009;
const ADULT = 2000;

const UNDER_15_RANGE: AgeSignal = { lowerBound: null, upperBound: 14 };
const TEEN_RANGE: AgeSignal = { lowerBound: 15, upperBound: 17 };
const ADULT_RANGE: AgeSignal = { lowerBound: 18, upperBound: null };
/** What expo-age-range answers below iOS 26 without asking anyone. */
const IOS_25_TRAP: AgeSignal = { lowerBound: 18, upperBound: null };

describe('resolveBand (K-17: the lower age wins)', () => {
  test.each<[string, number, AgeSignal, string, string]>([
    ['signal under 15 overrides an adult declaration', ADULT, UNDER_15_RANGE, 'under15', 'soloOnly'],
    ['signal under 15 overrides a 15–17 declaration', TEEN, UNDER_15_RANGE, 'under15', 'soloOnly'],
    ['signal under 15 agrees with an under-15 declaration', UNDER_15, UNDER_15_RANGE, 'under15', 'soloOnly'],
    ['signal 15–17 lowers an adult declaration', ADULT, TEEN_RANGE, '15_17', 'groupsAllowed'],
    ['signal 15–17 agrees with a 15–17 declaration', TEEN, TEEN_RANGE, '15_17', 'groupsAllowed'],
    ['signal 15–17 never raises an under-15 declaration', UNDER_15, TEEN_RANGE, 'under15', 'soloOnly'],
    ['signal 18+ keeps an adult declaration', ADULT, ADULT_RANGE, '18_plus', 'groupsAllowed'],
    ['signal 18+ never raises a 15–17 declaration', TEEN, ADULT_RANGE, '15_17', 'groupsAllowed'],
    ['iOS 25 trap (lowerBound 18) keeps an under-15 declaration', UNDER_15, IOS_25_TRAP, 'under15', 'soloOnly'],
    ['iOS 25 trap (lowerBound 18) keeps a 15–17 declaration', TEEN, IOS_25_TRAP, '15_17', 'groupsAllowed'],
    ['declined keeps an adult declaration', ADULT, 'declined', '18_plus', 'groupsAllowed'],
    ['declined keeps a 15–17 declaration', TEEN, 'declined', '15_17', 'groupsAllowed'],
    ['declined keeps an under-15 declaration', UNDER_15, 'declined', 'under15', 'soloOnly'],
    ['unavailable keeps an adult declaration', ADULT, 'unavailable', '18_plus', 'groupsAllowed'],
    ['unavailable keeps a 15–17 declaration', TEEN, 'unavailable', '15_17', 'groupsAllowed'],
    ['unavailable keeps an under-15 declaration', UNDER_15, 'unavailable', 'under15', 'soloOnly'],
    ['a range without bounds keeps the declaration', ADULT, { lowerBound: null, upperBound: null }, '18_plus', 'groupsAllowed'],
  ])('%s', (_name, declaredYear, signal, band, action) => {
    expect(resolveBand(declaredYear, signal, YEAR)).toEqual({ band, action });
  });

  test('the declared band uses the lower possible age of the birth year', () => {
    // 2011 in 2026: 14 or 15 → under 15; 2008: 17 or 18 → 15–17.
    expect(resolveBand(2011, 'unavailable', YEAR).band).toBe('under15');
    expect(resolveBand(2008, 'unavailable', YEAR).band).toBe('15_17');
    expect(resolveBand(2007, 'unavailable', YEAR).band).toBe('18_plus');
  });
});
