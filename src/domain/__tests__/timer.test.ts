import {
  type ActiveSession,
  BACKGROUND_TOLERANCE_MS,
  capStudyTime,
  creditAway,
  dismissAway,
  elapsedMs,
  finishQuestion,
  finishSession,
  intervalsTotal,
  isActiveSession,
  isPaused,
  LONG_SESSION_MS,
  markSeen,
  onAppBackground,
  onAppForeground,
  onAppLaunch,
  pauseSession,
  pendingAwayMs,
  resumeSession,
  startSession,
  workIntervals,
} from '../timer';

const T0 = Date.parse('2026-10-04T07:00:00Z');
const sec = (n: number) => n * 1000;
const min = (n: number) => n * 60_000;

function started(): ActiveSession {
  return startSession('s1', 'matematik', T0);
}

describe('elapsed time from timestamps', () => {
  it('is now − start without pauses', () => {
    expect(elapsedMs(started(), T0 + min(25))).toBe(min(25));
  });

  it('never goes negative when the clock is behind the start', () => {
    expect(elapsedMs(started(), T0 - min(5))).toBe(0);
  });

  it('subtracts closed pauses and freezes during an open pause', () => {
    let s = started();
    s = pauseSession(s, T0 + min(10));
    expect(isPaused(s)).toBe(true);
    expect(elapsedMs(s, T0 + min(10))).toBe(min(10));
    expect(elapsedMs(s, T0 + min(40))).toBe(min(10)); // still on break
    s = resumeSession(s, T0 + min(15));
    expect(isPaused(s)).toBe(false);
    expect(elapsedMs(s, T0 + min(20))).toBe(min(15));
  });

  it('pause and resume are idempotent', () => {
    let s = pauseSession(started(), T0 + min(1));
    expect(pauseSession(s, T0 + min(2))).toBe(s);
    s = resumeSession(s, T0 + min(3));
    expect(resumeSession(s, T0 + min(4))).toBe(s);
  });

  it('survives a restart: the persisted JSON gives the same result', () => {
    let s = pauseSession(started(), T0 + min(10));
    s = resumeSession(s, T0 + min(12));
    const restored: unknown = JSON.parse(JSON.stringify(s));
    expect(isActiveSession(restored)).toBe(true);
    if (isActiveSession(restored)) {
      expect(elapsedMs(restored, T0 + min(60))).toBe(elapsedMs(s, T0 + min(60)));
      expect(elapsedMs(restored, T0 + min(60))).toBe(min(58));
    }
  });

  it('workIntervals ignores overlapping and out-of-range pauses', () => {
    const intervals = workIntervals(
      T0,
      [
        { start: T0 - min(5), end: T0 + min(1), kind: 'manual' },
        { start: T0 + min(10), end: T0 + min(20), kind: 'manual' },
        { start: T0 + min(15), end: T0 + min(25), kind: 'away' },
        { start: T0 + min(50), end: null, kind: 'manual' },
      ],
      T0 + min(40),
    );
    expect(intervals).toEqual([
      { start: T0 + min(1), end: T0 + min(10) },
      { start: T0 + min(25), end: T0 + min(40) },
    ]);
  });
});

describe('finishSession', () => {
  it('closes an open pause and reports the study duration', () => {
    let s = pauseSession(started(), T0 + min(30));
    const done = finishSession(s, T0 + min(45));
    expect(done.durationMs).toBe(min(30));
    expect(done.endedAt).toBe(T0 + min(45));
    expect(done.pauses).toEqual([{ start: T0 + min(30), end: T0 + min(45), kind: 'manual' }]);
    s = started();
    expect(finishSession(s, T0 + min(5)).pauses).toEqual([]);
  });
});

