import { dailyTotals } from '../daily-totals';
import {
  buildManualSession,
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

  it('an entry across Istanbul midnight is split between the two days', () => {
    const start = parseStartTime('2026-10-03', '23', '30')!;
    const s = buildManualSession('m2', { subjectId: 'fizik', topicId: null, startMs: start, durationMs: min(60) });
    const totals = dailyTotals([s], ['2026-10-03', '2026-10-04']);
    expect(totals.map((t) => t.totalMs)).toEqual([min(30), min(30)]);
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

  it('reads the duration from hours and minutes', () => {
    expect(parseDurationFields('1', '30')).toBe(min(90));
    expect(parseDurationFields('', '45')).toBe(min(45));
    expect(parseDurationFields('2', '')).toBe(min(120));
    expect(parseDurationFields('0', '60')).toBeNull();
    expect(parseDurationFields('-1', '0')).toBeNull();
  });
});
