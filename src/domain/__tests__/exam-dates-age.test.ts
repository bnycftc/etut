import {
  daysUntil,
  EXAM_DATES,
  examDateKind,
  formatDayInput,
  isValidCustomExamDay,
  parseDayInput,
  readExamDayInput,
  resolveExamDate,
} from '../exam-dates';
import { istanbulWeekday } from '../istanbul-day';
import { canDeclareBirthYear, guardRecordAfter, isSoloOnly } from '../profile';

describe('exam countdown', () => {
  it('says what the shown date is: set by the student, an estimate, an official date or none', () => {
    expect(examDateKind(resolveExamDate('YKS', null))).toBe('estimated');
    expect(examDateKind(resolveExamDate('KPSS', null))).toBe('estimated');
    expect(examDateKind(resolveExamDate('YKS', '2027-06-26'))).toBe('custom');
    expect(examDateKind(resolveExamDate('DIGER', null))).toBe('none');
    expect(examDateKind(resolveExamDate('DIGER', '2027-07-01'))).toBe('custom');
    expect(examDateKind({ day: '2027-06-19', estimated: false, custom: false })).toBe('official');
  });

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

  it('the Ayarlar field: a date once valid, an error only for a finished entry', () => {
    const today = '2026-10-04';
    const typed = (text: string, left = false) => readExamDayInput(text, text.slice(0, -1), today, left);
    expect(typed('26.06.2027')).toBe('2027-06-26');
    expect(readExamDayInput('26.06.2027', '', today, false)).toBe('2027-06-26'); // pasted
    expect(typed('4.10.2026', true)).toBe('2026-10-04');
    // Still being typed: no error before the year is complete.
    for (const text of ['', '2', '26.0', '26.06.', '26.06.202']) expect(typed(text)).toBeNull();
    // The year is typed: a past, too far or impossible date is an error at once.
    expect(typed('01.01.2020')).toBe('invalid');
    expect(typed('01.01.2035')).toBe('invalid');
    expect(typed('31.02.2027')).toBe('invalid');
    // The field left unfinished: an error; an empty field says nothing.
    expect(typed('26.06', true)).toBe('invalid');
    expect(typed('2027-06-26', true)).toBe('invalid');
    expect(typed('  ', true)).toBeNull();
  });

  it('the Ayarlar field: a half-corrected date is not saved before the field is left', () => {
    const today = '2026-10-04';
    // 31.06 is impossible; deleting the 1 to type a 0 passes through 3.06.2027.
    expect(readExamDayInput('3.06.2027', '31.06.2027', today, false)).toBeNull();
    expect(readExamDayInput('30.06.2027', '3.06.2027', today, false)).toBeNull();
    expect(readExamDayInput('30.06.2027', '30.06.2027', today, true)).toBe('2027-06-30');
    expect(readExamDayInput('12.1.2027', '12.13.2027', today, false)).toBeNull();
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

  it('only an under-15 declaration is recorded; the youngest one wins', () => {
    expect(guardRecordAfter(null, 2000, YEAR)).toBeNull();
    expect(guardRecordAfter(null, 2012, YEAR)).toBe(2012);
    expect(guardRecordAfter(2012, 2014, YEAR)).toBe(2014);
    expect(guardRecordAfter(2014, 2012, YEAR)).toBe(2014);
  });

  it('a record that no longer means "under 15" is dropped', () => {
    // 2012 is under 15 in 2026 but certainly 15+ in 2028.
    expect(guardRecordAfter(2012, 2012, 2028)).toBeNull();
    expect(guardRecordAfter(2012, 2000, 2028)).toBeNull();
    expect(guardRecordAfter(2012, 2015, 2028)).toBe(2015);
  });

  it('flow: 2000 → nothing kept; delete; 2012 → kept; delete; 2000 → refused', () => {
    let record = guardRecordAfter(null, 2000, YEAR);
    expect(record).toBeNull();
    expect(canDeclareBirthYear(2012, record, YEAR)).toBe(true);
    record = guardRecordAfter(record, 2012, YEAR);
    expect(record).toBe(2012);
    expect(canDeclareBirthYear(2000, record, YEAR)).toBe(false);
  });
});
