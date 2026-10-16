import {
  builtInExamDates,
  daysUntil,
  ESTIMATED_EXAM_DAYS,
  EXAM_DATES,
  examDateKind,
  examDaysLeft,
  formatDayInput,
  isValidCustomExamDay,
  OFFICIAL_EXAM_DAYS,
  parseDayInput,
  readExamDayInput,
  resolveExamDate,
} from '../exam-dates';
import { istanbulWeekday } from '../istanbul-day';
import { canDeclareBirthYear, guardRecordAfter, isSoloOnly } from '../profile';

/** The day the tests "are" on when it does not matter (before every built-in date). */
const TODAY = '2026-10-04';

describe('exam countdown', () => {
  it('says what the shown date is: set by the student, an estimate, an official date or none', () => {
    expect(examDateKind(resolveExamDate('YKS', null, TODAY))).toBe('estimated');
    expect(examDateKind(resolveExamDate('KPSS', null, TODAY))).toBe('estimated');
    expect(examDateKind(resolveExamDate('YKS', '2027-06-26', TODAY))).toBe('custom');
    expect(examDateKind(resolveExamDate('DIGER', null, TODAY))).toBe('none');
    expect(examDateKind(resolveExamDate('DIGER', '2027-07-01', TODAY))).toBe('custom');
    expect(examDateKind({ day: '2027-06-19', estimated: false, custom: false })).toBe('official');
  });

  it('built-in dates: one estimate per exam year up to 2029, in order, on the right weekday', () => {
    expect(EXAM_DATES.YKS).toEqual([
      { day: '2027-06-19', estimated: true, days: 2 },
      { day: '2028-06-17', estimated: true, days: 2 },
      { day: '2029-06-16', estimated: true, days: 2 },
    ]);
    expect(EXAM_DATES.LGS.map((d) => d.day)).toEqual(['2027-06-13', '2028-06-11', '2029-06-10']);
    // KPSS B group only in even years: 2028, then 2030 (so 2029 counts down to it).
    expect(EXAM_DATES.KPSS.map((d) => d.day)).toEqual(['2028-09-03', '2030-09-01']);
    expect(EXAM_DATES.DIGER).toEqual([]);
    for (const d of EXAM_DATES.YKS) expect(istanbulWeekday(d.day)).toBe(5); // Saturday (TYT)
    for (const d of [...EXAM_DATES.LGS, ...EXAM_DATES.KPSS]) expect(istanbulWeekday(d.day)).toBe(6); // Sunday
    // LGS the Sunday before TYT, every year.
    EXAM_DATES.LGS.forEach((d, i) => expect(daysUntil(EXAM_DATES.YKS[i].day, d.day)).toBe(6));
    for (const t of ['YKS', 'LGS', 'KPSS'] as const) {
      expect(EXAM_DATES[t].every((d) => d.estimated)).toBe(true);
      expect(OFFICIAL_EXAM_DAYS[t]).toEqual([]);
      expect([...ESTIMATED_EXAM_DAYS[t]].sort()).toEqual(ESTIMATED_EXAM_DAYS[t]);
    }
    expect(EXAM_DATES.LGS[0].days).toBeUndefined();
  });

  it('an official day replaces the estimate of its year only, and is shown as official', () => {
    const dates = builtInExamDates('YKS', ['2027-06-26']);
    expect(dates).toEqual([
      { day: '2027-06-26', estimated: false, days: 2 },
      { day: '2028-06-17', estimated: true, days: 2 },
      { day: '2029-06-16', estimated: true, days: 2 },
    ]);
    expect(examDateKind(resolveExamDate('YKS', null, TODAY, dates))).toBe('official');
    // Its length still applies (YKS: two days), then the next year's estimate follows.
    expect(resolveExamDate('YKS', null, '2027-06-27', dates)?.day).toBe('2027-06-26');
    expect(resolveExamDate('YKS', null, '2027-06-28', dates)).toEqual({
      day: '2028-06-17',
      estimated: true,
      custom: false,
      days: 2,
    });
    // An official day for a year without an estimate is added in order.
    expect(builtInExamDates('KPSS', ['2027-09-05']).map((d) => [d.day, d.estimated])).toEqual([
      ['2027-09-05', false],
      ['2028-09-03', true],
      ['2030-09-01', true],
    ]);
  });

  it('the countdown moves on to the next year once an exam is over (also for 11th graders)', () => {
    const shown = (t: 'YKS' | 'LGS' | 'KPSS', today: string) => resolveExamDate(t, null, today)?.day;
    expect(shown('YKS', '2026-10-16')).toBe('2027-06-19');
    // Both YKS days (TYT, then AYT/YDT) still count down to "today".
    expect(shown('YKS', '2027-06-19')).toBe('2027-06-19');
    expect(shown('YKS', '2027-06-20')).toBe('2027-06-19');
    expect(shown('YKS', '2027-06-21')).toBe('2028-06-17');
    expect(examDaysLeft(resolveExamDate('YKS', null, '2027-06-21')!, '2027-06-21')).toBe(362);
    expect(shown('YKS', '2028-06-19')).toBe('2029-06-16');
    expect(shown('LGS', '2027-06-13')).toBe('2027-06-13');
    expect(shown('LGS', '2027-06-14')).toBe('2028-06-11');
    expect(shown('KPSS', '2028-09-04')).toBe('2030-09-01');
    // After the last built-in date: that one stays (the home screen says it has passed).
    expect(shown('YKS', '2029-06-18')).toBe('2029-06-16');
    expect(examDaysLeft(resolveExamDate('YKS', null, '2029-06-18')!, '2029-06-18')).toBeLessThan(0);
    // The student's own date stays, also once passed.
    expect(resolveExamDate('YKS', '2027-06-26', '2027-07-01')?.day).toBe('2027-06-26');
  });

  it('counts whole Istanbul days; 0 on the exam day, negative afterwards', () => {
    expect(daysUntil('2027-06-19', '2026-10-04')).toBe(258);
    expect(daysUntil('2027-06-19', '2027-06-18')).toBe(1);
    expect(daysUntil('2027-06-19', '2027-06-19')).toBe(0);
    expect(daysUntil('2027-06-19', '2027-06-20')).toBe(-1);
  });

  it('the countdown says "today" on every exam day: YKS also on its AYT/YDT day', () => {
    const yks = EXAM_DATES.YKS[0];
    expect(examDaysLeft(yks, '2027-06-18')).toBe(1);
    expect(examDaysLeft(yks, '2027-06-19')).toBe(0);
    expect(examDaysLeft(yks, '2027-06-20')).toBe(0);
    expect(examDaysLeft(yks, '2027-06-21')).toBe(-2);
    // One-day exams (LGS, KPSS, a date without a length) are over the next day.
    expect(examDaysLeft(EXAM_DATES.LGS[0], '2027-06-14')).toBe(-1);
    expect(examDaysLeft({ day: '2027-03-01' }, '2027-03-02')).toBe(-1);
    // A YKS date the student enters keeps the two days.
    expect(examDaysLeft(resolveExamDate('YKS', '2027-06-26', TODAY)!, '2027-06-27')).toBe(0);
  });

  it('a date set by the student overrides the estimate', () => {
    expect(resolveExamDate('YKS', null, TODAY)).toEqual({ day: '2027-06-19', estimated: true, custom: false, days: 2 });
    expect(resolveExamDate('YKS', '2027-06-26', TODAY)).toEqual({
      day: '2027-06-26',
      estimated: false,
      custom: true,
      days: 2,
    });
    expect(resolveExamDate('DIGER', null, TODAY)).toBeNull();
    expect(resolveExamDate('DIGER', '2027-03-01', TODAY)?.custom).toBe(true);
    expect(resolveExamDate('LGS', '2027-06-20', TODAY)?.days).toBeUndefined();
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
