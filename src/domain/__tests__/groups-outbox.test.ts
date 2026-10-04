import {
  ageBandFor,
  canUseParentMode,
  checkNameLocally,
  cleanName,
  formatCode,
  isCodeShaped,
  liveElapsedMs,
  normalizeCode,
  stepDailyLimit,
  usageLimitReached,
} from '../groups';
import { isStored, retryDelayMs, toPayload, uuidFromLocalId } from '../outbox';
import type { CompletedSession } from '../timer';

describe('age band (K-16, K-17)', () => {
  it('uses the lower possible age and refuses under 15', () => {
    // Born 2011, in 2026: 14 or 15 → possibly under 15 → no server account.
    expect(ageBandFor(2011, 2026)).toBeNull();
    expect(ageBandFor(2010, 2026)).toBe('15_17'); // 15 or 16
    expect(ageBandFor(2008, 2026)).toBe('15_17'); // 17 or 18 → lower wins
    expect(ageBandFor(2007, 2026)).toBe('18_plus');
  });

  it('parent mode only for adults', () => {
    expect(canUseParentMode(1980, 2026)).toBe(true);
    expect(canUseParentMode(2008, 2026)).toBe(false);
  });
});

describe('names (local pre-check; the word filter runs on the server)', () => {
  it('normalises whitespace', () => {
    expect(cleanName('  Gece   Kuşu ')).toBe('Gece Kuşu');
  });

  it('checks length and characters', () => {
    expect(checkNameLocally('Gece Kuşu', 'nickname')).toBeNull();
    expect(checkNameLocally('Al', 'nickname')).toBe('name_length');
    expect(checkNameLocally('a'.repeat(21), 'nickname')).toBe('name_length');
    expect(checkNameLocally('a'.repeat(24), 'group')).toBeNull();
    expect(checkNameLocally('Ali 😀', 'nickname')).toBe('name_chars');
    expect(checkNameLocally('ali@x', 'nickname')).toBe('name_chars');
    expect(checkNameLocally('12345', 'nickname')).toBe('name_chars');
  });
});

describe('codes', () => {
  it('ignores case, spaces and dashes', () => {
    expect(normalizeCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(isCodeShaped('abcd-efgh')).toBe(true);
    expect(isCodeShaped('ABCD-EFG0')).toBe(false); // 0 is not in the alphabet
    expect(formatCode('abcdefgh')).toBe('ABCD-EFGH');
  });
});

describe('parent daily limit (K-22 c)', () => {
  it('steps between no limit and 10 hours', () => {
    expect(stepDailyLimit(null, 1)).toBe(15);
    expect(stepDailyLimit(15, -1)).toBeNull();
    expect(stepDailyLimit(60, 1)).toBe(75);
    expect(stepDailyLimit(600, 1)).toBe(600);
    expect(stepDailyLimit(null, -1)).toBeNull();
  });

  it('is reached at the limit', () => {
    expect(usageLimitReached(59 * 60_000, 60)).toBe(false);
    expect(usageLimitReached(60 * 60_000, 60)).toBe(true);
    expect(usageLimitReached(10 * 3_600_000, null)).toBe(false);
  });
});

it('live elapsed time is drawn from the server start', () => {
  const start = Date.UTC(2026, 9, 4, 10, 0, 0);
  expect(liveElapsedMs(new Date(start).toISOString(), start + 25 * 60_000)).toBe(25 * 60_000);
  expect(liveElapsedMs(null, start)).toBe(0);
  expect(liveElapsedMs('not a date', start)).toBe(0);
});

describe('outbox', () => {
  const session: CompletedSession = {
    id: 'mg1x2y-abcd1234',
    subjectId: 'fizik',
    topicId: null,
    startedAt: Date.UTC(2026, 9, 4, 10, 0, 0),
    endedAt: Date.UTC(2026, 9, 4, 11, 0, 0),
    pauses: [],
    durationMs: 3_000_500,
    source: 'timer',
  };

  it('maps a finished session to the upload payload', () => {
    expect(toPayload(session)).toEqual({
      clientId: uuidFromLocalId(session.id),
      subjectId: 'fizik',
      topicId: null,
      startedAt: '2026-10-04T10:00:00.000Z',
      endedAt: '2026-10-04T11:00:00.000Z',
      durationS: 3000,
      source: 'timer',
    });
    expect(toPayload({ ...session, source: 'manual' })?.source).toBe('manual');
    expect(toPayload({ ...session, durationMs: 999 })).toBeNull();
  });

  it('derives a stable, uuid-shaped id per local session', () => {
    const a = uuidFromLocalId('mg1x2y-abcd1234');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidFromLocalId('mg1x2y-abcd1234')).toBe(a);
    expect(uuidFromLocalId('mg1x2y-abcd1235')).not.toBe(a);
    const many = new Set(Array.from({ length: 2000 }, (_, i) => uuidFromLocalId(`id-${i}`)));
    expect(many.size).toBe(2000);
  });

  it('backs off exponentially up to an hour', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(50)).toBe(3_600_000);
  });

  it('only accepted and duplicate count as stored', () => {
    expect(isStored('accepted')).toBe(true);
    expect(isStored('duplicate')).toBe(true);
    expect(isStored('overlap')).toBe(false);
    expect(isStored('day_limit')).toBe(false);
  });
});