describe('background tolerance rule', () => {
  it(`ignores leaving the app for up to ${BACKGROUND_TOLERANCE_MS / 1000} s`, () => {
    const bg = onAppBackground(started(), T0 + min(10));
    expect(bg.backgroundedAt).toBe(T0 + min(10));
    const back = onAppForeground(bg, T0 + min(10) + BACKGROUND_TOLERANCE_MS);
    expect(back.backgroundedAt).toBeNull();
    expect(back.pauses).toEqual([]);
    expect(back.pendingAway).toBeNull();
    expect(elapsedMs(back, T0 + min(11))).toBe(min(11));
  });

  it('turns a longer absence into an automatic break and asks once', () => {
    const away = { start: T0 + min(10), end: T0 + min(10) + sec(11) };
    const back = onAppForeground(onAppBackground(started(), away.start), away.end);
    expect(back.pendingAway).toEqual(away);
    expect(back.pauses).toEqual([{ ...away, kind: 'away' }]);
    expect(isPaused(back)).toBe(false); // keeps running after the student returns
    expect(elapsedMs(back, away.end + min(1))).toBe(min(11));
  });

  it('"Çalışıyordum, süreye ekle" credits the away interval back', () => {
    const back = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(40));
    const credited = creditAway(back);
    expect(credited.pendingAway).toBeNull();
    expect(credited.pauses).toEqual([]);
    expect(elapsedMs(credited, T0 + min(50))).toBe(min(50));
  });

  it('dismissing keeps the break', () => {
    const back = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(40));
    const kept = dismissAway(back);
    expect(kept.pendingAway).toBeNull();
    expect(elapsedMs(kept, T0 + min(50))).toBe(min(20));
    expect(creditAway(kept)).toBe(kept);
  });

  it('crediting removes only the matching automatic break', () => {
    let s = pauseSession(started(), T0 + min(5));
    s = resumeSession(s, T0 + min(8));
    s = onAppForeground(onAppBackground(s, T0 + min(20)), T0 + min(30));
    s = creditAway(s);
    expect(s.pauses).toEqual([{ start: T0 + min(5), end: T0 + min(8), kind: 'manual' }]);
  });

  it('does nothing when the timer was already on a manual break', () => {
    const paused = pauseSession(started(), T0 + min(5));
    expect(onAppBackground(paused, T0 + min(6))).toBe(paused);
    expect(onAppForeground(paused, T0 + min(60))).toBe(paused);
  });

  it('keeps the first background timestamp if the event repeats', () => {
    const bg = onAppBackground(started(), T0 + min(10));
    expect(onAppBackground(bg, T0 + min(11))).toBe(bg);
  });

  it('applies on cold start after the app was killed in the background', () => {
    const persisted: unknown = JSON.parse(
      JSON.stringify(onAppBackground(started(), T0 + min(10))),
    );
    expect(isActiveSession(persisted)).toBe(true);
    if (isActiveSession(persisted)) {
      const relaunched = onAppForeground(persisted, T0 + min(70));
      expect(relaunched.pendingAway).toEqual({ start: T0 + min(10), end: T0 + min(70) });
      expect(elapsedMs(relaunched, T0 + min(70))).toBe(min(10));
    }
  });

  it('on launch after dying in the foreground, the gap after the last heartbeat is away time', () => {
    let s = markSeen(started(), T0 + min(30));
    expect(s.lastSeenAt).toBe(T0 + min(30));
    const persisted: unknown = JSON.parse(JSON.stringify(s));
    expect(isActiveSession(persisted)).toBe(true);
    if (!isActiveSession(persisted)) return;
    s = onAppLaunch(persisted, T0 + min(600)); // force quit, reopened 9.5 h later
    expect(s.pendingAway).toEqual({ start: T0 + min(30), end: T0 + min(600) });
    expect(elapsedMs(s, T0 + min(600))).toBe(min(30));
    expect(elapsedMs(creditAway(s), T0 + min(600))).toBe(min(600));
  });

  it('on launch shortly after the last heartbeat, nothing changes', () => {
    const s = markSeen(started(), T0 + min(30));
    const launched = onAppLaunch(s, T0 + min(30) + sec(8));
    expect(launched.pauses).toEqual([]);
    expect(launched.pendingAway).toBeNull();
  });

  it('on launch, a recorded background event wins over the heartbeat', () => {
    let s = markSeen(started(), T0 + min(30));
    s = onAppBackground(s, T0 + min(31));
    expect(markSeen(s, T0 + min(32))).toBe(s); // no heartbeat while backgrounded
    const launched = onAppLaunch(s, T0 + min(90));
    expect(launched.pendingAway).toEqual({ start: T0 + min(31), end: T0 + min(90) });
  });

  it('on launch, a manually paused session is left alone', () => {
    const s = pauseSession(markSeen(started(), T0 + min(30)), T0 + min(31));
    expect(markSeen(s, T0 + min(32))).toBe(s);
    expect(onAppLaunch(s, T0 + min(600))).toBe(s);
    expect(elapsedMs(s, T0 + min(600))).toBe(min(31));
  });

  it('resume refreshes the heartbeat so a later crash does not reach back into the break', () => {
    let s = markSeen(started(), T0 + min(10));
    s = pauseSession(s, T0 + min(11));
    s = resumeSession(s, T0 + min(40));
    expect(s.lastSeenAt).toBe(T0 + min(40));
    const launched = onAppLaunch(s, T0 + min(100));
    expect(launched.pendingAway).toEqual({ start: T0 + min(40), end: T0 + min(100) });
  });

  it('treats a clock that went backwards as no absence', () => {
    const bg = onAppBackground(started(), T0 + min(10));
    const back = onAppForeground(bg, T0 + min(9));
    expect(back.pauses).toEqual([]);
    expect(back.backgroundedAt).toBeNull();
  });
});

