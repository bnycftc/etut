import { compareWithPast, weeklySummary } from '../compare';
import { dailyTotals, pastDayTotals, type SessionSpan } from '../daily-totals';
import type { DayKey } from '../istanbul-day';
import { computeStreak, goalRatio, weekStartOf } from '../streak';

const min = (n: number) => n * 60_000;
const at = (iso: string) => Date.parse(iso);

/** 2026-10-05 is a Monday. */
function totalsOf(map: Record<DayKey, number>) {
  return (day: DayKey) => map[day] ?? 0;
}

describe('weekStartOf', () => {
  it('weeks start on Monday (Istanbul)', () => {
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28');
  });
});

describe('computeStreak (goal 60 min)', () => {
  const GOAL = 60;

  it('counts consecutive met days; an unfinished today does not break it', () => {
    const totals = totalsOf({ '2026-10-05': min(60), '2026-10-06': min(90), '2026-10-07': min(61) });
    expect(computeStreak(totals, '2026-10-08', GOAL)).toEqual({
      current: 3,
      todayMet: false,
      restUsedThisWeek: false,
    });
    const withToday = totalsOf({
      '2026-10-05': min(60),
      '2026-10-06': min(90),
      '2026-10-07': min(61),
      '2026-10-08': min(60),
    });
    expect(computeStreak(withToday, '2026-10-08', GOAL)).toMatchObject({ current: 4, todayMet: true });
  });

  it('59 minutes is a miss', () => {
    const totals = totalsOf({ '2026-10-06': min(59), '2026-10-07': min(60) });
    expect(computeStreak(totals, '2026-10-08', GOAL).current).toBe(1);
  });

  it('one missed day per week is a rest day: kept but not counted', () => {
    const totals = totalsOf({
      '2026-10-05': min(60),
      // 2026-10-06 missed → rest day
      '2026-10-07': min(60),
      '2026-10-08': min(60),
    });
    expect(computeStreak(totals, '2026-10-08', GOAL)).toEqual({
      current: 3,
      todayMet: true,
      restUsedThisWeek: true,
    });
  });

  it('a second missed day in the same week ends the streak', () => {
    const totals = totalsOf({
      '2026-10-05': min(60),
      '2026-10-07': min(60),
      '2026-10-09': min(60),
      '2026-10-10': min(60),
    });
    // Back from Sat 10th: Fri met, Thu 8th missed (rest), Wed met, Tue 6th missed → end.
    expect(computeStreak(totals, '2026-10-10', GOAL).current).toBe(3);
  });

  it('rest days of different weeks each count once', () => {
    const totals = totalsOf({
      '2026-09-28': min(60),
      '2026-09-29': min(60),
      // Sun 2026-10-04 missed (week of 28 Sep), Mon 2026-10-05 missed (week of 5 Oct)
      '2026-10-03': min(60),
      '2026-10-06': min(60),
    });
    // Back from Tue 6th: Mon miss (rest W41), Sun miss (rest W40), Sat met, Fri 2nd miss → end.
    expect(computeStreak(totals, '2026-10-06', GOAL)).toMatchObject({ current: 2, restUsedThisWeek: true });
  });

  it('a miss at the start of the streak does not use up the rest day', () => {
    const totals = totalsOf({ '2026-10-07': min(60), '2026-10-08': min(60) });
    expect(computeStreak(totals, '2026-10-08', GOAL)).toEqual({
      current: 2,
      todayMet: true,
      restUsedThisWeek: false,
    });
  });

  it('on a Monday, yesterday belongs to the previous week', () => {
    const totals = totalsOf({ '2026-10-03': min(60) });
    // Sun 4th missed (rest of the previous week) → streak 1, this week's rest still free.
    expect(computeStreak(totals, '2026-10-05', GOAL)).toEqual({
      current: 1,
      todayMet: false,
      restUsedThisWeek: false,
    });
  });

  it('study across Istanbul midnight counts towards both days', () => {
    const spans: SessionSpan[] = [
      {
        subjectId: 'fizik',
        startedAt: at('2026-10-06T20:00:00Z'), // Tue 23:00 Istanbul
        endedAt: at('2026-10-06T22:00:00Z'), // Wed 01:00
        pauses: [],
      },
    ];
    const days = ['2026-10-06', '2026-10-07'];
    const map = Object.fromEntries(dailyTotals(spans, days).map((t) => [t.day, t.totalMs]));
    expect(computeStreak(totalsOf(map), '2026-10-07', GOAL)).toMatchObject({ current: 2 });
    // With a 61-minute goal both halves fall short.
    expect(computeStreak(totalsOf(map), '2026-10-07', 61).current).toBe(0);
  });

  it('a running session across two midnights counts towards every day it touched', () => {
    const running: SessionSpan = {
      subjectId: 'fizik',
      startedAt: at('2026-10-05T20:00:00Z'), // Mon 23:00 Istanbul
      endedAt: at('2026-10-07T07:00:00Z'), // Wed 10:00 (now)
      pauses: [{ start: at('2026-10-05T22:00:00Z'), end: at('2026-10-06T19:00:00Z'), kind: 'manual' }],
    };
    const past = pastDayTotals([running], '2026-10-07');
    expect(Object.fromEntries(past)).toEqual({
      '2026-10-05': min(60), // Mon 23:00–24:00
      '2026-10-06': min(60 + 120), // Tue 00:00–01:00 and 22:00–24:00
    });
    const totals = (day: DayKey) => (day === '2026-10-07' ? min(600) : (past.get(day) ?? 0));
    expect(computeStreak(totals, '2026-10-07', 60)).toMatchObject({ current: 3, todayMet: true });
  });

  it('time added afterwards ("elle") counts for the streak', () => {
    const spans: SessionSpan[] = [
      { subjectId: 'fizik', startedAt: at('2026-10-06T07:00:00Z'), endedAt: at('2026-10-06T08:00:00Z'), pauses: [], source: 'manual' },
    ];
    const map = Object.fromEntries(dailyTotals(spans, ['2026-10-06']).map((t) => [t.day, t.totalMs]));
    expect(computeStreak(totalsOf(map), '2026-10-07', 60).current).toBe(1);
  });

  it('goal ratio is capped at 1', () => {
    expect(goalRatio(min(30), 60)).toBe(0.5);
    expect(goalRatio(min(300), 60)).toBe(1);
  });
});

