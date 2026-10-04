import { activeSpan, dailyTotals } from '../daily-totals';
import {
  DEFAULT_POMODORO,
  normalizePomodoroConfig,
  phaseAt,
  pomodoroBreaks,
  pomodoroStatus,
} from '../pomodoro';
import {
  type ActiveSession,
  creditAway,
  elapsedMs,
  finishSession,
  isActiveSession,
  onAppBackground,
  onAppForeground,
  onAppLaunch,
  pauseSession,
  resumeSession,
  skipBreak,
  startSession,
  toActiveSession,
} from '../timer';

const T0 = Date.parse('2026-10-04T07:00:00Z');
const min = (n: number) => n * 60_000;
const at = (m: number) => T0 + min(m);

function pomodoro(): ActiveSession {
  return startSession('p1', 'fizik', T0, { pomodoro: DEFAULT_POMODORO, topicId: 'tyt.fizik.x' });
}

describe('pomodoro schedule (25/5, long 15 every 4)', () => {
  it('starts with a work block and switches to a short break at 25 min', () => {
    const s = pomodoro();
    expect(pomodoroStatus(s, at(0))).toMatchObject({ phase: 'work', block: 1, remainingMs: min(25) });
    expect(pomodoroStatus(s, at(24.5))).toMatchObject({ phase: 'work', remainingMs: min(0.5) });
    expect(pomodoroStatus(s, at(25))).toMatchObject({
      phase: 'short_break',
      block: 1,
      remainingMs: min(5),
      completedBlocks: 1,
    });
    expect(pomodoroStatus(s, at(30))).toMatchObject({ phase: 'work', block: 2, completedBlocks: 1 });
  });

  it('gives a long break after every 4th block, then starts a new set', () => {
    const s = pomodoro();
    // 4 × 25 work + 3 × 5 short breaks = 115 min
    expect(pomodoroStatus(s, at(114))).toMatchObject({ phase: 'work', block: 4, blockInSet: 4 });
    expect(pomodoroStatus(s, at(115))).toMatchObject({ phase: 'long_break', remainingMs: min(15) });
    expect(pomodoroStatus(s, at(130))).toMatchObject({ phase: 'work', block: 5, blockInSet: 1 });
  });

  it('break time does not count as study time', () => {
    const s = pomodoro();
    expect(elapsedMs(s, at(25))).toBe(min(25));
    expect(elapsedMs(s, at(30))).toBe(min(25));
    expect(elapsedMs(s, at(60))).toBe(min(50));
    expect(elapsedMs(s, at(130))).toBe(min(100));
  });

  it('is derived from timestamps only: the same answer whenever it is asked', () => {
    const s = pomodoro();
    // No events in between (app closed for two hours): still 4 blocks + breaks.
    expect(elapsedMs(s, at(145))).toBe(min(115));
    expect(pomodoroBreaks(s, at(145))).toEqual([
      { start: at(25), end: at(30) },
      { start: at(55), end: at(60) },
      { start: at(85), end: at(90) },
      { start: at(115), end: at(130) },
    ]);
  });

  it('a manual pause freezes the pomodoro clock', () => {
    let s = pomodoro();
    s = pauseSession(s, at(10));
    expect(pomodoroStatus(s, at(20))).toMatchObject({ phase: 'work', remainingMs: min(15) });
    s = resumeSession(s, at(30));
    // Work resumes with 15 min left: break from 45 to 50.
    expect(pomodoroStatus(s, at(45))).toMatchObject({ phase: 'short_break', remainingMs: min(5) });
    expect(pomodoroStatus(s, at(50))).toMatchObject({ phase: 'work', block: 2 });
    expect(elapsedMs(s, at(50))).toBe(min(25));
  });

  it('a break that spans a manual pause is split around it', () => {
    let s = pomodoro();
    s = pauseSession(s, at(27));
    s = resumeSession(s, at(40));
    expect(pomodoroBreaks(s, at(50))).toEqual([
      { start: at(25), end: at(27) },
      { start: at(40), end: at(43) },
    ]);
    expect(elapsedMs(s, at(50))).toBe(min(25 + 7));
  });

  it('"molayı geç" ends the break now and starts the next block', () => {
    let s = pomodoro();
    s = skipBreak(s, at(27));
    expect(pomodoroStatus(s, at(27))).toMatchObject({ phase: 'work', block: 2, remainingMs: min(25) });
    expect(pomodoroStatus(s, at(52))).toMatchObject({ phase: 'short_break', block: 2 });
    expect(elapsedMs(s, at(52))).toBe(min(50));
  });

  it('skipping does nothing during a work block, while paused or without pomodoro', () => {
    const s = pomodoro();
    expect(skipBreak(s, at(10))).toBe(s);
    const paused = pauseSession(s, at(26));
    expect(skipBreak(paused, at(27))).toBe(paused);
    const plain = startSession('x', 'fizik', T0);
    expect(skipBreak(plain, at(27))).toBe(plain);
  });

  it('being away only during a break asks nothing and adds no pause', () => {
    let s = onAppBackground(pomodoro(), at(25.5));
    s = onAppForeground(s, at(29.5));
    expect(s.pendingAway).toBeNull();
    expect(s.pauses).toEqual([]);
    expect(elapsedMs(s, at(30))).toBe(min(25));
  });

  it('being away during a work block follows the normal away rule', () => {
    let s = onAppBackground(pomodoro(), at(20));
    s = onAppForeground(s, at(40));
    expect(s.pendingAway).toEqual({ start: at(20), end: at(40) });
    // 0–20 studied; 20–40 away (includes the 25–30 break); 40–45 studied.
    expect(elapsedMs(s, at(45))).toBe(min(25));
    // "Çalışıyordum": the away time counts again, the pomodoro break still does not.
    expect(elapsedMs(creditAway(s), at(45))).toBe(min(40));
  });

  it('the cold-start rule also recognises an absence that falls inside a break', () => {
    const s = { ...pomodoro(), lastSeenAt: at(26) };
    const launched = onAppLaunch(s, at(29));
    expect(launched.pendingAway).toBeNull();
  });

  it('finishing stores the breaks as pauses so totals stay correct', () => {
    const done = finishSession(pomodoro(), at(32));
    expect(done.durationMs).toBe(min(27));
    expect(done.pauses).toEqual([{ start: at(25), end: at(30), kind: 'break' }]);
    expect(done.topicId).toBe('tyt.fizik.x');
    expect(done.source).toBe('timer');
    const [day] = dailyTotals([done], ['2026-10-04']);
    expect(day.totalMs).toBe(min(27));
  });

  it('the running span includes the breaks, also across Istanbul midnight', () => {
    const start = Date.parse('2026-10-04T20:50:00Z'); // 23:50 Istanbul
    const s = startSession('p2', 'kimya', start, { pomodoro: DEFAULT_POMODORO });
    const now = start + min(40); // 00:30 next day
    const totals = dailyTotals([activeSpan(s, now)], ['2026-10-04', '2026-10-05']);
    // 23:50–00:15 work (10 + 15), 00:15–00:20 break, 00:20–00:30 work (10).
    expect(totals.map((t) => t.totalMs)).toEqual([min(10), min(25)]);
  });
});

