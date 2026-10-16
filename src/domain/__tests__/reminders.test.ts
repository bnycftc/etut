import { addDays, dayStartMs, istanbulDayKey, istanbulTimeOfDay, istanbulWeekday } from '../istanbul-day';
import { DEFAULT_POMODORO } from '../pomodoro';
import {
  DAILY_SKIPPED_WEEKS_AHEAD,
  DEFAULT_REMINDER_PREFS,
  diffNotifications,
  effectiveReminderPrefs,
  EXAM_REMINDER_HOUR,
  MAX_PLANNED,
  normalizeReminderPrefs,
  notificationSignature,
  type PlannedNotification,
  planNotifications,
  POMODORO_CHANGES_AHEAD,
  type ReminderInput,
  type ReminderPrefs,
  remindersAfterConfirm,
  runningStretchStart,
} from '../reminders';
import { finishSession, onAppBackground, onAppForeground, pauseSession, resumeSession, startSession } from '../timer';

const HOUR = 3_600_000;
const MIN = 60_000;
// Sunday 4 Oct 2026, 10:00 Istanbul.
const NOW = Date.parse('2026-10-04T07:00:00Z');

const OFF: ReminderPrefs = {
  longSession: { enabled: false, hours: 3 },
  pomodoro: { enabled: false },
  daily: { enabled: false, hour: 20, minute: 0 },
  examAnalysis: { enabled: false },
};

function input(overrides: Partial<ReminderInput>): ReminderInput {
  return { now: NOW, prefs: OFF, active: null, studiedToday: false, pendingExams: [], ...overrides };
}

describe('reminder preferences', () => {
  it('defaults: daily reminder off, the others on, 3 hours', () => {
    expect(normalizeReminderPrefs(undefined)).toEqual(DEFAULT_REMINDER_PREFS);
    expect(DEFAULT_REMINDER_PREFS.daily.enabled).toBe(false);
    expect(DEFAULT_REMINDER_PREFS.longSession).toEqual({ enabled: true, hours: 3 });
  });

  it('clamps and repairs stored values', () => {
    expect(
      normalizeReminderPrefs({
        longSession: { enabled: false, hours: 40 },
        daily: { enabled: true, hour: 25, minute: 37 },
        pomodoro: 'x',
      }),
    ).toEqual({
      longSession: { enabled: false, hours: 8 },
      pomodoro: { enabled: true },
      daily: { enabled: true, hour: 23, minute: 30 },
      examAnalysis: { enabled: true },
    });
  });

  it('nothing is in force before the student confirmed reminders once (permission granted or not)', () => {
    // E.g. Android 12 grants the permission at install time; "Tüm verileri sil" keeps it.
    const unconfirmed = effectiveReminderPrefs(DEFAULT_REMINDER_PREFS, false);
    expect(unconfirmed).toEqual({ ...OFF, longSession: { enabled: false, hours: 3 } });
    const active = startSession('s', 'fizik', NOW - 4 * HOUR, { pomodoro: DEFAULT_POMODORO });
    expect(
      planNotifications(
        input({ prefs: unconfirmed, active, pendingExams: [{ id: 'e', createdAt: NOW - HOUR }] }),
      ),
    ).toEqual([]);
    // Once confirmed, the stored choices apply unchanged.
    expect(effectiveReminderPrefs(DEFAULT_REMINDER_PREFS, true)).toBe(DEFAULT_REMINDER_PREFS);
  });

  it('confirming turns on only the reminder the student turned on, nothing else with it', () => {
    // First confirmation: the defaults on paper do not come on with the daily reminder.
    expect(remindersAfterConfirm(DEFAULT_REMINDER_PREFS, false, 'daily')).toEqual({
      ...OFF,
      daily: { enabled: true, hour: 20, minute: 0 },
    });
    // Only the permission asked for: nothing comes on.
    expect(remindersAfterConfirm(DEFAULT_REMINDER_PREFS, false, null)).toEqual(OFF);
    // Already confirmed: the student's own choices stay, the requested one is added.
    const mine = { ...OFF, examAnalysis: { enabled: true } };
    expect(remindersAfterConfirm(mine, true, 'pomodoro')).toEqual({ ...mine, pomodoro: { enabled: true } });
    expect(remindersAfterConfirm(mine, true, null)).toBe(mine);
  });
});

