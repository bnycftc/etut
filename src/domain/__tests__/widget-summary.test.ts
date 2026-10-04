import { addDays, dayStartMs, type DayKey } from '../istanbul-day';
import { DEFAULT_POMODORO, upcomingPhaseChanges } from '../pomodoro';
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
  it('idle: today now, then a fresh day at each of the next two midnights', () => {
    const lookup = savedTotalsLookup(
      [saved('2026-10-05', 10, 60), saved('2026-10-06', 10, 60), saved(TODAY, 8, 30)],
      DAYS,
    );
    const entries = widgetTimeline({ now: NOW, savedTotal: lookup, active: null, goalMinutes: 60 });
    expect(entries.map((e) => e.at)).toEqual([NOW, midnight(TODAY, 1), midnight(TODAY, 2)]);
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
});