describe('several absences before the student answers', () => {
  it('a second absence joins the first: one answer credits both', () => {
    let s = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(70)); // 1 h away
    s = markSeen(s, T0 + min(71)); // back for a minute, prompt not answered
    s = onAppForeground(onAppBackground(s, T0 + min(72)), T0 + min(132)); // 1 h away again
    expect(s.pendingAway).toEqual({ start: T0 + min(10), end: T0 + min(132) });
    expect(pendingAwayMs(s)).toBe(min(120));
    expect(elapsedMs(s, T0 + min(132))).toBe(min(12));
    const credited = creditAway(s);
    expect(credited.pauses).toEqual([]);
    expect(elapsedMs(credited, T0 + min(132))).toBe(min(132));
  });

  it('"mola kalsın" keeps both breaks; an absence after an answer starts a new prompt', () => {
    let s = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(40));
    s = onAppForeground(onAppBackground(s, T0 + min(41)), T0 + min(61));
    s = dismissAway(s);
    expect(elapsedMs(s, T0 + min(61))).toBe(min(11));
    s = onAppForeground(onAppBackground(s, T0 + min(70)), T0 + min(80));
    expect(s.pendingAway).toEqual({ start: T0 + min(70), end: T0 + min(80) });
    expect(pendingAwayMs(s)).toBe(min(10));
    // Crediting the new prompt leaves the answered breaks alone.
    expect(elapsedMs(creditAway(s), T0 + min(80))).toBe(min(80) - min(50));
  });

  it('a manual break between two absences is never credited', () => {
    let s = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(20));
    s = resumeSession(pauseSession(s, T0 + min(21)), T0 + min(31));
    s = onAppForeground(onAppBackground(s, T0 + min(32)), T0 + min(42));
    expect(pendingAwayMs(s)).toBe(min(20));
    expect(creditAway(s).pauses).toEqual([{ start: T0 + min(21), end: T0 + min(31), kind: 'manual' }]);
  });
});

describe('"Çalışmaya devam say" (away rule: count)', () => {
  it('time away counts as study and nothing is asked', () => {
    const back = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(70), 'count');
    expect(back.pauses).toEqual([]);
    expect(back.pendingAway).toBeNull();
    expect(back.backgroundedAt).toBeNull();
    expect(elapsedMs(back, T0 + min(70))).toBe(min(70));
  });

  it('also after the app died in the foreground', () => {
    const launched = onAppLaunch(markSeen(started(), T0 + min(30)), T0 + min(90), 'count');
    expect(launched.pendingAway).toBeNull();
    expect(elapsedMs(launched, T0 + min(90))).toBe(min(90));
  });

  it('the default stays "ask"', () => {
    const back = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(70));
    expect(back.pendingAway).not.toBeNull();
  });
});