describe('pomodoro config', () => {
  it('clamps and rounds settings into range', () => {
    expect(normalizePomodoroConfig({ workMin: 0, shortBreakMin: 2.6, longBreakMin: 999, longEvery: 1 })).toEqual({
      workMin: 5,
      shortBreakMin: 3,
      longBreakMin: 60,
      longEvery: 2,
    });
  });

  it('custom 50/10, long 20 every 2', () => {
    const c = { workMin: 50, shortBreakMin: 10, longBreakMin: 20, longEvery: 2 };
    expect(phaseAt(c, min(55))).toMatchObject({ phase: 'short_break' });
    expect(phaseAt(c, min(115))).toMatchObject({ phase: 'long_break', end: min(130) });
    expect(phaseAt(c, min(130))).toMatchObject({ phase: 'work', blockIndex: 2 });
  });
});

describe('stored sessions from older versions', () => {
  it('a session without topic and pomodoro fields is accepted and completed with nulls', () => {
    const old = {
      id: 'a',
      subjectId: 'fizik',
      startedAt: T0,
      pauses: [],
      backgroundedAt: null,
      pendingAway: null,
      lastSeenAt: T0,
    };
    expect(isActiveSession(old)).toBe(true);
    expect(toActiveSession(old)).toEqual({ ...old, topicId: null, pomodoro: null });
  });

  it('rejects a malformed pomodoro state', () => {
    expect(toActiveSession({ ...pomodoro(), pomodoro: { config: { workMin: '25' }, skips: [] } })).toBeNull();
  });
});
