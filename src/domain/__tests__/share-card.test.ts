import type { SessionSpan } from '../daily-totals';
import { CARD_TOP_SUBJECTS, cardRows, dailyCard, weeklyCard, wholePercents } from '../share-card';

const H = 3_600_000;
const span = (subjectId: string, startIso: string, hours: number): SessionSpan => ({
  subjectId,
  startedAt: Date.parse(startIso),
  endedAt: Date.parse(startIso) + hours * H,
  pauses: [],
});

describe('whole percents', () => {
  it('always add up to 100 (largest remainder)', () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([2, 1])).toEqual([67, 33]);
    expect(wholePercents([5])).toEqual([100]);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
    for (const values of [[7, 3, 9, 1], [123, 456, 789], [1, 2, 3, 4, 5, 6]]) {
      expect(wholePercents(values).reduce((s, v) => s + v, 0)).toBe(100);
    }
  });
});

describe('card rows', () => {
  it('largest first, the rest summed into one row', () => {
    const rows = cardRows([
      { subjectId: 'a', ms: 1 },
      { subjectId: 'b', ms: 6 },
      { subjectId: 'c', ms: 5 },
      { subjectId: 'd', ms: 4 },
      { subjectId: 'e', ms: 3 },
      { subjectId: 'f', ms: 2 },
      { subjectId: 'z', ms: 0 },
    ]);
    expect(rows.map((r) => r.subjectId)).toEqual(['b', 'c', 'd', 'e', null]);
    expect(rows).toHaveLength(CARD_TOP_SUBJECTS + 1);
    expect(rows[4].ms).toBe(3);
    expect(rows.reduce((s, r) => s + r.percent, 0)).toBe(100);
  });

  it('no extra row when everything fits', () => {
    expect(cardRows([{ subjectId: 'a', ms: 1 }])).toEqual([{ subjectId: 'a', ms: 1, percent: 100 }]);
    expect(cardRows([])).toEqual([]);
  });
});

describe('daily and weekly card', () => {
  // Week of Monday 2026-10-05 (Istanbul).
  const spans = [
    span('fizik', '2026-10-05T07:00:00Z', 1),
    span('matematik', '2026-10-07T07:00:00Z', 2),
    span('fizik', '2026-10-07T12:00:00Z', 1),
  ];

  it('day: total, subjects, goal share and streak', () => {
    const card = dailyCard(spans, '2026-10-07', 240, 3);
    expect(card).toMatchObject({ period: 'day', from: '2026-10-07', to: '2026-10-07', totalMs: 3 * H });
    expect(card.rows.map((r) => [r.subjectId, r.percent])).toEqual([
      ['matematik', 67],
      ['fizik', 33],
    ]);
    expect(card).toMatchObject({ goalMinutes: 240, goalPercent: 75, streakDays: 3, goalDays: null, activeDays: null });
  });

  it('day without a goal shows neither goal nor streak', () => {
    expect(dailyCard(spans, '2026-10-07', null, null)).toMatchObject({ goalPercent: null, streakDays: null });
  });

  it('week: Monday to Sunday, active days and goal days', () => {
    const card = weeklyCard(spans, '2026-10-05', 60, 2);
    expect(card).toMatchObject({ period: 'week', from: '2026-10-05', to: '2026-10-11', totalMs: 4 * H });
    expect(card).toMatchObject({ activeDays: 2, goalDays: 2, streakDays: 2, goalPercent: null });
    expect(card.rows[0]).toMatchObject({ subjectId: 'fizik', percent: 50 });
  });

  it('carries study numbers only (no profile fields)', () => {
    expect(Object.keys(dailyCard(spans, '2026-10-07', null, null)).sort()).toEqual(
      ['activeDays', 'from', 'goalDays', 'goalMinutes', 'goalPercent', 'period', 'rows', 'streakDays', 'to', 'totalMs'].sort(),
    );
  });
});
