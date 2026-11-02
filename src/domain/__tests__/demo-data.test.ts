/**
 * Example data of demo mode (domain/demo-data.ts) for every exam and YKS area: it is restored
 * through the app's own backup writer, so it must pass the backup parser with nothing left out,
 * fill the analysis screens of that exam, and look like weeks of real use with breaks
 * (docs/hukuk/03: no pressure), the same shape as the App Store demo (store-demo-backup.test.ts).
 */

import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, parseBackup } from '../backup';
import { findTopic } from '../curriculum';
import { dailyTotals } from '../daily-totals';
import { buildDemoData, DEMO_GOAL_MIN } from '../demo-data';
import { addDays, DAY_MS, istanbulDayKey } from '../istanbul-day';
import { EXAM_SECTIONS, examKindsFor, totalNet, type YksArea } from '../net';
import type { ExamType, Profile } from '../profile';
import { subjectMissedTopics } from '../report-card';
import { computeStreak, goalMet, weekStartOf } from '../streak';
import { subjectsFor } from '../subjects';

const PROFILES: [ExamType, YksArea | null][] = [
  ['YKS', 'sayisal'],
  ['YKS', 'esit_agirlik'],
  ['YKS', 'sozel'],
  ['YKS', 'dil'],
  ['YKS', null],
  ['LGS', null],
  ['KPSS', null],
  ['DIGER', null],
];
const RUNS = [Date.UTC(2026, 9, 12, 7, 30), Date.UTC(2026, 10, 1, 21, 10), Date.UTC(2027, 1, 28, 15, 45)];

const profileOf = (examType: ExamType, yksArea: YksArea | null): Profile => ({
  birthYear: 2008,
  examType,
  yksArea,
  soloOnly: false,
  createdAt: Date.UTC(2026, 0, 1),
});

const asFile = (now: number, profile: Profile) =>
  JSON.stringify({
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    appVersion: 'demo',
    // The profile is not part of the data (demo mode keeps the student's own); YKS without an
    // area is no valid file profile but still a stored one (before areas existed).
    profile: null,
    ...buildDemoData(profile, now),
  });