describe('clock set back before the start', () => {
  it('finishing does not lose the session: it ends at the last heartbeat before the change', () => {
    // Started at 10:00 by a clock that was hours ahead; studied 40 min; the network fixes the
    // clock to 07:00 while the app is open.
    let s = markSeen(started(), T0 + min(40));
    s = markSeen(s, T0 - min(180)); // heartbeats after the change keep the last good reading
    expect(s.lastSeenAt).toBe(T0 + min(40));
    const done = finishSession(s, T0 - min(175));
    expect(done.endedAt).toBe(T0 + min(40));
    expect(done.durationMs).toBe(min(40));
  });

  it('also when the app went to the background and back after the change', () => {
    let s = markSeen(started(), T0 + min(25));
    s = onAppForeground(onAppBackground(s, T0 - min(100)), T0 - min(90));
    const done = finishSession(s, T0 - min(80));
    expect(done.durationMs).toBe(min(25));
  });

  it('keeps the breaks recorded before the change', () => {
    let s = resumeSession(pauseSession(markSeen(started(), T0 + min(5)), T0 + min(10)), T0 + min(20));
    s = markSeen(s, T0 + min(30));
    const done = finishSession(s, T0 - min(60));
    expect(done.endedAt).toBe(T0 + min(30));
    expect(done.durationMs).toBe(min(20));
  });

  it('a break taken after the change does not swallow the session', () => {
    let s = markSeen(started(), T0 + min(40));
    s = pauseSession(s, T0 - min(100)); // "Mola" with the clock behind the start
    expect(s.pauses).toEqual([{ start: T0 + min(40), end: null, kind: 'manual' }]);
    const done = finishSession(s, T0 - min(90));
    expect(done.durationMs).toBe(min(40));
  });

  it('two absences on both sides of the change are one span: one answer credits both', () => {
    let s = onAppForeground(onAppBackground(started(), T0 + min(60)), T0 + min(70));
    s = onAppForeground(onAppBackground(s, T0 + min(30)), T0 + min(40)); // clock set back meanwhile
    expect(s.pendingAway).toEqual({ start: T0 + min(30), end: T0 + min(70) });
    expect(pendingAwayMs(s)).toBe(min(20));
    expect(creditAway(s).pauses).toEqual([]);
  });

  it('a clock set back but still after the start behaves as before', () => {
    const s = markSeen(started(), T0 + min(40));
    expect(finishSession(s, T0 + min(20)).durationMs).toBe(min(20));
    expect(markSeen(s, T0 + min(20)).lastSeenAt).toBe(T0 + min(20));
  });
});

describe('finishing a very long session', () => {
  it('asks about an unanswered absence first, then about more than 10 hours', () => {
    const away = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(40));
    expect(finishQuestion(away, T0 + min(41))).toBe('away');
    expect(finishQuestion(started(), T0 + LONG_SESSION_MS)).toBeNull();
    expect(finishQuestion(started(), T0 + LONG_SESSION_MS + 1)).toBe('long');
    expect(LONG_SESSION_MS).toBe(min(600));
  });

  it('capStudyTime keeps the first 10 hours of study, breaks included in their place', () => {
    let s = resumeSession(pauseSession(started(), T0 + min(60)), T0 + min(90));
    const done = finishSession(s, T0 + min(900));
    expect(done.durationMs).toBe(min(870));
    const capped = capStudyTime(done, LONG_SESSION_MS);
    expect(capped.durationMs).toBe(LONG_SESSION_MS);
    expect(capped.endedAt).toBe(T0 + min(630));
    expect(capped.pauses).toEqual([{ start: T0 + min(60), end: T0 + min(90), kind: 'manual' }]);
    expect(intervalsTotal(workIntervals(capped.startedAt, capped.pauses, capped.endedAt))).toBe(LONG_SESSION_MS);
    s = started();
    const short = finishSession(s, T0 + min(30));
    expect(capStudyTime(short, LONG_SESSION_MS)).toBe(short);
  });
});

describe('isActiveSession', () => {
  it('rejects malformed values', () => {
    expect(isActiveSession(null)).toBe(false);
    expect(isActiveSession({ id: 'x' })).toBe(false);
    expect(
      isActiveSession({
        id: 'x',
        subjectId: 'y',
        startedAt: 1,
        pauses: [{ start: 'a', end: null }],
        backgroundedAt: null,
        pendingAway: null,
      }),
    ).toBe(false);
  });
});
