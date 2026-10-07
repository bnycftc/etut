import {
  COUNT_UP_SPAN_MS,
  LIVE_ACTIVITY_MAX_MS,
  LIVE_ACTIVITY_REFRESH_MS,
  liveActivityAction,
  liveTimerView,
} from '../live-timer';
import { DEFAULT_POMODORO, upcomingPhaseChanges } from '../pomodoro';
import {
  creditAway,
  elapsedMs,
  onAppBackground,
  onAppForeground,
  pauseSession,
  resumeSession,
  skipBreak,
  startSession,
} from '../timer';

const T0 = Date.parse('2026-10-04T07:00:00Z');
const min = (n: number) => n * 60_000;
const at = (m: number) => T0 + min(m);
const HOUR = 3_600_000;

describe('liveTimerView: stopwatch', () => {
  it('counts up from the moment that gives the in-app elapsed time', () => {
    const s = startSession('s1', 'fizik', T0);
    const v = liveTimerView(s, at(10));
    expect(v).toMatchObject({ mode: 'stopwatch', paused: false, phase: null, next: null, staleAt: null });
    expect(v.clock).toEqual({ from: T0, to: T0 + COUNT_UP_SPAN_MS, countsDown: false, pausedAt: null });
    // The system clock shows now − from = the elapsed study time.
    expect(at(10) - v.clock.from).toBe(elapsedMs(s, at(10)));
  });

  it('does not change between two calls while running (nothing to send)', () => {
    const s = startSession('s1', 'fizik', T0);
    expect(liveTimerView(s, at(1))).toEqual(liveTimerView(s, at(55)));
  });

  it('a pause freezes the clock at the elapsed time and stays stable while paused', () => {
    let s = startSession('s1', 'fizik', T0);
    s = pauseSession(s, at(20));
    const v = liveTimerView(s, at(25));
    expect(v.paused).toBe(true);
    expect(v.clock.pausedAt).toBe(at(20));
    // Shown value = pausedAt − from = 20 min.
    expect(v.clock.pausedAt! - v.clock.from).toBe(min(20));
    expect(liveTimerView(s, at(40))).toEqual(v);
  });

  it('after resume the start moves forward by the pause length', () => {
    let s = startSession('s1', 'fizik', T0);
    s = pauseSession(s, at(20));
    s = resumeSession(s, at(30));
    const v = liveTimerView(s, at(31));
    expect(v.clock.from).toBe(T0 + min(10));
    expect(at(31) - v.clock.from).toBe(min(21));
  });

  it('an automatic away break moves the start, "Çalışıyordum" moves it back', () => {
    let s = startSession('s1', 'fizik', T0);
    s = onAppBackground(s, at(5));
    s = onAppForeground(s, at(15));
    expect(liveTimerView(s, at(16)).clock.from).toBe(T0 + min(10));
    s = creditAway(s);
    expect(liveTimerView(s, at(16)).clock.from).toBe(T0);
  });
});

describe('liveTimerView: pomodoro', () => {
  const start = () => startSession('p1', 'fizik', T0, { pomodoro: DEFAULT_POMODORO });

  it('counts down the work block and announces the short break after it', () => {
    const v = liveTimerView(start(), at(10));
    expect(v).toMatchObject({ mode: 'pomodoro', phase: 'work', blockInSet: 1, paused: false });
    expect(v.clock).toEqual({ from: T0, to: at(25), countsDown: true, pausedAt: null });
    expect(v.next).toEqual({
      phase: 'short_break',
      blockInSet: 1,
      clock: { from: at(25), to: at(30), countsDown: true, pausedAt: null },
    });
    expect(v.staleAt).toBe(at(25));
    expect(liveTimerView(start(), at(24))).toEqual(v);
  });

  it('during the break it counts down the break; the next work block follows', () => {
    const v = liveTimerView(start(), at(27));
    expect(v.phase).toBe('short_break');
    expect(v.clock).toMatchObject({ from: at(25), to: at(30) });
    expect(v.next).toMatchObject({ phase: 'work', blockInSet: 2, clock: { from: at(30), to: at(55) } });
  });

  it('a manual pause freezes the remaining time and drops the next phase', () => {
    let s = start();
    s = pauseSession(s, at(10));
    const v = liveTimerView(s, at(18));
    expect(v.paused).toBe(true);
    expect(v.clock.to - v.clock.pausedAt!).toBe(min(15));
    expect(v.next).toBeNull();
    expect(v.staleAt).toBeNull();
    // Resumed 10 min later: the block now ends 10 min later.
    s = resumeSession(s, at(20));
    expect(liveTimerView(s, at(21)).clock.to).toBe(at(35));
  });

  it('"Molayı geç" starts the next block at once', () => {
    let s = start();
    s = skipBreak(s, at(26));
    const v = liveTimerView(s, at(26));
    expect(v).toMatchObject({ phase: 'work', blockInSet: 2 });
    expect(v.clock.to).toBe(at(51));
  });

  it('every range is ordered (the system rejects from > to)', () => {
    let s = start();
    for (const m of [0, 3, 25, 29.9, 30, 114, 115, 130, 400]) {
      const v = liveTimerView(s, at(m));
      expect(v.clock.from).toBeLessThanOrEqual(v.clock.to);
      if (v.next) expect(v.next.clock.from).toBeLessThanOrEqual(v.next.clock.to);
    }
    s = pauseSession(s, at(401));
    const p = liveTimerView(s, at(500));
    expect(p.clock.from).toBeLessThanOrEqual(p.clock.to);
  });
});

