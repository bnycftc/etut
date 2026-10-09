import { AYT_TOPICS } from '../curriculum/yks-ayt';
import { KPSS_TOPICS } from '../curriculum/kpss';
import { LGS_TOPICS } from '../curriculum/lgs';
import { TYT_TOPICS } from '../curriculum/yks-tyt';
import type { SessionSpan } from '../daily-totals';
import { dayStartMs } from '../istanbul-day';
import { addMonths, heatLevel, monthDays, monthStartOf, monthView } from '../month-calendar';
import { examKindsFor } from '../net';
import {
  examSectionsForSubject,
  subjectMissedTopics,
  subjectOfSection,
  subjectOfTopic,
  subjectTopicSummary,
  subjectWeekTrend,
} from '../report-card';

const HOUR = 3_600_000;
const MIN = 60_000;

function span(subjectId: string, day: string, hour: number, minutes: number, extra: Partial<SessionSpan> = {}): SessionSpan {
  const startedAt = dayStartMs(day) + hour * HOUR;
  return { subjectId, startedAt, endedAt: startedAt + minutes * MIN, pauses: [], ...extra };
}

describe('month calendar', () => {
  it('month arithmetic on Istanbul day keys', () => {
    expect(monthStartOf('2026-10-07')).toBe('2026-10-01');
    expect(addMonths('2026-10-01', 1)).toBe('2026-11-01');
    expect(addMonths('2026-10-01', 3)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(addMonths('2026-03-01', -14)).toBe('2025-01-01');
    expect(monthDays('2026-02-01')).toHaveLength(28);
    expect(monthDays('2028-02-01')).toHaveLength(29);
    expect(monthDays('2026-10-01')[30]).toBe('2026-10-31');
  });

  it('shades by fixed hour bands', () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(59 * MIN)).toBe(1);
    expect(heatLevel(HOUR)).toBe(2);
    expect(heatLevel(3 * HOUR)).toBe(3);
    expect(heatLevel(6 * HOUR - 1)).toBe(3);
    expect(heatLevel(6 * HOUR)).toBe(4);
  });

  it('a Monday-first grid with blanks around the month, 5 or 6 rows', () => {
    // 1 Oct 2026 is a Thursday: three blanks before it; 31 days → 5 rows.
    const oct = monthView([], '2026-10-01', '2026-10-07');
    expect(oct.weeks).toHaveLength(5);
    expect(oct.weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(oct.weeks[0][3]?.day).toBe('2026-10-01');
    expect(oct.weeks.every((w) => w.length === 7)).toBe(true);
    expect(oct.weeks[4][5]?.day).toBe('2026-10-31');
    expect(oct.weeks[4][6]).toBeNull();
    // Feb and Mar 2026 start on a Sunday (6 blanks): 28 days fit in 5 rows, 31 need 6.
    expect(monthView([], '2026-02-01', '2026-03-01').weeks).toHaveLength(5);
    expect(monthView([], '2026-03-01', '2026-03-01').weeks).toHaveLength(6);
  });

  it('total, best day, average on study days and days without study (only up to today)', () => {
    const spans = [
      span('matematik', '2026-10-01', 9, 120),
      span('fizik', '2026-10-01', 14, 30),
      span('kimya', '2026-10-03', 10, 400),
      span('matematik', '2026-10-05', 8, 50),
      // Crosses midnight into the 6th: 30 min on the 5th, 30 min on the 6th.
      span('fizik', '2026-10-05', 23.5, 60),
    ];
    const view = monthView(spans, '2026-10-01', '2026-10-07');
    expect(view).toMatchObject({
      year: 2026,
      month: 10,
      totalMs: (150 + 400 + 80 + 30) * MIN,
      elapsedDays: 7,
      studyDays: 4,
      restDays: 3,
      bestDay: { day: '2026-10-03', ms: 400 * MIN },
      averageStudyDayMs: Math.round(((150 + 400 + 80 + 30) * MIN) / 4),
    });
    const byDay = new Map(view.days.map((d) => [d.day, d]));
    expect(byDay.get('2026-10-01')).toMatchObject({ date: 1, level: 2, future: false });
    expect(byDay.get('2026-10-03')?.level).toBe(4);
    expect(byDay.get('2026-10-06')).toMatchObject({ ms: 30 * MIN, level: 1 });
    expect(byDay.get('2026-10-08')).toMatchObject({ ms: 0, level: 0, future: true });
  });

  it('a past month counts every day; an empty month has no best day', () => {
    const empty = monthView([], '2026-09-01', '2026-10-07');
    expect(empty).toMatchObject({ elapsedDays: 30, studyDays: 0, restDays: 30, bestDay: null, averageStudyDayMs: 0, totalMs: 0 });
    // On a tie the earlier day is the best one.
    const tie = monthView([span('a', '2026-09-03', 9, 60), span('a', '2026-09-02', 9, 60)], '2026-09-01', '2026-10-07');
    expect(tie.bestDay?.day).toBe('2026-09-02');
  });
});