describe('long session ("Hâlâ çalışıyor musun?")', () => {
  const prefs = { ...OFF, longSession: { enabled: true, hours: 3 } };

  it('fires once, 3 hours into an uninterrupted running stretch', () => {
    const active = startSession('s', 'fizik', NOW);
    const plan = planNotifications(input({ prefs, active, now: NOW + HOUR }));
    expect(plan).toEqual([{ id: `etut:long:s:${NOW}`, at: NOW + 3 * HOUR, kind: 'long_session', hours: 3 }]);
    // Same id and time later on: nothing to reschedule.
    expect(planNotifications(input({ prefs, active, now: NOW + 2 * HOUR }))).toEqual(plan);
  });

  it('a manual pause cancels it; resuming starts a new stretch', () => {
    let active = pauseSession(startSession('s', 'fizik', NOW), NOW + HOUR);
    expect(planNotifications(input({ prefs, active, now: NOW + HOUR }))).toEqual([]);
    active = resumeSession(active, NOW + 2 * HOUR);
    expect(runningStretchStart(active)).toBe(NOW + 2 * HOUR);
    expect(planNotifications(input({ prefs, active, now: NOW + 2 * HOUR }))[0].at).toBe(NOW + 5 * HOUR);
  });

  it('time away from the app does not reset the stretch', () => {
    let active = onAppBackground(startSession('s', 'fizik', NOW), NOW + HOUR);
    active = onAppForeground(active, NOW + 2 * HOUR);
    expect(planNotifications(input({ prefs, active, now: NOW + 2 * HOUR }))[0].at).toBe(NOW + 3 * HOUR);
  });

  it('no reminder once the threshold has passed, none without a session', () => {
    const active = startSession('s', 'fizik', NOW);
    expect(planNotifications(input({ prefs, active, now: NOW + 4 * HOUR }))).toEqual([]);
    expect(planNotifications(input({ prefs }))).toEqual([]);
  });
});

describe('pomodoro phase ends', () => {
  const prefs = { ...OFF, pomodoro: { enabled: true } };

  it('schedules the next phase changes of a running pomodoro', () => {
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    const plan = planNotifications(input({ prefs, active, now: NOW + MIN }));
    expect(plan.slice(0, 8).map((n) => (n.at - NOW) / MIN)).toEqual([25, 30, 55, 60, 85, 90, 115, 130]);
    expect(plan[0]).toMatchObject({ kind: 'pomodoro', ended: 'work', next: 'short_break' });
    expect(plan[6]).toMatchObject({ ended: 'work', next: 'long_break' });
  });

  it('a phone locked for hours keeps getting them (≈ 10 h with 25/5/15)', () => {
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    const plan = planNotifications(input({ prefs, active, now: NOW + MIN }));
    expect(plan).toHaveLength(POMODORO_CHANGES_AHEAD);
    // 40 changes = 5 cycles of 130 min.
    expect(plan[plan.length - 1].at - NOW).toBe(650 * MIN);
  });

  it('planned from a later moment, the reminders start from there (renewed on each sync)', () => {
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    const plan = planNotifications(input({ prefs, active, now: NOW + 140 * MIN }));
    expect(plan).toHaveLength(POMODORO_CHANGES_AHEAD);
    expect(plan[0].at).toBe(NOW + 155 * MIN);
  });

  it('room for everything: pomodoro, the daily reminders, the long session and two exam days', () => {
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    const plan = planNotifications(
      input({
        prefs: { ...DEFAULT_REMINDER_PREFS, daily: { enabled: true, hour: 23, minute: 0 } },
        active,
        now: NOW + MIN,
        pendingExams: [
          { id: 'y', createdAt: NOW - 24 * HOUR },
          { id: 't', createdAt: NOW },
        ],
      }),
    );
    const count = (kind: string) => plan.filter((n) => n.kind === kind).length;
    expect(count('pomodoro')).toBe(POMODORO_CHANGES_AHEAD);
    // Today skipped (a session runs): 6 repeating + the skipped weekday's single ones.
    expect(count('daily')).toBe(6 + DAILY_SKIPPED_WEEKS_AHEAD);
    expect(count('long_session')).toBe(1);
    expect(count('exam_analysis')).toBe(2);
    expect(plan.length).toBeLessThanOrEqual(MAX_PLANNED);
  });

  it('nothing while paused, after finishing, or for the stopwatch', () => {
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    expect(planNotifications(input({ prefs, active: pauseSession(active, NOW + MIN), now: NOW + MIN }))).toEqual([]);
    expect(planNotifications(input({ prefs, active: startSession('x', 'fizik', NOW) }))).toEqual([]);
    finishSession(active, NOW + MIN);
    expect(planNotifications(input({ prefs, active: null }))).toEqual([]);
  });
});

