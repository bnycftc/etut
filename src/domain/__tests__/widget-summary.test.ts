import { addDays, dayStartMs, type DayKey, istanbulDayKey } from '../istanbul-day';
import { DEFAULT_POMODORO, upcomingPhaseChanges } from '../pomodoro';
import { computeStreak } from '../streak';
import { type CompletedSession, elapsedMs, pauseSession, startSession } from '../timer';
import { MAX_WIDGET_ENTRIES, PHASE_CHANGES_AHEAD, savedTotalsLookup, widgetTimeline } from '../widget-summary';

const HOUR = 3_600_000;
const MIN = 60_000;
// Wednesday 7 Oct 2026, 12:00 Istanbul.
const NOW = Date.parse('2026-10-07T09:00:00Z');
const TODAY = '2026-10-07';
const midnight = (day: DayKey, plus: number) => dayStartMs(addDays(day, plus));

function saved(day: DayKey, hour: number, minutes: number): CompletedSession {
  const startedAt = dayStartMs(day) + hour * HOUR;
  return {
    id: `${day}-${hour}`,
    subjectId: 'fizik',
    topicId: null,
    startedAt,
    endedAt: startedAt + minutes * MIN,
    pauses: [],
    durationMs: minutes * MIN,
    source: 'timer',
  };
}

const DAYS = ['2026-10-04', '2026-10-05', '2026-10-06', TODAY, '2026-10-08', '2026-10-09'];

