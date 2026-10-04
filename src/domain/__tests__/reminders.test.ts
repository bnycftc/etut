import { dayStartMs } from '../istanbul-day';
import { DEFAULT_POMODORO } from '../pomodoro';
import {
  DAILY_DAYS_AHEAD,
  DEFAULT_REMINDER_PREFS,
  diffNotifications,
  EXAM_REMINDER_HOUR,
  MAX_PLANNED,
  normalizeReminderPrefs,
  notificationSignature,
  planNotifications,
  POMODORO_CHANGES_AHEAD,
  type ReminderInput,
  type ReminderPrefs,
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
    expect(count('daily')).toBe(DAILY_DAYS_AHEAD - 1); // today skipped: a session runs
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

  it('every day at the chosen Istanbul time, starting today', () => {
    const plan = planNotifications(input({ prefs }));
    expect(plan).toHaveLength(DAILY_DAYS_AHEAD);
    expect(plan[0]).toEqual({ id: 'etut:daily:2026-10-04', at: evening('2026-10-04'), kind: 'daily' });
    expect(plan[1].at).toBe(evening('2026-10-05'));
  });

  it('skips today once the student has studied or a session runs', () => {
    expect(planNotifications(input({ prefs, studiedToday: true }))[0].id).toBe('etut:daily:2026-10-05');
    const active = startSession('s', 'fizik', NOW);
    expect(planNotifications(input({ prefs, active }))[0].id).toBe('etut:daily:2026-10-05');
  });

  it('after today\'s time has passed, starts tomorrow', () => {
    const plan = planNotifications(input({ prefs, now: evening('2026-10-04') + MIN }));
    expect(plan[0].id).toBe('etut:daily:2026-10-05');
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