describe('daily reminder', () => {
  const prefs = { ...OFF, daily: { enabled: true, hour: 20, minute: 30 } };
  const evening = (day: string) => dayStartMs(day) + 20 * HOUR + 30 * MIN;
  const DAY = 24 * HOUR;
  const TODAY = '2026-10-04'; // a Sunday
  const SUNDAY = 6;

  /**
   * How many daily reminders arrive on each Istanbul day of the `days` days from `TODAY` if the
   * app is never opened again: a repeating one comes back every 7 days by itself.
   */
  function deliveries(plan: PlannedNotification[], days: number): Map<string, number> {
    const end = dayStartMs(addDays(TODAY, days));
    const out = new Map<string, number>();
    for (const n of plan) {
      if (n.kind !== 'daily') continue;
      for (let at = n.at; at < end; at += 7 * DAY) {
        expect(istanbulTimeOfDay(at)).toEqual({ hours: 20, minutes: 30 });
        const day = istanbulDayKey(at);
        out.set(day, (out.get(day) ?? 0) + 1);
        if (n.repeats !== 'weekly') break;
      }
    }
    return out;
  }

  it('one repeating reminder per weekday at the chosen Istanbul time, the first today', () => {
    const plan = planNotifications(input({ prefs }));
    expect(plan[0]).toEqual({ id: 'etut:daily:weekly:6', at: evening(TODAY), kind: 'daily', repeats: 'weekly' });
    expect(plan.map((n) => n.id)).toEqual([6, 0, 1, 2, 3, 4, 5].map((w) => `etut:daily:weekly:${w}`));
    expect(plan.map((n) => n.at)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => evening(addDays(TODAY, i))));
  });

  it('keeps coming every day without the app being opened: day 11 and months later', () => {
    const got = deliveries(planNotifications(input({ prefs })), 120);
    expect(got.get(addDays(TODAY, 11))).toBe(1);
    for (let i = 0; i < 120; i++) expect(got.get(addDays(TODAY, i))).toBe(1);
  });

  it('studied today: today\'s reminder is left out, tomorrow\'s and the later ones still come', () => {
    for (const studied of [{ studiedToday: true }, { active: startSession('s', 'fizik', NOW) }]) {
      const plan = planNotifications(input({ prefs, ...studied }));
      expect(plan).toHaveLength(6 + DAILY_SKIPPED_WEEKS_AHEAD);
      const got = deliveries(plan, 120);
      expect(got.has(TODAY)).toBe(false);
      expect(got.get(addDays(TODAY, 1))).toBe(1);
      // Never opened again: every day of the next weeks (day 11 included).
      const covered = 7 * DAILY_SKIPPED_WEEKS_AHEAD + 6;
      for (let i = 1; i <= covered; i++) expect(got.get(addDays(TODAY, i))).toBe(1);
      // The trade-off after that: only the skipped weekday falls silent, the others keep coming.
      for (let i = covered + 1; i < 120; i++) {
        const day = addDays(TODAY, i);
        expect(got.get(day)).toBe(istanbulWeekday(day) === SUNDAY ? undefined : 1);
      }
    }
  });

  it('the next opening of the app gives the skipped weekday its repeating reminder back', () => {
    const skipped = planNotifications(input({ prefs, studiedToday: true }));
    const scheduled = skipped.map((n) => ({ id: n.id, signature: notificationSignature(n) }));
    const singles = [1, 2, 3, 4].map((w) => `etut:daily:${addDays(TODAY, 7 * w)}`);
    const sunday = { id: 'etut:daily:weekly:6', kind: 'daily', repeats: 'weekly' };
    // Tomorrow morning: the six other weekdays stay as they are.
    expect(diffNotifications(scheduled, planNotifications(input({ prefs, now: NOW + DAY })))).toEqual({
      cancel: singles,
      schedule: [{ ...sunday, at: evening(addDays(TODAY, 7)) }],
    });
    // Or later today, once its time has passed (studied or not).
    const tonight = planNotifications(input({ prefs, studiedToday: true, now: evening(TODAY) + MIN }));
    expect(diffNotifications(scheduled, tonight)).toEqual({
      cancel: singles,
      schedule: [{ ...sunday, at: evening(addDays(TODAY, 7)) }],
    });
  });

  it('after today\'s time has passed, the first is tomorrow; studying today no longer matters', () => {
    const later = evening(TODAY) + MIN;
    const plan = planNotifications(input({ prefs, now: later }));
    expect(plan).toHaveLength(7);
    expect(plan[0]).toMatchObject({ id: 'etut:daily:weekly:0', at: evening(addDays(TODAY, 1)) });
    expect(plan[6]).toMatchObject({ id: 'etut:daily:weekly:6', at: evening(addDays(TODAY, 7)) });
    expect(planNotifications(input({ prefs, now: later, studiedToday: true }))).toEqual(plan);
  });

  it('a new time moves every weekday; off plans nothing', () => {
    const before = planNotifications(input({ prefs }));
    const scheduled = before.map((n) => ({ id: n.id, signature: notificationSignature(n) }));
    const moved = planNotifications(input({ prefs: { ...OFF, daily: { enabled: true, hour: 7, minute: 0 } } }));
    expect(diffNotifications(scheduled, moved).cancel).toHaveLength(7);
    expect(diffNotifications(scheduled, planNotifications(input({}))).cancel).toHaveLength(7);
  });
});

