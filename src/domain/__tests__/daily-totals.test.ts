import { dailyTotals, pastDayTotals, spanStudyMs, studiedBetween, subjectBreakdown } from '../daily-totals';

const min = (n: number) => n * 60_000;
const at = (iso: string) => Date.parse(iso);

describe('dailyTotals', () => {
  it('a session spanning decades (wrong device clock) costs no more than a short one', () => {
    const days = ['2026-10-01', '2026-10-02'];
    const started = Date.now();
    const span = (startIso: string) => ({
      subjectId: 'fizik',
      startedAt: at(startIso),
      endedAt: at('2099-11-30T00:00:00Z'),
      pauses: [],
    });
    const totals = dailyTotals(
      [
        ...Array.from({ length: 200 }, () => span('2016-01-02T00:00:00Z')),
        span('2026-10-01T09:00:00Z'), // 12:00 Istanbul on the 1st
      ],
      days,
    );
    expect(Date.now() - started).toBeLessThan(500);
    // Only the one that started on an asked day counts, whole, on that day.
    expect(totals.map((t) => t.totalMs)).toEqual([at('2099-11-30T00:00:00Z') - at('2026-10-01T09:00:00Z'), 0]);
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

  it('a session that crosses Istanbul midnight counts whole on the day it started', () => {
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
    expect(totals.map((t) => t.totalMs)).toEqual([min(120), 0]);
    expect(totals[0].bySubject).toEqual({ kimya: min(120) });
  });

  it('23:30–00:45: 75 min on the start day, the same number as the session row', () => {
    const session = {
      subjectId: 'fizik',
      startedAt: at('2026-10-04T20:30:00Z'), // 23:30 Istanbul
      endedAt: at('2026-10-04T21:45:00Z'), // 00:45 Istanbul on the 5th
      pauses: [],
    };
    const [day4, day5] = dailyTotals([session], ['2026-10-04', '2026-10-05']);
    expect(day4.totalMs).toBe(min(75));
    expect(day4.totalMs).toBe(spanStudyMs(session));
    expect(day5.totalMs).toBe(0);
    // A running session that started yesterday belongs to yesterday too.
    expect(pastDayTotals([session], '2026-10-05')).toEqual(new Map([['2026-10-04', min(75)]]));
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

describe('studiedBetween', () => {
  it('counts the sessions that started in the range, up to its end', () => {
    const spans = [
      // 23:30–00:45 Istanbul: started on the 4th.
      { subjectId: 'fizik', startedAt: at('2026-10-04T20:30:00Z'), endedAt: at('2026-10-04T21:45:00Z'), pauses: [] },
      // 08:00–09:00 on the 5th.
      { subjectId: 'kimya', startedAt: at('2026-10-05T05:00:00Z'), endedAt: at('2026-10-05T06:00:00Z'), pauses: [] },
    ];
    const day5 = at('2026-10-04T21:00:00Z');
    expect(studiedBetween(spans, day5, day5 + 24 * min(60))).toBe(min(60));
    // On the 4th up to 00:15 on the 5th: the session that started on the 4th, as far as it went.
    expect(studiedBetween(spans, day5 - 24 * min(60), day5 + min(15))).toBe(min(45));
  });
});
