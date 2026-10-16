/**
 * The demo backup of the App Store screenshot run (e2e/store/demo-backup.js) is restored through
 * the app's own import, so it must pass the app's own backup parser with nothing left out, and
 * look like weeks of real use relative to the run date: with breaks, not a student who studies
 * every day (docs/hukuk/03: no pressure), and a streak that the app's own rule keeps.
 */

import { parseBackup } from '../backup';
import { findTopic } from '../curriculum';
import { dailyTotals } from '../daily-totals';
import { addDays, DAY_MS, istanbulDayKey } from '../istanbul-day';
import { addMonths, monthStartOf, monthView } from '../month-calendar';
import { totalNet } from '../net';
import { subjectMissedTopics } from '../report-card';
import { computeStreak, goalMet, weekStartOf } from '../streak';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const demo = require('../../../e2e/store/demo-backup.js') as {
  buildDemoBackup: (now: number) => unknown;
  TOPICS: Record<string, string[]>;
  MARK_TOPICS: Record<string, Record<string, string[]>>;
  PROGRESS: [string, string][];
};

// Different run times: early morning (little of today left), midday, late evening, a month start,
// the first day the flow shows the current month (the 10th).
const RUNS = [
  Date.UTC(2026, 9, 12, 7, 30),
  Date.UTC(2026, 9, 12, 23, 10),
  Date.UTC(2026, 10, 1, 9, 0),
  Date.UTC(2026, 11, 10, 9, 0),
  Date.UTC(2027, 1, 28, 15, 45),
];
const GOAL = 150;

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
    expect(parsed.file.settings.dailyGoalMinutes).toBe(GOAL);
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
    const streak = computeStreak((d) => totals.get(d) ?? 0, today, () => GOAL);
    expect(streak.current).toBeGreaterThanOrEqual(14);
  });

  it('takes breaks: a day without study in every week, lighter days, no very long day', () => {
    if (!parsed.ok) throw new Error('not parsed');
    const today = istanbulDayKey(now);
    const past = Array.from({ length: 28 }, (_, i) => addDays(today, -1 - i));
    const totals = new Map(dailyTotals(parsed.file.sessions, past).map((d) => [d.day, d.totalMs]));
    const ms = (d: string) => totals.get(d) ?? 0;
    // Any seven days in a row (the last three weeks) hold a day off.
    for (let i = 0; i + 7 <= 21; i++) expect(past.slice(i, i + 7).some((d) => ms(d) === 0)).toBe(true);
    // The weekly summary of the store flow shows last week: not 7 of 7.
    const lastWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(today), i - 7));
    expect(lastWeek.filter((d) => ms(d) > 0).length).toBeLessThan(7);
    expect(lastWeek.filter((d) => goalMet(ms(d), GOAL)).length).toBeLessThan(7);
    // Study days differ in length, the longest stays under 4 h 40 min.
    const studied = past.slice(0, 14).map(ms).filter((t) => t > 0);
    expect(Math.min(...studied)).toBeLessThan(3 * 3_600_000);
    expect(Math.max(...studied)).toBeGreaterThan(3.5 * 3_600_000);
    expect(Math.max(...past.map(ms))).toBeLessThan(280 * 60_000);
  });

  it('shades the month the store flow shows in at least three levels, with days off', () => {
    if (!parsed.ok) throw new Error('not parsed');
    const today = istanbulDayKey(now);
    // e2e/store/screenshots.yaml: the previous month before the 10th, else the current one.
    const month = Number(today.slice(8, 10)) < 10 ? addMonths(monthStartOf(today), -1) : monthStartOf(today);
    const view = monthView(parsed.file.sessions, month, today);
    const levels = new Set(view.days.filter((d) => !d.future).map((d) => d.level));
    expect(levels.size).toBeGreaterThanOrEqual(3);
    expect(view.restDays).toBeGreaterThan(0);
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

  it('fills the most missed topics of the Matematik report card (frame 03) within the recent-exam window', () => {
    if (!parsed.ok) throw new Error('not parsed');
    const marks = parsed.file.exams.flatMap((e) =>
      e.marks.map((m) => ({ ...m, examId: e.id, takenOn: e.takenOn, createdAt: e.createdAt })),
    );
    expect(subjectMissedTopics(marks, 'matematik', {}).length).toBeGreaterThanOrEqual(3);
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
