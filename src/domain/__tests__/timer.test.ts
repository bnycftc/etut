import { DEFAULT_POMODORO } from '../pomodoro';
import { LONG_SESSION_HOURS } from '../reminders';
import {
  type ActiveSession,
  AWAY_COUNT_MAX_MS,
  BACKGROUND_TOLERANCE_MS,
  capStudyTime,
  creditAway,
  DEFAULT_AWAY_RULE,
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
  pendingAwayStudyMs,
  provisionalAwayAt,
  resumeSession,
  startSession,
  workIntervals,
} from '../timer';

const T0 = Date.parse('2026-10-04T07:00:00Z');
const sec = (n: number) => n * 1000;
const min = (n: number) => n * 60_000;
const HOUR = 3_600_000;

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

  describe('pomodoro: the tolerance counts study time, not time away', () => {
    // Default 25/5/15: the first short break is 25:00–30:00.
    const pomodoro = () => startSession('p1', 'matematik', T0, { pomodoro: DEFAULT_POMODORO });

    it('left during the break, back 4 s after it ended ("Mola bitti" tapped): nothing is asked', () => {
      const back = onAppForeground(onAppBackground(pomodoro(), T0 + min(26)), T0 + min(30) + sec(4));
      expect(back.pendingAway).toBeNull();
      expect(back.pauses).toEqual([]);
      expect(finishQuestion(back, T0 + min(30) + sec(4))).toBeNull();
      // The 4 s of the new block are study time.
      expect(elapsedMs(back, T0 + min(30) + sec(4))).toBe(min(25) + sec(4));
    });

    it('left 5 s before the break, back 4 s after it: 9 s of study lost, nothing is asked', () => {
      const back = onAppForeground(onAppBackground(pomodoro(), T0 + min(25) - sec(5)), T0 + min(30) + sec(4));
      expect(back.pendingAway).toBeNull();
      expect(elapsedMs(back, T0 + min(30) + sec(4))).toBe(min(25) + sec(4));
    });

    it('more study time than the tolerance: the whole absence is a break, the prompt names the study time', () => {
      const back = onAppForeground(onAppBackground(pomodoro(), T0 + min(26)), T0 + min(30) + sec(11));
      expect(back.pendingAway).toEqual({ start: T0 + min(26), end: T0 + min(30) + sec(11) });
      expect(pendingAwayMs(back)).toBe(min(4) + sec(11));
      // "Çalışıyordum" adds the 11 s of the new block, not the 4 min 11 s away.
      expect(pendingAwayStudyMs(back)).toBe(sec(11));
      const now = T0 + min(31);
      expect(elapsedMs(creditAway(back), now) - elapsedMs(back, now)).toBe(pendingAwayStudyMs(back));
    });
  });
});