describe('widgetTimeline', () => {
  it('idle: today now, then a fresh day at each of the next four midnights', () => {
    const lookup = savedTotalsLookup(
      [saved('2026-10-05', 10, 60), saved('2026-10-06', 10, 60), saved(TODAY, 8, 30)],
      DAYS,
    );
    const entries = widgetTimeline({ now: NOW, savedTotal: lookup, active: null, goalMinutes: 60 });
    expect(entries.map((e) => e.at)).toEqual([
      NOW,
      midnight(TODAY, 1),
      midnight(TODAY, 2),
      midnight(TODAY, 3),
      midnight(TODAY, 4),
    ]);
    expect(entries[0]).toMatchObject({
      day: TODAY,
      todayMs: 30 * MIN,
      counting: false,
      goalMet: false,
      goalRatio: 0.5,
      goalReachedAt: null,
      // Monday and Tuesday met, today still open.
      streakDays: 2,
    });
    // Thursday 00:00: Wednesday was missed — the week's rest day keeps the streak.
    expect(entries[1]).toMatchObject({ day: '2026-10-08', todayMs: 0, streakDays: 2 });
  });

  it('app not opened for days: the widget never shows a stale streak, its last entry is right for good', () => {
    // Every weekday as "today" (the rest day rule depends on where the week starts), with a long
    // streak and today either met or still open.
    for (let offset = 0; offset < 7; offset++) {
      for (const todayMinutes of [0, 30, 90]) {
        const today = addDays(TODAY, offset);
        const now = dayStartMs(today) + 12 * HOUR;
        const sessions = [...Array(12).keys()].map((i) => saved(addDays(today, -1 - i), 10, 90));
        if (todayMinutes > 0) sessions.push(saved(today, 8, todayMinutes));
        const days = [...Array(60).keys()].map((i) => addDays(today, i - 20));
        const lookup = savedTotalsLookup(sessions, days);
        const entries = widgetTimeline({ now, savedTotal: lookup, active: null, goalMinutes: 60 });
        expect(entries.length).toBeLessThanOrEqual(MAX_WIDGET_ENTRIES);
        // The student does nothing for 30 days: at every moment the entry in effect shows the real streak.
        for (let t = now; t < now + 30 * 24 * HOUR; t += 6 * HOUR) {
          const shown = [...entries].reverse().find((e) => e.at <= t)!;
          const day = istanbulDayKey(t);
          expect({ t: day, streak: shown.streakDays }).toEqual({
            t: day,
            streak: computeStreak(lookup, day, 60).current,
          });
          expect(shown.day === day || shown === entries[entries.length - 1]).toBe(true);
        }
        expect(entries[entries.length - 1]).toMatchObject({ streakDays: 0, todayMs: 0, goalMet: false, counting: false });
      }
    }
  });

  it('without a goal there is no streak or ratio', () => {
    const entries = widgetTimeline({ now: NOW, savedTotal: () => 0, active: null, goalMinutes: null });
    expect(entries[0]).toMatchObject({ goalMinutes: null, goalRatio: 0, streakDays: null, goalMet: false });
  });

  it('running stopwatch: counts live and adds the moment the goal is reached', () => {
    const active = startSession('a', 'fizik', NOW - 20 * MIN);
    const entries = widgetTimeline({
      now: NOW,
      savedTotal: savedTotalsLookup([saved(TODAY, 8, 30)], DAYS),
      active,
      goalMinutes: 60,
    });
    expect(entries[0]).toMatchObject({ at: NOW, todayMs: 50 * MIN, counting: true, goalReachedAt: NOW + 10 * MIN });
    // The widget draws the clock from at − todayMs.
    expect(entries[0].at - entries[0].todayMs).toBe(NOW - 50 * MIN);
    expect(entries[1]).toMatchObject({ at: NOW + 10 * MIN, todayMs: 60 * MIN, goalMet: true, streakDays: 1 });
    // After midnight the running session counts towards the new day from 00:00.
    const next = entries.find((e) => e.at === midnight(TODAY, 1));
    expect(next).toMatchObject({ day: '2026-10-08', todayMs: 0, counting: true });
  });

  it('a paused session does not count', () => {
    const active = pauseSession(startSession('a', 'fizik', NOW - 20 * MIN), NOW - 5 * MIN);
    const [first] = widgetTimeline({ now: NOW, savedTotal: () => 0, active, goalMinutes: 60 });
    expect(first).toMatchObject({ todayMs: 15 * MIN, counting: false, goalReachedAt: null });
  });

  it('pomodoro: study time stops during breaks and grows again after them', () => {
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    const entries = widgetTimeline({ now: NOW, savedTotal: () => 0, active, goalMinutes: 45 });
    const byAt = new Map(entries.map((e) => [e.at, e]));
    expect(byAt.get(NOW)).toMatchObject({ counting: true, todayMs: 0 });
    expect(byAt.get(NOW + 25 * MIN)).toMatchObject({ counting: false, todayMs: 25 * MIN });
    expect(byAt.get(NOW + 30 * MIN)).toMatchObject({ counting: true, todayMs: 25 * MIN });
    // 45 min of study is reached 20 min into the second block.
    expect(byAt.get(NOW + 50 * MIN)).toMatchObject({ todayMs: 45 * MIN, goalMet: true });
    expect(entries.length).toBeLessThanOrEqual(MAX_WIDGET_ENTRIES);
    const times = entries.map((e) => e.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('pomodoro all day with the app closed: exact while covered, never more than studied after', () => {
    const start = dayStartMs(TODAY) + 8 * HOUR; // 08:00 Istanbul
    const active = startSession('p', 'fizik', start, { pomodoro: DEFAULT_POMODORO });
    const entries = widgetTimeline({ now: start, savedTotal: () => 0, active, goalMinutes: null });
    expect(entries.length).toBeLessThanOrEqual(MAX_WIDGET_ENTRIES);
    // The two midnights are never dropped.
    expect(entries.map((e) => e.at)).toEqual(expect.arrayContaining([midnight(TODAY, 1), midnight(TODAY, 2)]));

    // What the widget shows at `t`: the entry in effect, counting on from its `at` if `counting`.
    const shown = (t: number) => {
      const e = [...entries].reverse().find((x) => x.at <= t)!;
      return e.todayMs + (e.counting ? t - e.at : 0);
    };
    const changes = upcomingPhaseChanges(active, start, PHASE_CHANGES_AHEAD);
    const coveredUntil = changes[changes.length - 1].at;
    // 34 changes ≈ 9 h: the widget is exact until 17:10 …
    expect(coveredUntil - start).toBe(550 * MIN);
    for (let t = start; t < midnight(TODAY, 1); t += 5 * MIN) {
      const studied = elapsedMs(active, t);
      if (t <= coveredUntil) expect(shown(t)).toBe(studied);
      // … and then stops counting instead of counting the breaks as study.
      else expect(shown(t)).toBeLessThanOrEqual(studied);
    }
    expect(shown(dayStartMs(TODAY) + 18 * HOUR)).toBe(elapsedMs(active, coveredUntil));
    // A new day starts from zero.
    expect(shown(midnight(TODAY, 1) + HOUR)).toBe(0);
  });

  it('long phases: every change before the last midnight fits, and the last entry still never over-counts', () => {
    // 120/30/60 with a long break every 2 blocks: fewer than 34 changes until the second midnight.
    const config = { workMin: 120, shortBreakMin: 30, longBreakMin: 60, longEvery: 2 };
    const start = Date.parse('2026-10-05T00:00:00Z');
    const active = startSession('p', 'fizik', start, { pomodoro: config });
    const entries = widgetTimeline({ now: start, savedTotal: () => 0, active, goalMinutes: null });
    const last = entries[entries.length - 1];
    // The timeline ends at the second midnight, and a break follows later: the widget keeps that
    // entry for good, so it must not count.
    expect(upcomingPhaseChanges(active, start, PHASE_CHANGES_AHEAD).some((c) => c.at > last.at)).toBe(true);
    expect(last.counting).toBe(false);
    const shown = (t: number) => {
      const e = [...entries].reverse().find((x) => x.at <= t)!;
      return e.todayMs + (e.counting ? t - e.at : 0);
    };
    // Never more than the running session has on that day, hours after the timeline ends too.
    for (let t = start; t < last.at + 12 * HOUR; t += 5 * MIN) {
      const day = dayStartMs(istanbulDayKey(t));
      const studiedToday = elapsedMs(active, t) - elapsedMs(active, Math.max(start, day));
      expect(shown(t)).toBeLessThanOrEqual(studiedToday);
    }
  });
});

describe('widgetTimeline: exam countdown', () => {
  const exam = { examType: 'YKS' as const, day: '2027-06-19' };
  // 7 Oct 2026 → 19 Jun 2027.
  const LEFT_TODAY = 255;
  const leftOn = (day: DayKey) => LEFT_TODAY - Math.round((dayStartMs(day) - dayStartMs(TODAY)) / (24 * HOUR));

  it('idle: one less day at every midnight, for a month, and no number once it can not be sure', () => {
    const entries = widgetTimeline({ now: NOW, savedTotal: () => 0, active: null, goalMinutes: 60, exam });
    expect(entries.length).toBeLessThanOrEqual(MAX_WIDGET_ENTRIES);
    expect(entries[0].countdown).toEqual({ examType: 'YKS', daysLeft: LEFT_TODAY });
    // At every moment of the next 40 days the entry in effect shows the right number, or none.
    let looksShown = 0;
    for (let t = NOW; t < NOW + 40 * 24 * HOUR; t += 3 * HOUR) {
      const shown = [...entries].reverse().find((e) => e.at <= t)!;
      if (shown.countdown) {
        expect(shown.countdown.daysLeft).toBe(leftOn(istanbulDayKey(t)));
        looksShown++;
      }
    }
    // Shown the rest of today (4 looks of 3 h) and the 29 whole days up to the 30th midnight; from
    // that last entry on, which stays in effect for good, it is gone.
    expect(looksShown).toBe(4 + 29 * 8);
    expect(entries[entries.length - 1].countdown).toBeNull();
    // The streak still settles exactly as without a date.
    expect(entries[entries.length - 1]).toMatchObject({ streakDays: 0, todayMs: 0 });
  });

  it('exam day says 0, after it there is no countdown', () => {
    const near = { examType: 'LGS' as const, day: '2026-10-08' };
    const entries = widgetTimeline({ now: NOW, savedTotal: () => 0, active: null, goalMinutes: null, exam: near });
    expect(entries[0].countdown).toEqual({ examType: 'LGS', daysLeft: 1 });
    expect(entries.find((e) => e.at === midnight(TODAY, 1))?.countdown).toEqual({ examType: 'LGS', daysLeft: 0 });
    expect(entries.find((e) => e.at === midnight(TODAY, 2))?.countdown).toBeNull();
    // A passed date: no countdown and the usual short idle timeline.
    const passed = widgetTimeline({
      now: NOW,
      savedTotal: () => 0,
      active: null,
      goalMinutes: null,
      exam: { examType: 'YKS', day: '2026-06-20' },
    });
    expect(passed.every((e) => !e.countdown)).toBe(true);
    expect(passed).toHaveLength(5);
  });

  it('without a date nothing changes', () => {
    const entries = widgetTimeline({ now: NOW, savedTotal: () => 0, active: null, goalMinutes: 60, exam: null });
    expect(entries).toHaveLength(5);
    expect(entries.every((e) => !e.countdown)).toBe(true);
  });

  it('running pomodoro: the budget still holds; the number is right while the next midnight is covered', () => {
    const start = dayStartMs(TODAY) + 8 * HOUR;
    const active = startSession('p', 'fizik', start, { pomodoro: DEFAULT_POMODORO });
    const entries = widgetTimeline({ now: start, savedTotal: () => 0, active, goalMinutes: 60, exam });
    expect(entries.length).toBeLessThanOrEqual(MAX_WIDGET_ENTRIES);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const nextAt = entries[i + 1]?.at ?? Number.POSITIVE_INFINITY;
      if (nextAt <= dayStartMs(addDays(e.day, 1))) expect(e.countdown?.daysLeft).toBe(leftOn(e.day));
      else expect(e.countdown).toBeNull();
    }
    // After the first midnight it says one day less.
    expect(entries.find((e) => e.at === midnight(TODAY, 1))?.countdown?.daysLeft).toBe(LEFT_TODAY - 1);
  });
});
