import {
  addDays,
  DAY_MS,
  dayStartMs,
  istanbulDayKey,
  istanbulDayStartMs,
  istanbulWeekday,
  istanbulYear,
  lastDays,
  splitByIstanbulDay,
} from '../istanbul-day';

const utc = (iso: string) => Date.parse(iso);

describe('istanbulDayKey', () => {
  it('uses Istanbul midnight (UTC+3), not UTC midnight', () => {
    expect(istanbulDayKey(utc('2026-10-03T20:59:59.999Z'))).toBe('2026-10-03');
    expect(istanbulDayKey(utc('2026-10-03T21:00:00.000Z'))).toBe('2026-10-04');
    // 01:30 UTC on Oct 4 is 04:30 Istanbul on Oct 4
    expect(istanbulDayKey(utc('2026-10-04T01:30:00Z'))).toBe('2026-10-04');
  });

  it('has no DST jump in summer or winter', () => {
    expect(istanbulDayKey(utc('2026-07-15T21:00:00Z'))).toBe('2026-07-16');
    expect(istanbulDayKey(utc('2026-01-15T21:00:00Z'))).toBe('2026-01-16');
  });

  it('handles the year boundary', () => {
    expect(istanbulDayKey(utc('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
    expect(istanbulYear(utc('2026-12-31T21:00:00Z'))).toBe(2027);
    expect(istanbulYear(utc('2026-12-31T20:59:00Z'))).toBe(2026);
  });
});

describe('day starts', () => {
  it('dayStartMs is 21:00 UTC of the previous day', () => {
    expect(dayStartMs('2026-10-04')).toBe(utc('2026-10-03T21:00:00Z'));
    expect(istanbulDayStartMs(utc('2026-10-04T12:00:00Z'))).toBe(utc('2026-10-03T21:00:00Z'));
  });

  it('rejects malformed keys', () => {
    expect(() => dayStartMs('2026-10-4')).toThrow();
  });

  it('addDays crosses months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('lastDays returns oldest first, ending today', () => {
    expect(lastDays(utc('2026-10-04T10:00:00Z'), 3)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
  });

  it('weekday is Monday-based', () => {
    expect(istanbulWeekday('2026-10-05')).toBe(0); // Monday
    expect(istanbulWeekday('2026-10-04')).toBe(6); // Sunday
  });
});

describe('splitByIstanbulDay', () => {
  it('keeps an interval inside one day whole', () => {
    const start = utc('2026-10-04T06:00:00Z');
    expect(splitByIstanbulDay({ start, end: start + 3_600_000 })).toEqual([
      { day: '2026-10-04', ms: 3_600_000 },
    ]);
  });

  it('splits at Istanbul midnight (23:30–00:45 → 30 + 45 min)', () => {
    const start = utc('2026-10-04T20:30:00Z'); // 23:30 Istanbul
    const end = utc('2026-10-04T21:45:00Z'); // 00:45 Istanbul next day
    expect(splitByIstanbulDay({ start, end })).toEqual([
      { day: '2026-10-04', ms: 30 * 60_000 },
      { day: '2026-10-05', ms: 45 * 60_000 },
    ]);
  });

  it('spans several days', () => {
    const start = dayStartMs('2026-10-01') + DAY_MS / 2;
    const parts = splitByIstanbulDay({ start, end: start + 2 * DAY_MS });
    expect(parts.map((p) => p.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(parts.reduce((s, p) => s + p.ms, 0)).toBe(2 * DAY_MS);
  });

  it('returns nothing for an empty interval', () => {
    expect(splitByIstanbulDay({ start: 10, end: 10 })).toEqual([]);
  });
});