describe.each(PROFILES)('demo data for %s / %s', (examType, yksArea) => {
  const profile = profileOf(examType, yksArea);

  describe.each(RUNS)('at %d', (now) => {
    const data = buildDemoData(profile, now);
    const parsed = parseBackup(asFile(now, profile));
    if (!parsed.ok) throw new Error(`not parsed: ${parsed.error}`);
    const file = parsed.file;

    it('passes the backup parser with nothing skipped', () => {
      expect(parsed.skippedSessions).toBe(0);
      expect(parsed.skippedExams).toBe(0);
      expect(parsed.skippedTargets).toBe(0);
      expect(file.sessions).toEqual(data.sessions);
      expect(file.exams).toEqual(data.exams);
      expect(file.topicProgress).toEqual(data.topicProgress);
      expect(file.settings).toEqual(data.settings);
    });

    it('is deterministic', () => {
      expect(buildDemoData(profile, now)).toEqual(data);
    });

    it("uses only the profile's subjects, papers and curriculum topics", () => {
      const subjects = subjectsFor(examType, yksArea);
      expect(file.sessions.every((s) => subjects.includes(s.subjectId))).toBe(true);
      expect(new Set(file.exams.map((e) => e.kind))).toEqual(new Set(examKindsFor(examType, yksArea)));
      const topicIds = [
        ...file.sessions.flatMap((s) => (s.topicId === null ? [] : [s.topicId])),
        ...file.exams.flatMap((e) => e.marks.map((m) => m.topicId)),
        ...file.topicProgress.map((t) => t.topicId),
      ];
      expect(topicIds.filter((id) => findTopic(id) === undefined)).toEqual([]);
      expect(Object.keys(file.settings.subjectWeeklyTargets ?? {}).every((id) => subjects.includes(id))).toBe(true);
      expect(subjects).toContain(file.settings.lastSubject);
    });

    it('has sessions only in the last weeks and none in the future', () => {
      expect(file.sessions.length).toBeGreaterThan(60);
      for (const s of file.sessions) {
        expect(s.endedAt).toBeLessThanOrEqual(now);
        expect(s.startedAt).toBeGreaterThan(now - 30 * DAY_MS);
      }
      expect(file.sessions.filter((s) => s.questions !== undefined).length).toBeGreaterThan(file.sessions.length / 2);
      expect(new Set(file.sessions.map((s) => s.subjectId)).size).toBeGreaterThanOrEqual(
        Math.min(4, subjectsFor(examType, yksArea).length - 1),
      );
    });

    it('has a long streak on the daily goal', () => {
      const today = istanbulDayKey(now);
      const days = Array.from({ length: 40 }, (_, i) => addDays(today, -i));
      const totals = new Map(dailyTotals(file.sessions, days).map((d) => [d.day, d.totalMs]));
      const streak = computeStreak((d) => totals.get(d) ?? 0, today, () => DEMO_GOAL_MIN);
      expect(streak.current).toBeGreaterThanOrEqual(14);
    });

    it('takes breaks: a day off in every week, lighter days, no very long day', () => {
      const today = istanbulDayKey(now);
      const past = Array.from({ length: 28 }, (_, i) => addDays(today, -1 - i));
      const totals = new Map(dailyTotals(file.sessions, past).map((d) => [d.day, d.totalMs]));
      const ms = (d: string) => totals.get(d) ?? 0;
      for (let i = 0; i + 7 <= 21; i++) expect(past.slice(i, i + 7).some((d) => ms(d) === 0)).toBe(true);
      const lastWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(today), i - 7));
      expect(lastWeek.filter((d) => ms(d) > 0).length).toBeLessThan(7);
      expect(lastWeek.filter((d) => goalMet(ms(d), DEMO_GOAL_MIN)).length).toBeLessThan(7);
      const studied = past.slice(0, 14).map(ms).filter((t) => t > 0);
      expect(Math.min(...studied)).toBeLessThan(3 * 3_600_000);
      expect(Math.max(...studied)).toBeGreaterThan(3.5 * 3_600_000);
      expect(Math.max(...past.map(ms))).toBeLessThan(280 * 60_000);
    });

    it('has mock exams of every paper with rising nets, analysed and tagged', () => {
      for (const kind of examKindsFor(examType, yksArea)) {
        const nets = file.exams
          .filter((e) => e.kind === kind)
          .sort((a, b) => a.takenOn.localeCompare(b.takenOn))
          .map((e) => totalNet(e.scores, kind));
        expect(nets.length).toBeGreaterThanOrEqual(3);
        nets.slice(1).forEach((n, i) => expect(n).toBeGreaterThan(nets[i]));
      }
      expect(file.exams.every((e) => e.analysisDoneAt !== null && e.marks.length > 0)).toBe(true);
    });

    it('fills the targets and the report card of the first subject', () => {
      expect(file.settings.dailyGoalMinutes).toBe(DEMO_GOAL_MIN);
      expect(Object.keys(file.settings.subjectWeeklyTargets ?? {}).length).toBeGreaterThan(0);
      if (examType === 'DIGER') {
        // "Diğer" has no paper and no topic list: sessions and targets only.
        expect(file.exams).toEqual([]);
        expect(file.topicProgress).toEqual([]);
        expect(file.settings.netTargets).toEqual({});
        return;
      }
      expect(file.topicProgress.length).toBeGreaterThan(0);
      for (const kind of examKindsFor(examType, yksArea)) {
        expect(Object.keys(file.settings.netTargets).some((k) => k.startsWith(`${kind}:`))).toBe(true);
        for (const [key, target] of Object.entries(file.settings.netTargets)) {
          const [k, sectionId] = key.split(':');
          expect(target).toBeLessThanOrEqual(EXAM_SECTIONS[k as keyof typeof EXAM_SECTIONS].find((s) => s.id === sectionId)!.questions);
        }
      }
      const marks = file.exams.flatMap((e) =>
        e.marks.map((m) => ({ ...m, examId: e.id, takenOn: e.takenOn, createdAt: e.createdAt })),
      );
      const subject = file.settings.lastSubject!;
      expect(subjectMissedTopics(marks, subject, {}).length).toBeGreaterThanOrEqual(3);
    });
  });
});

it('gives the subjects of the area the largest share of study time', () => {
  const now = RUNS[0];
  const minutes = (area: YksArea) => {
    const out = new Map<string, number>();
    for (const s of buildDemoData(profileOf('YKS', area), now).sessions) {
      out.set(s.subjectId, (out.get(s.subjectId) ?? 0) + s.durationMs);
    }
    return [...out.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  expect(minutes('sayisal')).toBe('matematik');
  expect(minutes('sozel')).toBe('turkce');
  expect(minutes('dil')).toBe('yabanci_dil');
});
