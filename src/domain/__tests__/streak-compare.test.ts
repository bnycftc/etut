import { comparisonLine, compareWithPast, weeklySummary } from '../compare';
import { dailyTotals, pastDayTotals, type SessionSpan } from '../daily-totals';
import type { DayKey } from '../istanbul-day';
import {
  computeStreak,
  goalFromTomorrow,
  goalOfDay,
  goalRatio,
  normalizeGoalHistory,
  weekStartOf,
  withGoalChange,
} from '../streak';

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
    expect(computeStreak(totals, '2026-10-08', () => GOAL)).toEqual({
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
    expect(computeStreak(withToday, '2026-10-08', () => GOAL)).toMatchObject({ current: 4, todayMet: true });
  });

  it('59 minutes is a miss', () => {
    const totals = totalsOf({ '2026-10-06': min(59), '2026-10-07': min(60) });
    expect(computeStreak(totals, '2026-10-08', () => GOAL).current).toBe(1);
  });

  it('one missed day per week is a rest day: kept but not counted', () => {
    const totals = totalsOf({
      '2026-10-05': min(60),
      // 2026-10-06 missed → rest day
      '2026-10-07': min(60),
      '2026-10-08': min(60),
    });
    expect(computeStreak(totals, '2026-10-08', () => GOAL)).toEqual({
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
    expect(computeStreak(totals, '2026-10-10', () => GOAL).current).toBe(3);
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
    expect(computeStreak(totals, '2026-10-06', () => GOAL)).toMatchObject({ current: 2, restUsedThisWeek: true });
  });

  it('a miss at the start of the streak does not use up the rest day', () => {
    const totals = totalsOf({ '2026-10-07': min(60), '2026-10-08': min(60) });
    expect(computeStreak(totals, '2026-10-08', () => GOAL)).toEqual({
      current: 2,
      todayMet: true,
      restUsedThisWeek: false,
    });
  });

  it('on a Monday, yesterday belongs to the previous week', () => {
    const totals = totalsOf({ '2026-10-03': min(60) });
    // Sun 4th missed (rest of the previous week) → streak 1, this week's rest still free.
    expect(computeStreak(totals, '2026-10-05', () => GOAL)).toEqual({
      current: 1,
      todayMet: false,
      restUsedThisWeek: false,
    });
  });

  it('study across Istanbul midnight counts whole towards the day it started', () => {
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
    expect(map).toEqual({ '2026-10-06': min(120), '2026-10-07': 0 });
    // Tuesday met (all 2 h), Wednesday not over yet.
    expect(computeStreak(totalsOf(map), '2026-10-07', () => GOAL)).toMatchObject({ current: 1, todayMet: false });
    expect(computeStreak(totalsOf(map), '2026-10-07', () => 120).current).toBe(1);
    expect(computeStreak(totalsOf(map), '2026-10-07', () => 121).current).toBe(0);
  });

  it('a running session across two midnights counts whole towards the day it started', () => {
    const running: SessionSpan = {
      subjectId: 'fizik',
      startedAt: at('2026-10-05T20:00:00Z'), // Mon 23:00 Istanbul
      endedAt: at('2026-10-07T07:00:00Z'), // Wed 10:00 (now)
      pauses: [{ start: at('2026-10-05T22:00:00Z'), end: at('2026-10-06T19:00:00Z'), kind: 'manual' }],
    };
    const past = pastDayTotals([running], '2026-10-07');
    // Mon 23:00–Tue 01:00 and Tue 22:00–Wed 10:00, all on Monday.
    expect(Object.fromEntries(past)).toEqual({ '2026-10-05': min(120 + 720) });
    const totals = (day: DayKey) => (day === '2026-10-07' ? min(600) : (past.get(day) ?? 0));
    // Tuesday is the week's rest day between Monday and today.
    expect(computeStreak(totals, '2026-10-07', () => 60)).toMatchObject({
      current: 2,
      todayMet: true,
      restUsedThisWeek: true,
    });
  });

  it('time added afterwards ("elle") counts for the streak', () => {
    const spans: SessionSpan[] = [
      { subjectId: 'fizik', startedAt: at('2026-10-06T07:00:00Z'), endedAt: at('2026-10-06T08:00:00Z'), pauses: [], source: 'manual' },
    ];
    const map = Object.fromEntries(dailyTotals(spans, ['2026-10-06']).map((t) => [t.day, t.totalMs]));
    expect(computeStreak(totalsOf(map), '2026-10-07', () => 60).current).toBe(1);
  });

  it('goal ratio is capped at 1', () => {
    expect(goalRatio(min(30), 60)).toBe(0.5);
    expect(goalRatio(min(300), 60)).toBe(1);
  });
});

