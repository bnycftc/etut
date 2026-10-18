import { dailyTotals } from '../daily-totals';
import {
  buildManualSession,
  durationFields,
  earliestManualDay,
  justFinishedStart,
  MANUAL_DURATION_CHIPS,
  MANUAL_MAX_MS,
  parseDurationFields,
  parseStartTime,
  validateManualEntry,
} from '../manual-entry';

const min = (n: number) => n * 60_000;
const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-10-04T15:00:00Z'); // 18:00 Istanbul

function entry(startIso: string, minutes: number) {
  return { subjectId: 'matematik', topicId: null, startMs: at(startIso), durationMs: min(minutes) };
}

describe('validateManualEntry', () => {
  it('accepts a past entry that touches but does not overlap other sessions', () => {
    const existing = [
      { startedAt: at('2026-10-04T06:00:00Z'), endedAt: at('2026-10-04T07:00:00Z') },
      { startedAt: at('2026-10-04T08:00:00Z'), endedAt: at('2026-10-04T09:00:00Z') },
    ];
    expect(validateManualEntry(entry('2026-10-04T07:00:00Z', 60), existing, NOW)).toBeNull();
  });

  it('rejects any overlap, including with the running session', () => {
    const stored = [{ startedAt: at('2026-10-04T06:00:00Z'), endedAt: at('2026-10-04T07:00:00Z') }];
    expect(validateManualEntry(entry('2026-10-04T06:59:00Z', 30), stored, NOW)).toBe('overlap');
    expect(validateManualEntry(entry('2026-10-04T05:00:00Z', 180), stored, NOW)).toBe('overlap');
    const running = [{ startedAt: at('2026-10-04T14:30:00Z'), endedAt: NOW }];
    expect(validateManualEntry(entry('2026-10-04T14:00:00Z', 31), running, NOW)).toBe('overlap');
    expect(validateManualEntry(entry('2026-10-04T14:00:00Z', 30), running, NOW)).toBeNull();
  });

  it('rejects time in the future; ending exactly now is fine', () => {
    expect(validateManualEntry(entry('2026-10-04T14:00:00Z', 60), [], NOW)).toBeNull();
    expect(validateManualEntry(entry('2026-10-04T14:00:00Z', 61), [], NOW)).toBe('future');
    expect(validateManualEntry(entry('2026-10-05T08:00:00Z', 10), [], NOW)).toBe('future');
  });

  it('only the last 7 Istanbul days, today included, can be filled in', () => {
    expect(earliestManualDay(NOW)).toBe('2026-09-28');
    // 2026-09-28 00:00 Istanbul = 2026-09-27T21:00Z
    expect(validateManualEntry(entry('2026-09-27T21:00:00Z', 30), [], NOW)).toBeNull();
    expect(validateManualEntry(entry('2026-09-27T20:59:00Z', 30), [], NOW)).toBe('too_old');
    // Just after Istanbul midnight the window moves by a day.
    const justAfterMidnight = at('2026-10-04T21:00:00Z'); // 2026-10-05 00:00 Istanbul
    expect(earliestManualDay(justAfterMidnight)).toBe('2026-09-29');
    expect(validateManualEntry(entry('2026-09-27T21:00:00Z', 30), [], justAfterMidnight)).toBe('too_old');
  });

  it('allows at most 10 hours and at least 1 minute per entry', () => {
    expect(validateManualEntry(entry('2026-10-04T03:00:00Z', 600), [], NOW)).toBeNull();
    expect(MANUAL_MAX_MS).toBe(min(600));
    expect(validateManualEntry(entry('2026-10-04T03:00:00Z', 601), [], NOW)).toBe('too_long');
    expect(validateManualEntry(entry('2026-10-04T03:00:00Z', 0), [], NOW)).toBe('too_short');
    expect(
      validateManualEntry({ ...entry('2026-10-04T03:00:00Z', 0), durationMs: 90_000 }, [], NOW),
    ).toBe('invalid');
  });
});

describe('manual sessions', () => {
  it('are stored with source "manual" and no pauses', () => {
    const s = buildManualSession('m1', { ...entry('2026-10-04T06:00:00Z', 45), topicId: 'tyt.x.y' });
    expect(s).toMatchObject({
      id: 'm1',
      source: 'manual',
      topicId: 'tyt.x.y',
      pauses: [],
      durationMs: min(45),
      endedAt: at('2026-10-04T06:45:00Z'),
    });
  });

  it('an entry across Istanbul midnight counts whole on the day it started', () => {
    const start = parseStartTime('2026-10-03', '23', '30')!;
    const s = buildManualSession('m2', { subjectId: 'fizik', topicId: null, startMs: start, durationMs: min(60) });
    const totals = dailyTotals([s], ['2026-10-03', '2026-10-04']);
    expect(totals.map((t) => t.totalMs)).toEqual([min(60), 0]);
  });
});

