import { dailyTotals, subjectBreakdown } from '../daily-totals';

const min = (n: number) => n * 60_000;
const at = (iso: string) => Date.parse(iso);

describe('dailyTotals', () => {
  it('a session spanning decades (wrong device clock) costs no more than a short one', () => {
    const days = ['2026-10-01', '2026-10-02'];
    const started = Date.now();
    const totals = dailyTotals(
      Array.from({ length: 200 }, () => ({
        subjectId: 'fizik',
        startedAt: at('2016-01-02T00:00:00Z'),
        endedAt: at('2099-11-30T00:00:00Z'),
        pauses: [],
      })),
      days,
    );
    expect(Date.now() - started).toBeLessThan(500);
    expect(totals.map((t) => t.totalMs)).toEqual([200 * 24 * min(60), 200 * 24 * min(60)]);
  });

  it('sums sessions per day and per subject, minus pauses', () => {
    const [day] = dailyTotals(
      [
        {
          subjectId: 'matematik',
          startedAt: at('2026-10-04T06:00:00Z'),
          endedAt: at('2026-10-04T07:00:00Z'),
          pauses: [{ start: at('2026-10-04T06:20:00Z'), end: at('2026-10-04T06:30:00Z'), kind: 'manual' }],
        },
        {
          subjectId: 'fizik',
          startedAt: at('2026-10-04T08:00:00Z'),
          endedAt: at('2026-10-04T08:30:00Z'),
          pauses: [],
        },
        {
          subjectId: 'matematik',
          startedAt: at('2026-10-04T09:00:00Z'),
          endedAt: at('2026-10-04T09:15:00Z'),
          pauses: [],
        },
      ],
      ['2026-10-04'],
    );
    expect(day.totalMs).toBe(min(50 + 30 + 15));
    expect(day.bySubject).toEqual({ matematik: min(65), fizik: min(30) });
    expect(subjectBreakdown(day)).toEqual([
      { subjectId: 'matematik', ms: min(65) },
      { subjectId: 'fizik', ms: min(30) },
    ]);
  });

  it('splits a session that crosses Istanbul midnight', () => {
    const totals = dailyTotals(
      [
        {
          subjectId: 'kimya',
          startedAt: at('2026-10-04T20:00:00Z'), // 23:00 Istanbul
          endedAt: at('2026-10-04T22:00:00Z'), // 01:00 Istanbul
          pauses: [],
        },
      ],
      ['2026-10-04', '2026-10-05'],
    );
    expect(totals.map((t) => t.totalMs)).toEqual([min(60), min(60)]);
  });

  it('returns zero days in the requested order and ignores days outside the range', () => {
    const totals = dailyTotals(
      [
        {
          subjectId: 'tarih',
          startedAt: at('2026-09-01T08:00:00Z'),
          endedAt: at('2026-09-01T09:00:00Z'),
          pauses: [],
        },
      ],
      ['2026-10-03', '2026-10-04'],
    );
    expect(totals).toEqual([
      { day: '2026-10-03', totalMs: 0, bySubject: {} },
      { day: '2026-10-04', totalMs: 0, bySubject: {} },
    ]);
  });

  it('counts a running session up to now (open pause closes at now)', () => {
    const [day] = dailyTotals(
      [
        {
          subjectId: 'turkce',
          startedAt: at('2026-10-04T06:00:00Z'),
          endedAt: at('2026-10-04T07:00:00Z'),
          pauses: [{ start: at('2026-10-04T06:40:00Z'), end: null, kind: 'manual' }],
        },
      ],
      ['2026-10-04'],
    );
    expect(day.totalMs).toBe(min(40));
  });
});