describe('subject report card', () => {
  it('a topic belongs to the subject in its id, for every curriculum list', () => {
    for (const source of [TYT_TOPICS, AYT_TOPICS, LGS_TOPICS, KPSS_TOPICS]) {
      for (const [subjectId, topics] of Object.entries(source)) {
        for (const t of topics ?? []) expect(subjectOfTopic(t.id)).toBe(subjectId);
      }
    }
    expect(subjectOfTopic('nonsense')).toBeNull();
  });

  it('maps exam sections to timer subjects (split AYT tests, geometry inside Matematik)', () => {
    expect(subjectOfSection('tarih2')).toBe('tarih');
    expect(subjectOfSection('cografya1')).toBe('cografya');
    expect(subjectOfSection('felsefe_grubu')).toBe('felsefe');
    const kinds = examKindsFor('YKS', 'sozel');
    expect(examSectionsForSubject('tarih', kinds)).toEqual([
      { kind: 'TYT', sectionId: 'tarih', questions: 5 },
      { kind: 'AYT_SOZ', sectionId: 'tarih1', questions: 10 },
      { kind: 'AYT_SOZ', sectionId: 'tarih2', questions: 11 },
    ]);
    expect(examSectionsForSubject('geometri', examKindsFor('YKS', 'sayisal'))).toEqual([
      { kind: 'TYT', sectionId: 'matematik', questions: 40 },
      { kind: 'AYT_SAY', sectionId: 'matematik', questions: 40 },
    ]);
    expect(examSectionsForSubject('fen', ['LGS'])).toEqual([{ kind: 'LGS', sectionId: 'fen', questions: 20 }]);
    expect(examSectionsForSubject('diger', examKindsFor('YKS', 'sayisal'))).toEqual([]);
  });

  it('8-week trend of one subject, oldest week first, this week last', () => {
    const spans = [
      span('matematik', '2026-10-05', 9, 90), // this week (Mon 5 Oct)
      span('matematik', '2026-09-28', 9, 30),
      span('fizik', '2026-10-06', 9, 600), // other subject
      span('matematik', '2026-08-10', 9, 60), // week 8 back
      span('matematik', '2026-08-03', 9, 60), // before the window
    ];
    const trend = subjectWeekTrend(spans, 'matematik', '2026-10-05');
    expect(trend).toHaveLength(8);
    expect(trend[0]).toEqual({ weekStart: '2026-08-17', ms: 0 });
    expect(trend[6]).toEqual({ weekStart: '2026-09-28', ms: 30 * MIN });
    expect(trend[7]).toEqual({ weekStart: '2026-10-05', ms: 90 * MIN });
    expect(subjectWeekTrend(spans, 'matematik', '2026-10-05', 9)[0]).toEqual({ weekStart: '2026-08-10', ms: 60 * MIN });
  });

  it('topics by state: done, review, studied but unmarked, untouched', () => {
    const topics = [
      { id: 'tyt.fizik.a', name: 'A' },
      { id: 'tyt.fizik.b', name: 'B' },
      { id: 'tyt.fizik.c', name: 'C' },
      { id: 'tyt.fizik.d', name: 'D' },
      { id: 'tyt.fizik.e', name: 'E' },
    ];
    const summary = subjectTopicSummary(
      topics,
      { 'tyt.fizik.a': 'done', 'tyt.fizik.b': 'review', 'tyt.fizik.c': 'done' },
      { 'tyt.fizik.b': 5 * MIN, 'tyt.fizik.d': 10 * MIN, 'other.x.y': 3 },
    );
    expect(summary.total).toBe(5);
    expect(summary.done.map((t) => t.name)).toEqual(['A', 'C']);
    expect(summary.review.map((t) => t.name)).toEqual(['B']);
    expect(summary.started.map((t) => t.name)).toEqual(['D']);
    expect(summary.untouched.map((t) => t.name)).toEqual(['E']);
  });

  it('most-missed topics of the subject only, with the time studied on each', () => {
    const marks = [
      { sectionId: 'matematik', topicId: 'tyt.matematik.problemler', wrong: 4, blank: 1 },
      { sectionId: 'matematik', topicId: 'tyt.geometri.ucgenler', wrong: 6, blank: 0 },
      { sectionId: 'matematik', topicId: 'tyt.matematik.problemler', wrong: 2, blank: 0 },
      { sectionId: 'fizik', topicId: 'tyt.fizik.basinc', wrong: 9, blank: 0 },
    ];
    expect(subjectMissedTopics(marks, 'matematik', { 'tyt.matematik.problemler': 2 * HOUR })).toEqual([
      { topicId: 'tyt.matematik.problemler', wrong: 6, blank: 1, ms: 2 * HOUR },
    ]);
    expect(subjectMissedTopics(marks, 'geometri', {})).toEqual([
      { topicId: 'tyt.geometri.ucgenler', wrong: 6, blank: 0, ms: 0 },
    ]);
  });
});