describe('form parsing', () => {
  it('reads the start as Istanbul wall-clock time', () => {
    expect(parseStartTime('2026-10-04', '0', '30')).toBe(at('2026-10-03T21:30:00Z'));
    expect(parseStartTime('2026-10-04', '23', '59')).toBe(at('2026-10-04T20:59:00Z'));
    expect(parseStartTime('2026-10-04', '9', '')).toBe(at('2026-10-04T06:00:00Z'));
    expect(parseStartTime('2026-10-04', '24', '00')).toBeNull();
    expect(parseStartTime('2026-10-04', '10', '60')).toBeNull();
    expect(parseStartTime('2026-10-04', '', '10')).toBeNull();
    expect(parseStartTime('2026-10-04', '1a', '10')).toBeNull();
  });

  it('a duration chip fills fields that read back as the same duration', () => {
    expect(durationFields(45)).toEqual({ hours: '0', minutes: '45' });
    expect(durationFields(90)).toEqual({ hours: '1', minutes: '30' });
    for (const m of MANUAL_DURATION_CHIPS) {
      const f = durationFields(m);
      expect(parseDurationFields(f.hours, f.minutes)).toBe(min(m));
    }
  });

  it('reads the duration from hours and minutes', () => {
    expect(parseDurationFields('1', '30')).toBe(min(90));
    expect(parseDurationFields('', '45')).toBe(min(45));
    expect(parseDurationFields('2', '')).toBe(min(120));
    expect(parseDurationFields('0', '60')).toBeNull();
    expect(parseDurationFields('-1', '0')).toBeNull();
  });
});

describe('"az önce bitti"', () => {
  // IOS-06: a timer session saved a few minutes ago used to sit inside the default span, and Ekle
  // was refused ("Bu saatlerde başka bir çalışma kaydın var.").
  const span = (fromIso: string, toIso: string) => ({ startedAt: at(fromIso), endedAt: at(toIso) });

  it('ends where the latest session that is in the way starts, so the default is accepted', () => {
    const now = at('2026-10-04T16:33:20Z'); // 19:33:20 Istanbul
    // Timer session 19:20:10–19:30:40, saved three minutes ago.
    const timer = span('2026-10-04T16:20:10Z', '2026-10-04T16:30:40Z');
    const start = justFinishedStart(now, min(60), [timer]);
    expect(start).toBe(at('2026-10-04T15:20:00Z')); // 18:20–19:20, on whole minutes
    const input = { subjectId: 'matematik', topicId: null, startMs: start ?? Number.NaN, durationMs: min(60) };
    expect(validateManualEntry(input, [timer], now)).toBeNull();
    // Without the session in the way it still ends now.
    expect(justFinishedStart(now, min(60), [])).toBe(at('2026-10-04T15:33:00Z'));
  });

  it('a session that ended before the span, or touches its start, is not in the way', () => {
    const now = at('2026-10-04T16:00:00Z'); // 19:00
    expect(justFinishedStart(now, min(30), [span('2026-10-04T14:00:00Z', '2026-10-04T15:30:00Z')])).toBe(
      at('2026-10-04T15:30:00Z'),
    );
  });

  it('skips back over several sessions and gaps too short for the entry', () => {
    const now = at('2026-10-04T16:00:00Z'); // 19:00
    const sessions = [
      span('2026-10-04T15:40:00Z', '2026-10-04T15:55:00Z'), // 18:40–18:55
      span('2026-10-04T15:00:00Z', '2026-10-04T15:30:00Z'), // 18:00–18:30 (10-minute gap after it)
    ];
    // 18:55–19:00 (5 min) and 18:30–18:40 (10 min) are too short for 15: 17:45–18:00.
    expect(justFinishedStart(now, min(15), sessions)).toBe(at('2026-10-04T14:45:00Z'));
    expect(justFinishedStart(now, min(5), sessions)).toBe(at('2026-10-04T15:55:00Z')); // 18:55–19:00 fits 5
    expect(justFinishedStart(now, min(10), sessions)).toBe(at('2026-10-04T15:30:00Z')); // 18:30–18:40
    expect(justFinishedStart(now, min(20), sessions)).toBe(at('2026-10-04T14:40:00Z')); // 17:40–18:00
  });

  it('the running session counts up to now: the entry ends before it started', () => {
    const now = at('2026-10-04T16:00:00Z');
    const running = { startedAt: at('2026-10-04T15:45:30Z'), endedAt: now }; // since 18:45:30
    expect(justFinishedStart(now, min(45), [running])).toBe(at('2026-10-04T15:00:00Z')); // 18:00–18:45
  });

  it('null when no free span starts within the last 7 days', () => {
    const now = at('2026-10-04T16:00:00Z');
    const allWeek = { startedAt: at('2026-09-20T00:00:00Z'), endedAt: now };
    expect(justFinishedStart(now, min(30), [allWeek])).toBeNull();
  });

  it('ends at the start of the current minute, so the entry is valid right away', () => {
    const now = NOW + 42_500; // 18:00:42.5 Istanbul
    const start = justFinishedStart(now, min(45));
    expect(start).toBe(at('2026-10-04T14:15:00Z')); // 17:15–18:00
    expect(validateManualEntry(entry('2026-10-04T14:15:00Z', 45), [], now)).toBeNull();
    expect(justFinishedStart(NOW, min(45))).toBe(start);
  });

  it('just after Istanbul midnight the entry starts on the day before', () => {
    const now = at('2026-10-04T21:10:00Z'); // 5 Oct 00:10 Istanbul
    const start = justFinishedStart(now, min(30)) ?? Number.NaN;
    expect(start).toBe(parseStartTime('2026-10-04', '23', '40'));
    const s = buildManualSession('m3', { subjectId: 'fizik', topicId: null, startMs: start, durationMs: min(30) });
    expect(dailyTotals([s], ['2026-10-04', '2026-10-05']).map((t) => t.totalMs)).toEqual([min(30), 0]);
  });
});