describe('pendingAwayStudyMs (the number the away prompt shows)', () => {
  it('stopwatch: all of the time away, merged absences included', () => {
    let s = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(70));
    s = onAppForeground(onAppBackground(markSeen(s, T0 + min(71)), T0 + min(72)), T0 + min(132));
    expect(pendingAwayStudyMs(s)).toBe(min(120));
    expect(pendingAwayStudyMs(s)).toBe(pendingAwayMs(s));
    expect(pendingAwayStudyMs(creditAway(s))).toBe(0);
  });

  it('pomodoro: two hours away are what "Çalışıyordum" adds, the pomodoro breaks left out', () => {
    const s = startSession('p1', 'matematik', T0, { pomodoro: DEFAULT_POMODORO });
    const back = onAppForeground(onAppBackground(s, T0 + min(10)), T0 + min(130));
    expect(pendingAwayMs(back)).toBe(min(120));
    const now = T0 + min(130);
    expect(pendingAwayStudyMs(back)).toBe(elapsedMs(creditAway(back), now) - elapsedMs(back, now));
    // 10–130: breaks 25–30, 55–60, 85–90, 115–130 (long) = 30 min.
    expect(pendingAwayStudyMs(back)).toBe(min(90));
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

  it(`counts ${AWAY_COUNT_MAX_MS / HOUR} hours of one absence; the rest is an automatic break, asked about once`, () => {
    const leftAt = T0 + min(10);
    const capAt = leftAt + AWAY_COUNT_MAX_MS;
    const now = leftAt + min(300);
    const back = onAppForeground(onAppBackground(started(), leftAt), now, 'count');
    expect(back.pauses).toEqual([{ start: capAt, end: now, kind: 'away' }]);
    expect(back.pendingAway).toEqual({ start: capAt, end: now, capped: true });
    expect(finishQuestion(back, now)).toBe('away');
    expect(pendingAwayMs(back)).toBe(min(120));
    expect(pendingAwayStudyMs(back)).toBe(min(120));
    expect(elapsedMs(back, now)).toBe(min(10) + AWAY_COUNT_MAX_MS);
    expect(elapsedMs(creditAway(back), now)).toBe(min(310));
    expect(elapsedMs(dismissAway(back), now)).toBe(min(190));
  });

  it('back within the tolerance after those hours: nothing is asked', () => {
    const leftAt = T0 + min(10);
    const back = onAppForeground(
      onAppBackground(started(), leftAt),
      leftAt + AWAY_COUNT_MAX_MS + BACKGROUND_TOLERANCE_MS,
      'count',
    );
    expect(back.pauses).toEqual([]);
    expect(back.pendingAway).toBeNull();
  });

  it('a timer left running overnight in an app that died: the hours that count, then the question', () => {
    const lastSeen = T0 + min(30);
    const now = lastSeen + 8 * HOUR;
    const launched = onAppLaunch(markSeen(started(), lastSeen), now, 'count');
    expect(launched.pendingAway).toEqual({ start: lastSeen + AWAY_COUNT_MAX_MS, end: now, capped: true });
    expect(elapsedMs(launched, now)).toBe(min(30) + AWAY_COUNT_MAX_MS);
    expect(elapsedMs(creditAway(launched), now)).toBe(min(30) + 8 * HOUR);
  });

  it('pomodoro: the counted hours keep the rhythm; only work blocks after them are asked about', () => {
    const s = startSession('p1', 'matematik', T0, { pomodoro: DEFAULT_POMODORO });
    const back = onAppForeground(onAppBackground(s, T0 + min(10)), T0 + min(250), 'count');
    // Asked about: 190–250 (60 min away), of which the work blocks 190–215 and 220–245.
    expect(back.pendingAway).toEqual({ start: T0 + min(190), end: T0 + min(250), capped: true });
    expect(pendingAwayMs(back)).toBe(min(60));
    expect(pendingAwayStudyMs(back)).toBe(min(50));
  });

  it('a later absence joins a capped one: one prompt, still said to be capped', () => {
    const capAt = T0 + min(10) + AWAY_COUNT_MAX_MS;
    let s = onAppForeground(onAppBackground(started(), T0 + min(10)), capAt + HOUR, 'count');
    s = markSeen(s, capAt + HOUR + min(1));
    // The student switches to "Sor" before answering, then leaves for half an hour.
    s = onAppForeground(onAppBackground(s, capAt + HOUR + min(2)), capAt + HOUR + min(32), 'ask');
    expect(s.pendingAway).toEqual({ start: capAt, end: capAt + HOUR + min(32), capped: true });
    expect(pendingAwayMs(s)).toBe(min(90));
  });

  it('is the app default; a call without a rule gets the strict "ask"', () => {
    expect(DEFAULT_AWAY_RULE).toBe('count');
    const back = onAppForeground(onAppBackground(started(), T0 + min(10)), T0 + min(70));
    expect(back.pendingAway).toEqual({ start: T0 + min(10), end: T0 + min(70) });
  });

  it('counts as long as the default long-session reminder waits', () => {
    expect(AWAY_COUNT_MAX_MS).toBe(LONG_SESSION_HOURS.default * HOUR);
  });
});

describe('provisionalAwayAt (where the Lock Screen timer and the widget freeze while away)', () => {
  const pomodoro = () => startSession('p1', 'matematik', T0, { pomodoro: DEFAULT_POMODORO });

  it('nothing in the foreground or while paused by hand', () => {
    expect(provisionalAwayAt(started(), 'ask')).toBeNull();
    expect(provisionalAwayAt(started(), 'count')).toBeNull();
    const paused = pauseSession(started(), T0 + min(5));
    // A paused timer is not watched; even a session marked away while paused stays out.
    expect(provisionalAwayAt(onAppBackground(paused, T0 + min(10)), 'ask')).toBeNull();
    expect(provisionalAwayAt({ ...paused, backgroundedAt: T0 + min(10) }, 'ask')).toBeNull();
    expect(provisionalAwayAt({ ...paused, backgroundedAt: T0 + min(10) }, 'count')).toBeNull();
  });

  it('"Çalışmaya devam say": when the counted hours are over (in a pomodoro break: its end)', () => {
    expect(provisionalAwayAt(onAppBackground(started(), T0 + min(10)), 'count')).toBe(T0 + min(10) + AWAY_COUNT_MAX_MS);
    // Left at 0:20, 3 hours later is the work block 190–215.
    expect(provisionalAwayAt(onAppBackground(pomodoro(), T0 + min(20)), 'count')).toBe(T0 + min(200));
    // Left at 0:06, 3 hours later is the short break 185–190.
    expect(provisionalAwayAt(onAppBackground(pomodoro(), T0 + min(6)), 'count')).toBe(T0 + min(190));
  });

  it('stopwatch and a pomodoro work block: from the moment the app left', () => {
    expect(provisionalAwayAt(onAppBackground(started(), T0 + min(10)), 'ask')).toBe(T0 + min(10));
    expect(provisionalAwayAt(onAppBackground(pomodoro(), T0 + min(10)), 'ask')).toBe(T0 + min(10));
  });

  it('pomodoro break: from the end of the break (back before it, nothing is asked)', () => {
    expect(provisionalAwayAt(onAppBackground(pomodoro(), T0 + min(26)), 'ask')).toBe(T0 + min(30));
    // Exactly at the end of the work block the break has begun.
    expect(provisionalAwayAt(onAppBackground(pomodoro(), T0 + min(25)), 'ask')).toBe(T0 + min(30));
  });

  it('nothing is taken up to the tolerance after it; after a costlier return the study time at that moment is kept', () => {
    for (const rule of ['ask', 'count'] as const) {
      // "Çalışmaya devam say" leaves the first hours alone: the same moments, that much later.
      const shift = rule === 'count' ? AWAY_COUNT_MAX_MS : 0;
      for (const [session, leftAt] of [
        [started(), T0 + min(10)],
        [pomodoro(), T0 + min(10)],
        [pomodoro(), T0 + min(26)],
        [pomodoro(), T0 + min(25) - sec(5)],
        [pomodoro(), T0 + min(6)],
      ] as const) {
        const bg = onAppBackground(session, leftAt);
        const costFrom = leftAt + shift;
        const freezeAt = provisionalAwayAt(bg, rule)!;
        // Within the tolerance after it (for a break: just after the break end), during the break,
        // just past the tolerance, in the next work block, hours later, just before the hours that
        // count are over.
        for (const later of [
          freezeAt + sec(4),
          freezeAt + BACKGROUND_TOLERANCE_MS,
          T0 + shift + min(29),
          freezeAt + BACKGROUND_TOLERANCE_MS + sec(1),
          T0 + shift + min(40),
          T0 + shift + min(200),
          costFrom - min(1),
        ]) {
          if (later < leftAt) continue;
          const kept = elapsedMs(onAppForeground(bg, later, rule), later);
          const cost = later <= costFrom ? 0 : elapsedMs(bg, later) - elapsedMs(bg, costFrom);
          if (later <= freezeAt + BACKGROUND_TOLERANCE_MS || cost <= BACKGROUND_TOLERANCE_MS) {
            expect(kept).toBe(elapsedMs(bg, later));
          } else {
            expect(kept).toBe(elapsedMs(bg, freezeAt));
          }
        }
      }
    }
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
