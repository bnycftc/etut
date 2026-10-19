import {
  ANSWER_DAYS,
  bodyRequired,
  checkRequestInput,
  dueAtMs,
  isUnseenAnswer,
  REQUEST_BODY_MAX,
  REQUEST_KINDS,
  requestState,
} from '../dsr';

describe('KVKK application form rules', () => {
  it('lists the rights of KVKK m.11 plus complaint and other, each once', () => {
    expect(REQUEST_KINDS).toHaveLength(11);
    expect(new Set(REQUEST_KINDS).size).toBe(REQUEST_KINDS.length);
    expect(REQUEST_KINDS).toContain('complaint');
    expect(REQUEST_KINDS.at(-1)).toBe('other');
  });

  it('complaint and other need a text, the rights themselves do not', () => {
    expect(REQUEST_KINDS.filter(bodyRequired)).toEqual(['complaint', 'other']);
    expect(checkRequestInput('deletion', '')).toBeNull();
    expect(checkRequestInput('complaint', '   ')).toBe('body_required');
    expect(checkRequestInput('other', '')).toBe('body_required');
    expect(checkRequestInput('complaint', 'Bir grup adında küfür var.')).toBeNull();
  });

  it('allows at most 2000 characters, not counting surrounding spaces', () => {
    expect(REQUEST_BODY_MAX).toBe(2000);
    expect(checkRequestInput('info', 'a'.repeat(2000))).toBeNull();
    expect(checkRequestInput('info', `  ${'a'.repeat(2000)}  `)).toBeNull();
    expect(checkRequestInput('info', 'a'.repeat(2001))).toBe('body_too_long');
  });
});

describe('30-day deadline', () => {
  it('is 30 calendar days after the submission', () => {
    expect(ANSWER_DAYS).toBe(30);
    const created = Date.parse('2026-02-15T07:00:00Z'); // 10:00 Istanbul
    expect(new Date(dueAtMs(created)).toISOString()).toBe('2026-03-17T07:00:00.000Z');
    const lateDecember = Date.parse('2026-12-20T20:30:00Z'); // 23:30 Istanbul
    expect(new Date(dueAtMs(lateDecember)).toISOString()).toBe('2027-01-19T20:30:00.000Z');
  });

  it('a request is open until the deadline, overdue after it, answered once answered', () => {
    const r = { answeredAt: null, dueAt: '2026-11-18T12:00:00Z' };
    expect(requestState(r, Date.parse('2026-11-18T11:59:59Z'))).toBe('open');
    expect(requestState(r, Date.parse('2026-11-18T12:00:01Z'))).toBe('overdue');
    expect(requestState({ ...r, answeredAt: '2026-11-19T08:00:00Z' }, Date.parse('2026-12-01T00:00:00Z'))).toBe('answered');
  });

  it('an answer is unseen until it was opened once', () => {
    expect(isUnseenAnswer({ answeredAt: null, seenAt: null })).toBe(false);
    expect(isUnseenAnswer({ answeredAt: '2026-11-01T08:00:00Z', seenAt: null })).toBe(true);
    expect(isUnseenAnswer({ answeredAt: '2026-11-01T08:00:00Z', seenAt: '2026-11-02T08:00:00Z' })).toBe(false);
  });
});