describe('goal history: each day is judged by the goal of that day', () => {
  // Mon 5 Oct to Thu 8 Oct 2026, 70 minutes a day.
  const totals = totalsOf({
    '2026-10-05': min(70),
    '2026-10-06': min(70),
    '2026-10-07': min(70),
    '2026-10-08': min(70),
  });

  it('raising the goal keeps the streak; lowering it does not add past days', () => {
    // 60 since Monday, raised to 120 today (Thursday): Mon–Wed met at 60, today not yet.
    const raised = goalOfDay(
      [
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-08', minutes: 120 },
      ],
      120,
      '2026-10-08',
    );
    expect(computeStreak(totals, '2026-10-08', raised)).toMatchObject({ current: 3, todayMet: false });
    // The old rule (today's goal for every day) lost it.
    expect(computeStreak(totals, '2026-10-08', () => 120).current).toBe(0);
    // 120 until Wednesday, lowered to 60 today: only today is met.
    const lowered = goalOfDay(
      [
        { from: '2026-10-05', minutes: 120 },
        { from: '2026-10-08', minutes: 60 },
      ],
      60,
      '2026-10-08',
    );
    expect(computeStreak(totals, '2026-10-08', lowered)).toMatchObject({ current: 1, todayMet: true });
  });

  it('goalOfDay: last change on or before the day; today on, the goal now; before the first, the first', () => {
    const history = [
      { from: '2026-09-01', minutes: 60 },
      { from: '2026-09-10', minutes: 90 },
      { from: '2026-09-20', minutes: 45 },
      { from: '2026-10-08', minutes: 180 },
    ];
    const of = goalOfDay(history, 180, '2026-10-08');
    expect(of('2026-08-01')).toBe(60);
    expect(of('2026-09-01')).toBe(60);
    expect(of('2026-09-09')).toBe(60);
    expect(of('2026-09-10')).toBe(90);
    expect(of('2026-09-19')).toBe(90);
    expect(of('2026-09-20')).toBe(45);
    expect(of('2026-10-07')).toBe(45);
    expect(of('2026-10-08')).toBe(180);
    expect(of('2026-10-09')).toBe(180);
    // No history (a goal from before it was kept): the goal now for every day.
    expect(goalOfDay([], 75, '2026-10-08')('2025-01-01')).toBe(75);
    // Today and later go by the goal now even if a stored change says otherwise.
    expect(goalOfDay([{ from: '2026-10-08', minutes: 30 }], 75, '2026-10-08')('2026-10-08')).toBe(75);
    expect(goalOfDay([{ from: '2026-10-09', minutes: 30 }], 75, '2026-10-08')('2026-10-07')).toBe(75);
  });

  it('withGoalChange: one entry per day, no entry for no change, off keeps the history', () => {
    // First goal ever (onboarding).
    expect(withGoalChange([], null, 60, '2026-10-05')).toEqual([{ from: '2026-10-05', minutes: 60 }]);
    // A goal from before the history was kept is written down from the day before.
    expect(withGoalChange([], 60, 120, '2026-10-08')).toEqual([
      { from: '2026-10-07', minutes: 60 },
      { from: '2026-10-08', minutes: 120 },
    ]);
    const h = [{ from: '2026-10-05', minutes: 60 }];
    expect(withGoalChange(h, 60, 60, '2026-10-08')).toBe(h);
    // Changed twice on one day: the last one counts for the day.
    const twice = withGoalChange(withGoalChange(h, 60, 90, '2026-10-08'), 90, 150, '2026-10-08');
    expect(twice).toEqual([
      { from: '2026-10-05', minutes: 60 },
      { from: '2026-10-08', minutes: 150 },
    ]);
    // Back to the goal in force before: no entry left for today.
    expect(withGoalChange(twice, 150, 60, '2026-10-08')).toEqual(h);
    // Off: nothing changes (the streak is only hidden) …
    expect(withGoalChange(h, 60, null, '2026-10-08')).toBe(h);
    expect(withGoalChange([], 60, null, '2026-10-08')).toEqual([{ from: '2026-10-07', minutes: 60 }]);
    // … and set again later, the days in between keep the last goal.
    const again = withGoalChange(h, null, 120, '2026-10-20');
    expect(again).toEqual([
      { from: '2026-10-05', minutes: 60 },
      { from: '2026-10-20', minutes: 120 },
    ]);
    expect(goalOfDay(again, 120, '2026-10-20')('2026-10-12')).toBe(60);
    expect(withGoalChange(h, null, 60, '2026-10-20')).toEqual(h);
  });

  describe('changing the goal today (V-03)', () => {
    // 60 since Monday; Mon–Thu 70 min each, so today (Thursday) is met at 60.
    const h = [{ from: '2026-10-05', minutes: 60 }];
    const today = '2026-10-08';

    it('a raise after today was met starts tomorrow: today stays met, the streak stays', () => {
      const raised = withGoalChange(h, 60, 120, today, min(70));
      expect(raised).toEqual([
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-09', minutes: 120 },
      ]);
      const of = goalOfDay(raised, 120, today);
      expect(of(today)).toBe(60);
      expect(of('2026-10-09')).toBe(120);
      expect(of('2026-10-07')).toBe(60);
      expect(computeStreak(totals, today, of)).toMatchObject({ current: 4, todayMet: true });
      // The goal setting says so (`tr.goal.startsTomorrow`).
      expect(goalFromTomorrow(raised, today)).toBe(120);
      expect(goalFromTomorrow(h, today)).toBeNull();
      // Tomorrow the new goal is today's, the day before keeps 60.
      const next = goalOfDay(raised, 120, '2026-10-09');
      expect([next('2026-10-08'), next('2026-10-09')]).toEqual([60, 120]);
      expect(goalFromTomorrow(raised, '2026-10-09')).toBeNull();
    });

    it('a goal set earlier today is kept for today when raised after meeting it', () => {
      // Lowered to 45 this morning, met, then raised to 90: today keeps 45, 90 from tomorrow.
      const lowered = withGoalChange(h, 60, 45, today, 0);
      const raised = withGoalChange(lowered, 45, 90, today, min(50));
      expect(raised).toEqual([
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-08', minutes: 45 },
        { from: '2026-10-09', minutes: 90 },
      ]);
      expect(goalOfDay(raised, 90, today)(today)).toBe(45);
    });

    it('a legacy goal (no history) raised after meeting it: written down, the raise from tomorrow', () => {
      const raised = withGoalChange([], 60, 120, today, min(70));
      expect(raised).toEqual([
        { from: '2026-10-07', minutes: 60 },
        { from: '2026-10-09', minutes: 120 },
      ]);
      expect(goalOfDay(raised, 120, today)(today)).toBe(60);
    });

    it('a raise before today is met applies today', () => {
      const raised = withGoalChange(h, 60, 120, today, min(59));
      expect(raised).toEqual([
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-08', minutes: 120 },
      ]);
      expect(goalOfDay(raised, 120, today)(today)).toBe(120);
      expect(goalFromTomorrow(raised, today)).toBeNull();
    });

    it('lowering applies today, also after today was met and while a raise waits for tomorrow', () => {
      expect(withGoalChange(h, 60, 30, today, min(70))).toEqual([
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-08', minutes: 30 },
      ]);
      const raised = withGoalChange(h, 60, 120, today, min(70));
      // Lowered below today's 60: today and on, no raise left waiting.
      const lowered = withGoalChange(raised, 120, 30, today, min(70));
      expect(lowered).toEqual([
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-08', minutes: 30 },
      ]);
      expect(goalFromTomorrow(lowered, today)).toBeNull();
      // Changed again to another raise: still from tomorrow; back to today's goal: nothing waits.
      expect(withGoalChange(raised, 120, 90, today, min(70))).toEqual([
        { from: '2026-10-05', minutes: 60 },
        { from: '2026-10-09', minutes: 90 },
      ]);
      expect(withGoalChange(raised, 120, 60, today, min(70))).toEqual(h);
    });
  });

  it('the goal cannot be lowered after the fact to lengthen the streak', () => {
    // 120 all along; Mon–Wed 70 min (missed). Lowering to 15 today only judges today by 15.
    const history = withGoalChange([{ from: '2026-10-01', minutes: 120 }], 120, 15, '2026-10-08');
    expect(computeStreak(totals, '2026-10-08', goalOfDay(history, 15, '2026-10-08')).current).toBe(1);
  });

  it('normalizeGoalHistory: day order, one entry per day, damaged entries dropped, limits kept', () => {
    expect(
      normalizeGoalHistory([
        { from: '2026-10-08', minutes: 2000 },
        { from: '2026-10-01', minutes: 5 },
        { from: '2026-02-30', minutes: 60 },
        { from: 'x', minutes: 60 },
        { from: '2026-10-03', minutes: 'lots' },
        null,
        { from: '2026-10-08', minutes: 90 },
      ]),
    ).toEqual([
      { from: '2026-10-01', minutes: 15 },
      { from: '2026-10-08', minutes: 90 },
    ]);
    expect(normalizeGoalHistory('nope')).toEqual([]);
    expect(normalizeGoalHistory(null)).toEqual([]);
  });

  it('weekly summary counts each day by its own goal', () => {
    const spans: SessionSpan[] = ['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => ({
      subjectId: 'fizik',
      startedAt: at(`${d}T06:00:00Z`),
      endedAt: at(`${d}T07:10:00Z`),
      pauses: [],
    }));
    const of = goalOfDay([{ from: '2026-10-05', minutes: 60 }], 120, '2026-10-07');
    expect(weeklySummary(spans, '2026-10-05', of).goalDays).toBe(2);
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
    // Mon 1 h; the Sunday session belongs to last week (the day it started), all 2 h of it.
    expect(c.thisWeek).toBe(min(60));
    expect(c.lastWeekSameTime).toBe(min(120 + 60)); // Mon 2 h + Wed 09:00–10:00
  });
});

