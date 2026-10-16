/**
 * The demo backup of the App Store screenshot run (e2e/store/demo-backup.js) is restored through
 * the app's own import, so it must pass the app's own backup parser with nothing left out, and
 * look like weeks of real use relative to the run date.
 */

import { parseBackup } from '../backup';
import { findTopic } from '../curriculum';
import { dailyTotals } from '../daily-totals';
import { addDays, DAY_MS, istanbulDayKey } from '../istanbul-day';
import { totalNet } from '../net';
import { computeStreak } from '../streak';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const demo = require('../../../e2e/store/demo-backup.js') as {
  buildDemoBackup: (now: number) => unknown;
  TOPICS: Record<string, string[]>;
  MARK_TOPICS: Record<string, Record<string, string[]>>;
  PROGRESS: [string, string][];
};

// Different run times: early morning (little of today left), midday, late evening, a month start.
const RUNS = [
  Date.UTC(2026, 9, 12, 7, 30),
  Date.UTC(2026, 9, 12, 23, 10),
  Date.UTC(2026, 10, 1, 9, 0),
  Date.UTC(2027, 1, 28, 15, 45),
];

describe.each(RUNS)('demo backup generated at %d', (now) => {
  const json = JSON.stringify(demo.buildDemoBackup(now));
  const parsed = parseBackup(json);

  it('passes the app backup parser with nothing skipped', () => {
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.skippedSessions).toBe(0);
    expect(parsed.skippedExams).toBe(0);
    expect(parsed.skippedTargets).toBe(0);
    const raw = JSON.parse(json);
    expect(parsed.file.sessions).toHaveLength(raw.sessions.length);
    expect(parsed.file.exams).toHaveLength(raw.exams.length);
    expect(parsed.file.topicProgress).toHaveLength(raw.topicProgress.length);
    expect(parsed.file.settings.dailyGoalMinutes).toBe(180);
    expect(parsed.file.profile).toEqual({ birthYear: expect.any(Number), examType: 'YKS', yksArea: 'sayisal' });
  });

  it('has sessions only in the last weeks and none in the future', () => {
    if (!parsed.ok) throw new Error('not parsed');
    const { sessions } = parsed.file;
    expect(sessions.length).toBeGreaterThan(60);
    for (const s of sessions) {
      expect(s.endedAt).toBeLessThanOrEqual(now);
      expect(s.startedAt).toBeGreaterThan(now - 30 * DAY_MS);
    }
    expect(sessions.filter((s) => s.questions !== undefined).length).toBeGreaterThan(sessions.length / 2);
  });

  it('has a long streak on the daily goal', () => {
    if (!parsed.ok) throw new Error('not parsed');
    const today = istanbulDayKey(now);
    const days = Array.from({ length: 40 }, (_, i) => addDays(today, -i));
    const totals = new Map(dailyTotals(parsed.file.sessions, days).map((d) => [d.day, d.totalMs]));
    const streak = computeStreak((d) => totals.get(d) ?? 0, today, () => 180);
    expect(streak.current).toBeGreaterThanOrEqual(14);
  });

  it('has TYT and AYT mock exams with rising nets, all analysed', () => {
    if (!parsed.ok) throw new Error('not parsed');
    for (const kind of ['TYT', 'AYT_SAY'] as const) {
      const nets = parsed.file.exams
        .filter((e) => e.kind === kind)
        .sort((a, b) => a.takenOn.localeCompare(b.takenOn))
        .map((e) => totalNet(e.scores, kind));
      expect(nets.length).toBeGreaterThanOrEqual(3);
      nets.slice(1).forEach((n, i) => expect(n).toBeGreaterThan(nets[i]));
    }
    expect(parsed.file.exams.every((e) => e.analysisDoneAt !== null && e.marks.length > 0)).toBe(true);
  });
});

it('uses only curriculum topic ids', () => {
  const ids = [
    ...Object.values(demo.TOPICS).flat(),
    ...Object.values(demo.MARK_TOPICS).flatMap((bySection) => Object.values(bySection).flat()),
    ...demo.PROGRESS.map(([id]) => id),
  ];
  const unknown = ids.filter((id) => findTopic(id) === undefined);
  expect(unknown).toEqual([]);
});
