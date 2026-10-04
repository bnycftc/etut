import {
  daysUntil,
  EXAM_DATES,
  formatDayInput,
  isValidCustomExamDay,
  parseDayInput,
  resolveExamDate,
} from '../exam-dates';
import { istanbulWeekday } from '../istanbul-day';
import { canDeclareBirthYear, isSoloOnly, nextYoungestDeclared } from '../profile';

describe('exam countdown', () => {
  it('built-in 2027 dates are marked as estimates', () => {
    expect(EXAM_DATES.YKS).toEqual({ day: '2027-06-19', estimated: true });
    expect(istanbulWeekday('2027-06-19')).toBe(5); // Saturday
    expect(istanbulWeekday('2027-06-13')).toBe(6); // Sunday (LGS)
    expect(istanbulWeekday(EXAM_DATES.KPSS!.day)).toBe(6); // Sunday (KPSS GY-GK)
    expect(EXAM_DATES.LGS?.estimated && EXAM_DATES.KPSS?.estimated).toBe(true);
    expect(EXAM_DATES.DIGER).toBeNull();
  });

  it('counts whole Istanbul days; 0 on the exam day, negative afterwards', () => {
    expect(daysUntil('2027-06-19', '2026-10-04')).toBe(258);
    expect(daysUntil('2027-06-19', '2027-06-18')).toBe(1);
    expect(daysUntil('2027-06-19', '2027-06-19')).toBe(0);
    expect(daysUntil('2027-06-19', '2027-06-20')).toBe(-1);
  });

  it('a date set by the student overrides the estimate', () => {
    expect(resolveExamDate('YKS', null)).toEqual({ day: '2027-06-19', estimated: true, custom: false });
    expect(resolveExamDate('YKS', '2027-06-26')).toEqual({ day: '2027-06-26', estimated: false, custom: true });
    expect(resolveExamDate('DIGER', null)).toBeNull();
    expect(resolveExamDate('DIGER', '2027-03-01')?.custom).toBe(true);
  });

  it('parses GG.AA.YYYY and rejects impossible dates', () => {
    expect(parseDayInput('19.06.2027')).toBe('2027-06-19');
    expect(parseDayInput(' 5/7/2027 ')).toBe('2027-07-05');
    expect(parseDayInput('29.02.2028')).toBe('2028-02-29');
    expect(parseDayInput('29.02.2027')).toBeNull();
    expect(parseDayInput('31.04.2027')).toBeNull();
    expect(parseDayInput('2027-06-19')).toBeNull();
    expect(parseDayInput('')).toBeNull();
    expect(formatDayInput('2027-06-19')).toBe('19.06.2027');
  });

  it('a custom date must not be in the past', () => {
    expect(isValidCustomExamDay('2026-10-04', '2026-10-04')).toBe(true);
    expect(isValidCustomExamDay('2026-10-03', '2026-10-04')).toBe(false);
    expect(isValidCustomExamDay('2035-01-01', '2026-10-04')).toBe(false);
  });
});

describe('K-17: age declaration after deleting all data', () => {
  const YEAR = 2026;

  it('the first declaration is always allowed', () => {
    expect(canDeclareBirthYear(2000, null, YEAR)).toBe(true);
    expect(canDeclareBirthYear(2014, null, YEAR)).toBe(true);
  });

  it('after an under-15 declaration, an age of 15+ is refused', () => {
    expect(isSoloOnly(2012, YEAR)).toBe(true);
    expect(isSoloOnly(2010, YEAR)).toBe(false);
    expect(canDeclareBirthYear(2010, 2012, YEAR)).toBe(false);
    expect(canDeclareBirthYear(2000, 2012, YEAR)).toBe(false);
  });

  it('staying under 15, or declaring younger, is allowed', () => {
    expect(canDeclareBirthYear(2011, 2012, YEAR)).toBe(true);
    expect(canDeclareBirthYear(2012, 2012, YEAR)).toBe(true);
    expect(canDeclareBirthYear(2015, 2012, YEAR)).toBe(true);
  });

  it('between 15+ ages changes are free', () => {
    expect(canDeclareBirthYear(1990, 2005, YEAR)).toBe(true);
  });

  it('once the recorded year itself is certainly 15+, nothing is blocked', () => {
    // Declared 2012 in 2026 (under 15); in 2028 the same year means 15+.
    expect(canDeclareBirthYear(2000, 2012, 2028)).toBe(true);
  });

  it('the record keeps the youngest declaration', () => {
    expect(nextYoungestDeclared(null, 2005)).toBe(2005);
    expect(nextYoungestDeclared(2005, 2012)).toBe(2012);
    expect(nextYoungestDeclared(2012, 2005)).toBe(2012);
  });
});