describe('comparisonLine (home screen)', () => {
  const of = (yesterdaySameTime: number, lastWeekSameTime: number) =>
    comparisonLine({ today: min(10), yesterdaySameTime, thisWeek: min(10), lastWeekSameTime });

  it('no line while the past holds no study time (the first days)', () => {
    expect(of(0, 0)).toBeNull();
    // Less than a minute would read "0 dk".
    expect(of(59_999, 30_000)).toBeNull();
  });

  it('only the parts with study time', () => {
    expect(of(min(80), 0)).toEqual({ yesterday: min(80), lastWeek: null });
    expect(of(0, min(300))).toEqual({ yesterday: null, lastWeek: min(300) });
    expect(of(min(1), min(300))).toEqual({ yesterday: min(1), lastWeek: min(300) });
  });

  it('today, this week and a study-free yesterday never make a line on their own', () => {
    expect(comparisonLine({ today: min(90), yesterdaySameTime: 0, thisWeek: min(300), lastWeekSameTime: 0 })).toBeNull();
  });
});

describe('weeklySummary', () => {
  it('23:30–00:45 across Sunday midnight: 75 min in the week it started, every number the same', () => {
    const spans: SessionSpan[] = [
      // Sun 4 Oct 23:30 → Mon 5 Oct 00:45 Istanbul.
      { subjectId: 'fizik', startedAt: at('2026-10-04T20:30:00Z'), endedAt: at('2026-10-04T21:45:00Z'), pauses: [] },
    ];
    const last = weeklySummary(spans, '2026-09-28', () => 75);
    expect(last.totalMs).toBe(min(75));
    expect(last.days.find((d) => d.day === '2026-10-04')?.totalMs).toBe(min(75));
    expect(last.longest?.ms).toBe(min(75));
    expect(last.bySubject).toEqual([{ subjectId: 'fizik', ms: min(75) }]);
    expect(last.goalDays).toBe(1);
    const next = weeklySummary(spans, '2026-10-05', () => 75);
    expect([next.totalMs, next.activeDays, next.longest]).toEqual([0, 0, null]);
    // The streak sees the same 75 min on Sunday.
    const map = Object.fromEntries(dailyTotals(spans, ['2026-10-04', '2026-10-05']).map((t) => [t.day, t.totalMs]));
    expect(computeStreak(totalsOf(map), '2026-10-05', () => 75)).toMatchObject({ current: 1, todayMet: false });
  });

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
    const w = weeklySummary(spans, '2026-10-05', () => 100);
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
    // Monday and Tuesday both hold 2 hours: the earlier one is the best day.
    expect(w.bestDay).toEqual({ day: '2026-10-05', ms: min(120) });
    expect(w.averageActiveDayMs).toBe(min(110));
    expect(weeklySummary(spans, '2026-10-05', null).goalDays).toBeNull();
  });

  it('an empty week has no best day and a zero average', () => {
    const w = weeklySummary([], '2026-10-05', null);
    expect(w.bestDay).toBeNull();
    expect(w.averageActiveDayMs).toBe(0);
  });
});
