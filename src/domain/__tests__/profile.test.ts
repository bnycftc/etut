import {
  birthYearOptions,
  buildProfile,
  isProfile,
  isSoloOnly,
  minimumAge,
  refreshSoloFlag,
} from '../profile';

const NOW = Date.parse('2026-10-04T09:00:00Z');

describe('age rule (birth year only, lower age wins)', () => {
  it('uses the lowest possible age in the current year', () => {
    expect(minimumAge(2010, 2026)).toBe(15);
    expect(minimumAge(2011, 2026)).toBe(14);
    expect(minimumAge(2030, 2026)).toBe(0);
  });

  it('solo only unless certainly 15 or older', () => {
    expect(isSoloOnly(2010, 2026)).toBe(false); // 15 or 16 this year
    expect(isSoloOnly(2011, 2026)).toBe(true); // 14 or 15: may still be 14
    expect(isSoloOnly(2014, 2026)).toBe(true);
  });
});

describe('birthYearOptions', () => {
  it('is a neutral list, newest first, without a default', () => {
    const years = birthYearOptions(2026);
    expect(years[0]).toBe(2018);
    expect(years[years.length - 1]).toBe(1956);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });
});

describe('buildProfile', () => {
  it('needs a birth year and exam type', () => {
    expect(buildProfile({ birthYear: null, examType: 'KPSS', yksArea: null }, 2026, NOW)).toBeNull();
    expect(buildProfile({ birthYear: 2000, examType: null, yksArea: null }, 2026, NOW)).toBeNull();
  });

  it('needs an area for YKS only', () => {
    expect(buildProfile({ birthYear: 2008, examType: 'YKS', yksArea: null }, 2026, NOW)).toBeNull();
    expect(buildProfile({ birthYear: 1995, examType: 'KPSS', yksArea: 'sayisal' }, 2026, NOW)).toEqual({
      birthYear: 1995,
      examType: 'KPSS',
      yksArea: null,
      soloOnly: false,
      createdAt: NOW,
    });
  });

  it('sets the solo flag for under-15 declarations', () => {
    const p = buildProfile({ birthYear: 2012, examType: 'LGS', yksArea: null }, 2026, NOW);
    expect(p?.soloOnly).toBe(true);
    const q = buildProfile({ birthYear: 2008, examType: 'YKS', yksArea: 'esit_agirlik' }, 2026, NOW);
    expect(q?.soloOnly).toBe(false);
    expect(q?.yksArea).toBe('esit_agirlik');
  });

  it('rejects years outside the offered list', () => {
    expect(buildProfile({ birthYear: 2025, examType: 'DIGER', yksArea: null }, 2026, NOW)).toBeNull();
  });
});

describe('refreshSoloFlag', () => {
  it('lifts the flag only once the student is certainly 15+', () => {
    const p = buildProfile({ birthYear: 2011, examType: 'YKS', yksArea: 'sayisal' }, 2026, NOW)!;
    expect(p.soloOnly).toBe(true);
    expect(refreshSoloFlag(p, 2026)).toBe(p);
    expect(refreshSoloFlag(p, 2027).soloOnly).toBe(false);
  });

  it('never turns the flag on again', () => {
    const p = buildProfile({ birthYear: 2000, examType: 'KPSS', yksArea: null }, 2026, NOW)!;
    expect(refreshSoloFlag(p, 2026)).toBe(p);
  });
});

describe('isProfile', () => {
  it('validates stored values', () => {
    expect(isProfile({ birthYear: 2008, examType: 'YKS', yksArea: 'dil', soloOnly: false })).toBe(true);
    expect(isProfile({ birthYear: 2008, examType: 'SAT', yksArea: null, soloOnly: false })).toBe(false);
    expect(isProfile({ birthYear: '2008', examType: 'YKS', yksArea: null, soloOnly: false })).toBe(false);
    expect(isProfile(null)).toBe(false);
  });
});