describe('exam analysis reminder', () => {
  const prefs = { ...OFF, examAnalysis: { enabled: true } };
  const nextDayAt = dayStartMs('2026-10-05') + EXAM_REMINDER_HOUR * HOUR;

  it('one reminder the next day at 18:00; exams of the same day share it', () => {
    const plan = planNotifications(
      input({ prefs, pendingExams: [{ id: 'e1', createdAt: NOW - HOUR }, { id: 'e2', createdAt: NOW }] }),
    );
    expect(plan).toEqual([{ id: 'etut:exam:2026-10-05', at: nextDayAt, kind: 'exam_analysis', count: 2 }]);
  });

  it('gone once analysed (no longer pending) or after its time', () => {
    expect(planNotifications(input({ prefs, pendingExams: [] }))).toEqual([]);
    expect(
      planNotifications(input({ prefs, now: nextDayAt + MIN, pendingExams: [{ id: 'e1', createdAt: NOW }] })),
    ).toEqual([]);
  });

  it('can be turned off', () => {
    expect(planNotifications(input({ pendingExams: [{ id: 'e1', createdAt: NOW }] }))).toEqual([]);
  });
});

describe('plan limits', () => {
  it('stays under the iOS limit of 64 pending notifications, sorted by time', () => {
    const prefs = DEFAULT_REMINDER_PREFS;
    const active = startSession('p', 'fizik', NOW, { pomodoro: DEFAULT_POMODORO });
    const pendingExams = Array.from({ length: 80 }, (_, i) => ({ id: `e${i}`, createdAt: NOW - i * 24 * HOUR + 60 * 24 * HOUR }));
    const plan = planNotifications(
      input({ prefs: { ...prefs, daily: { enabled: true, hour: 9, minute: 0 } }, active, pendingExams }),
    );
    expect(plan.length).toBeLessThanOrEqual(MAX_PLANNED);
    const times = plan.map((n) => n.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(plan.map((n) => n.id)).size).toBe(plan.length);
  });
});

describe('diffNotifications', () => {
  const a = { id: 'etut:daily:2026-10-04', at: NOW + HOUR, kind: 'daily' as const };
  const b = { id: 'etut:daily:2026-10-05', at: NOW + 25 * HOUR, kind: 'daily' as const };

  it('schedules what is missing and keeps what is unchanged', () => {
    expect(diffNotifications([], [a, b])).toEqual({ cancel: [], schedule: [a, b] });
    expect(
      diffNotifications([{ id: a.id, signature: notificationSignature(a) }], [a, b]),
    ).toEqual({ cancel: [], schedule: [b] });
  });

  it('cancels what is no longer wanted or has changed, never twice the same id', () => {
    const moved = { ...a, at: NOW + 2 * HOUR };
    expect(
      diffNotifications(
        [
          { id: a.id, signature: notificationSignature(a) },
          { id: b.id, signature: notificationSignature(b) },
        ],
        [moved],
      ),
    ).toEqual({ cancel: [a.id, b.id], schedule: [moved] });
    // A duplicate is cancelled and scheduled once again.
    const sig = notificationSignature(a);
    expect(
      diffNotifications([{ id: a.id, signature: sig }, { id: a.id, signature: sig }], [a]),
    ).toEqual({ cancel: [a.id], schedule: [a] });
  });

  it('leaves notifications of other origins alone', () => {
    expect(diffNotifications([{ id: 'other', signature: null }], [])).toEqual({ cancel: [], schedule: [] });
  });
});