describe('upcomingPhaseChanges', () => {
  it('lists the next phase changes in wall time', () => {
    const s = startSession('p1', 'fizik', T0, { pomodoro: DEFAULT_POMODORO });
    const changes = upcomingPhaseChanges(s, at(1), 9);
    expect(changes.map((c) => (c.at - T0) / 60_000)).toEqual([25, 30, 55, 60, 85, 90, 115, 130, 155]);
    expect(changes[6]).toMatchObject({ ended: 'work', next: 'long_break', nextEndsAt: at(130) });
    expect(changes[7]).toMatchObject({ ended: 'long_break', next: 'work', nextBlockInSet: 1 });
  });

  it('is stable while running and empty while paused or without pomodoro', () => {
    const s = startSession('p1', 'fizik', T0, { pomodoro: DEFAULT_POMODORO });
    expect(upcomingPhaseChanges(s, at(2), 3)).toEqual(upcomingPhaseChanges(s, at(20), 3));
    expect(upcomingPhaseChanges(pauseSession(s, at(5)), at(6), 3)).toEqual([]);
    expect(upcomingPhaseChanges(startSession('x', 'fizik', T0), at(1), 3)).toEqual([]);
  });
});

describe('liveActivityAction', () => {
  const record = { sessionId: 's1', startedAt: T0 };

  it('starts one for a running session that has none', () => {
    expect(liveActivityAction({ sessionId: 's1', instances: 0, record: null, now: T0 })).toBe('start');
    expect(
      liveActivityAction({ sessionId: 's2', instances: 0, record, now: T0 + HOUR }),
    ).toBe('start');
  });

  it('does not bring back one the student removed before the 8-hour limit', () => {
    // Seen gone early: remembered as removed …
    expect(liveActivityAction({ sessionId: 's1', instances: 0, record, now: T0 + 2 * HOUR })).toBe('dismissed');
    // … and never started again for this session, also after the 8-hour limit.
    const dismissed = { ...record, dismissed: true };
    for (const h of [2, 7.99, 8, 9, 20]) {
      expect(liveActivityAction({ sessionId: 's1', instances: 0, record: dismissed, now: T0 + h * HOUR })).toBe('none');
    }
    // A new session gets one again.
    expect(liveActivityAction({ sessionId: 's2', instances: 0, record: dismissed, now: T0 + HOUR })).toBe('start');
  });

  it('after a phone restart (gone before this launch saw it) it is started once more', () => {
    const fresh = { sessionId: 's1', instances: 0, record, now: T0 + 2 * HOUR, seenThisLaunch: false };
    expect(liveActivityAction(fresh)).toBe('retry');
    // The one started then is marked: gone again (a second restart or a removal) = removed.
    expect(liveActivityAction({ ...fresh, record: { ...record, retried: true } })).toBe('dismissed');
    // Seen alive in this launch, then gone: the student removed it.
    expect(liveActivityAction({ ...fresh, seenThisLaunch: true })).toBe('dismissed');
    // Removed earlier stays removed after a restart too.
    expect(liveActivityAction({ ...fresh, record: { ...record, dismissed: true } })).toBe('none');
    // After the 8-hour limit a new one starts as before.
    expect(liveActivityAction({ ...fresh, now: T0 + LIVE_ACTIVITY_MAX_MS })).toBe('start');
  });

  it('starts a new one after the system ended it at the 8-hour limit', () => {
    expect(
      liveActivityAction({ sessionId: 's1', instances: 0, record, now: T0 + LIVE_ACTIVITY_MAX_MS }),
    ).toBe('start');
  });

  it('updates its own, refreshes an old one, replaces foreign or duplicate ones', () => {
    expect(liveActivityAction({ sessionId: 's1', instances: 1, record, now: T0 + HOUR })).toBe('update');
    expect(
      liveActivityAction({ sessionId: 's1', instances: 1, record, now: T0 + LIVE_ACTIVITY_REFRESH_MS }),
    ).toBe('restart');
    expect(liveActivityAction({ sessionId: 's2', instances: 1, record, now: T0 })).toBe('restart');
    expect(liveActivityAction({ sessionId: 's1', instances: 1, record: null, now: T0 })).toBe('restart');
    expect(liveActivityAction({ sessionId: 's1', instances: 2, record, now: T0 })).toBe('restart');
  });

  it('ends what is left once no session runs', () => {
    expect(liveActivityAction({ sessionId: null, instances: 1, record, now: T0 })).toBe('end');
    expect(liveActivityAction({ sessionId: null, instances: 0, record: null, now: T0 })).toBe('none');
  });
});