describe('compareWithPast', () => {
  const span = (startIso: string, endIso: string, subjectId = 'matematik'): SessionSpan => ({
    subjectId,
    startedAt: at(startIso),
    endedAt: at(endIso),
    pauses: [],
  });

  it('compares today with yesterday up to the same clock time', () => {
    const spans = [
      span('2026-10-06T07:00:00Z', '2026-10-06T09:00:00Z'), // Tue 10:00–12:00
      span('2026-10-07T07:00:00Z', '2026-10-07T07:30:00Z'), // Wed 10:00–10:30
    ];
    const now = at('2026-10-07T08:00:00Z'); // Wed 11:00
    const c = compareWithPast(spans, now);
    expect(c.today).toBe(min(30));
    expect(c.yesterdaySameTime).toBe(min(60));
  });

  it('compares this week with last week up to the same weekday and time', () => {
    const spans = [
      span('2026-09-28T06:00:00Z', '2026-09-28T08:00:00Z'), // last Mon, 2 h
      span('2026-09-30T06:00:00Z', '2026-09-30T09:00:00Z'), // last Wed 09:00–12:00
      span('2026-10-02T06:00:00Z', '2026-10-02T10:00:00Z'), // last Fri (after the cut-off)
      span('2026-10-05T06:00:00Z', '2026-10-05T07:00:00Z'), // this Mon, 1 h
      span('2026-10-04T20:00:00Z', '2026-10-04T22:00:00Z'), // Sun 23:00 → Mon 01:00
    ];
    const now = at('2026-10-07T07:00:00Z'); // Wed 10:00
    const c = compareWithPast(spans, now);
    expect(c.thisWeek).toBe(min(60 + 60)); // Mon 1 h + Mon 00:00–01:00
    expect(c.lastWeekSameTime).toBe(min(120 + 60)); // Mon 2 h + Wed 09:00–10:00
  });
});

describe('weeklySummary', () => {
  it('totals, subject split, longest session, manual time and goal days', () => {
    const spans: SessionSpan[] = [
      { subjectId: 'fizik', startedAt: at('2026-10-05T06:00:00Z'), endedAt: at('2026-10-05T08:00:00Z'), pauses: [] },
      {
        subjectId: 'kimya',
        startedAt: at('2026-10-06T06:00:00Z'),
        endedAt: at('2026-10-06T09:00:00Z'),
        pauses: [{ start: at('2026-10-06T07:00:00Z'), end: at('2026-10-06T08:00:00Z'), kind: 'manual' }],
      },
      {
        subjectId: 'fizik',
        startedAt: at('2026-10-07T06:00:00Z'),
        endedAt: at('2026-10-07T07:30:00Z'),
        pauses: [],
        source: 'manual',
      },
      // Previous week: ignored.
      { subjectId: 'tarih', startedAt: at('2026-10-04T06:00:00Z'), endedAt: at('2026-10-04T12:00:00Z'), pauses: [] },
    ];
    const w = weeklySummary(spans, '2026-10-05', 100);
    expect(w.days).toHaveLength(7);
    expect(w.totalMs).toBe(min(120 + 120 + 90));
    expect(w.manualMs).toBe(min(90));
    expect(w.bySubject).toEqual([
      { subjectId: 'fizik', ms: min(210) },
      { subjectId: 'kimya', ms: min(120) },
    ]);
    expect(w.longest).toEqual({ subjectId: 'fizik', ms: min(120), startedAt: at('2026-10-05T06:00:00Z'), manual: false });
    expect(w.goalDays).toBe(2);
    expect(w.activeDays).toBe(3);
    expect(weeklySummary(spans, '2026-10-05', null).goalDays).toBeNull();
  });
});
