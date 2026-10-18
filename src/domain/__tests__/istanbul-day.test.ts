import {
  addDays,
  dayStartMs,
  istanbulDayKey,
  istanbulDayStartMs,
  istanbulWeekday,
  istanbulYear,
  lastDays,
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
