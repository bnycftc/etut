/**
 * Example data of demo mode ("Örnek verilerle gez", `storage/demo.ts`): about four weeks of use by a
 * student who is not a real person, for the exam and YKS area of the given profile. A TypeScript
 * port of the App Store demo (`e2e/store/demo-backup.js`, YKS Sayısal only) for every exam:
 * sessions over the profile's subjects with solved-question counts and curriculum topics, mock
 * exams of the profile's papers (`examKindsFor`) with rising nets and tagged topics, topic
 * progress, weekly subject targets and net targets, and a daily goal of 2 h 30 min.
 *
 * Not every day is a study day (docs/hukuk/03: no pressure): Sunday is a rest day (one a week keeps
 * the streak going, `streak.ts`), Wednesday is lighter, a study day is 2 h 35 min to 4 h 30 min,
 * and the first week has a short day and a day off. Every date is relative to `now`; the output is
 * deterministic for a given profile and `now` (same PRNG and seed as the store demo) and passes
 * `parseBackup` with nothing skipped (src/domain/__tests__/demo-data.test.ts).
 */

import type { BackupData, BackupExam, BackupTopicProgress } from './backup';
import { topicsForSection, topicsForSubject } from './curriculum';
import { targetKey, type TopicMark } from './exam-analysis';
import { istanbulDayKey } from './istanbul-day';
import { EXAM_SECTIONS, type ExamKind, examKindsFor } from './net';
import type { Profile } from './profile';
import { subjectsFor } from './subjects';
import type { CompletedSession } from './timer';

const HOUR = 3_600_000;
const MIN = 60_000;
const DAY = 24 * HOUR;
/** Türkiye: fixed UTC+3 (same rule as istanbul-day.ts). */
const IST = 3 * HOUR;

const dayStart = (ms: number): number => {
  const d = new Date(ms + IST);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST;
};
/** 0 = Monday … 6 = Sunday (Istanbul). */
const weekday = (ms: number): number => (new Date(ms + IST).getUTCDay() + 6) % 7;

/** Small deterministic PRNG (mulberry32), as in e2e/store/demo-backup.js. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20270619;
/** Days of history before today; daily goal 2 h 30 min. */
const HISTORY_DAYS = 27;
export const DEMO_GOAL_MIN = 150;
const WEDNESDAY = 2;
const SATURDAY = 5;
const SUNDAY = 6;

/** Questions solved per minute of study (others: 0.5). */
const QUESTIONS_PER_MIN: Record<string, number> = { matematik: 0.55, fizik: 0.45, biyoloji: 0.6, turkce: 0.8 };

/** Timer subject of a mock-exam section (`tarih1` → `tarih`, `felsefe_grubu` → `felsefe`). */
function subjectOfSection(sectionId: string): string {
  if (sectionId === 'felsefe_grubu') return 'felsefe';
  return sectionId.replace(/\d+$/, '');
}

interface Plan {
  /** Subjects with their share of study time, largest first. */
  weights: [string, number][];
  /** Topics a session of the subject may be on (the first part of its curriculum). */
  studied: Map<string, readonly string[]>;
  kinds: ExamKind[];
}

function makePlan(profile: Profile): Plan {
  const { examType, yksArea } = profile;
  const subjects = subjectsFor(examType, yksArea).filter((id) => id !== 'diger');
  const kinds = examKindsFor(examType, yksArea);
  // Share of study time: the subject's questions on the student's papers (geometry is a quarter
  // of the mathematics test), at least a little for every subject.
  const questions = new Map<string, number>();
  for (const kind of kinds) {
    for (const s of EXAM_SECTIONS[kind]) {
      const id = subjectOfSection(s.id);
      questions.set(id, (questions.get(id) ?? 0) + s.questions);
    }
  }
  if (subjects.includes('geometri') && questions.has('matematik')) {
    const m = questions.get('matematik')!;
    questions.set('geometri', (questions.get('geometri') ?? 0) + Math.round(m / 4));
    questions.set('matematik', m - Math.round(m / 4));
  }
  const weights = subjects
    .map((id, i): [string, number, number] => [id, Math.max(2, questions.get(id) ?? 0), i])
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .map(([id, w]): [string, number] => [id, w]);
  const studied = new Map<string, readonly string[]>();
  for (const id of subjects) {
    const topics = topicsForSubject(examType, yksArea, id).map((t) => t.id);
    studied.set(id, topics.slice(0, Math.max(3, Math.ceil(topics.length * 0.45))));
  }
  return { weights, studied, kinds };
}

function pickSubject(r: () => number, weights: [string, number][], avoid: string | null): string {
  if (weights.length === 1) return weights[0][0];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  for (;;) {
    let x = r() * total;
    for (const [id, w] of weights) {
      x -= w;
      if (x <= 0) {
        if (id !== avoid) return id;
        break;
      }
    }
  }
}

function buildSessions(now: number, r: () => number, plan: Plan): CompletedSession[] {
  const sessions: CompletedSession[] = [];
  let n = 0;
  const add = (subjectId: string, startedAt: number, minutes: number, withQuestions = r() < 0.85): number => {
    const durationMs = minutes * MIN + Math.floor(r() * 50) * 1000;
    const topics = plan.studied.get(subjectId) ?? [];
    const s: CompletedSession = {
      id: `demo-s-${String(++n).padStart(3, '0')}`,
      subjectId,
      topicId: topics.length > 0 && r() < 0.75 ? topics[Math.floor(r() * topics.length)] : null,
      startedAt,
      endedAt: startedAt + durationMs,
      pauses: [],
      durationMs,
      source: 'timer',
    };
    if (withQuestions) {
      const rate = QUESTIONS_PER_MIN[subjectId] ?? 0.5;
      s.questions = Math.max(5, Math.round(minutes * rate * (0.8 + r() * 0.4)));
    }
    sessions.push(s);
    return s.endedAt;
  };

  const top = plan.weights.map(([id]) => id);
  const first = top[0];
  const second = top[1] ?? first;
  const today = dayStart(now);
  const sunday = (back: number) => weekday(today - back * DAY) === SUNDAY;
  // The first week with the app: a short day (under an hour) and a day off. The streak starts
  // after the short day; from then on only the Sundays are missed, one a week, which the streak
  // keeps (streak.ts).
  let shortDay = 20;
  while (sunday(shortDay)) shortDay++;
  let missedDay = 24;
  while (sunday(missedDay)) missedDay++;
  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const start = today - back * DAY;
    const day = weekday(start);
    if (day === SUNDAY || back === missedDay) continue;
    const short = back === shortDay;
    // Wednesday is lighter but still reaches the goal (a second missed day in a week would end
    // the streak); Saturday is the long day.
    const total = short
      ? 45
      : day === WEDNESDAY
        ? DEMO_GOAL_MIN + 5 + Math.round(r() * 15)
        : day === SATURDAY
          ? 210 + Math.round(r() * 60)
          : DEMO_GOAL_MIN + 10 + Math.round(r() * 65);
    const count = short ? 1 : total > 200 ? 4 : 3;
    // Sessions of random length that add up to the day's total exactly.
    const weights = Array.from({ length: count }, () => 0.75 + r() * 0.5);
    const sum = weights.reduce((a, b) => a + b, 0);
    const minutes = weights.map((w) => Math.max(25, Math.round((total * w) / sum)));
    minutes[count - 1] += total - minutes.reduce((a, b) => a + b, 0);
    let t = start + (day === SATURDAY ? 10 * HOUR : 16.5 * HOUR) + Math.round(r() * 40) * MIN;
    let last: string | null = null;
    for (let i = 0; i < minutes.length; i++) {
      const subject: string = i === 0 && !short ? (r() < 0.6 ? first : second) : pickSubject(r, plan.weights, last);
      t = add(subject, t, minutes[i]) + (10 + Math.round(r() * 20)) * MIN;
      last = subject;
    }
  }

  // Today: about two hours, finished a quarter of an hour before `now` (never in the future).
  const end = now - 15 * MIN;
  const todayPlan: [string, number][] = [
    [first, 55],
    [second, 40],
    [top[2] ?? first, 35],
  ];
  const needed = todayPlan.reduce((s, [, m]) => s + m + 12, 0) * MIN;
  let t = Math.max(today + 5 * MIN, end - needed);
  for (const [subject, minutes] of todayPlan) {
    if (t + (minutes + 1) * MIN > end) break;
    t = add(subject, t, minutes, true) + 12 * MIN;
  }
  return sessions;
}

/** Tags most wrong answers and about half of the blanks with up to three topics, the first the most. */
function marksFor(kind: ExamKind, sectionId: string, wrong: number, blank: number, r: () => number): TopicMark[] {
  const all = topicsForSection(kind, sectionId).map((t) => t.id);
  if (all.length === 0) return [];
  // Topics from the part of the curriculum a student has met by now, in a fixed random order.
  const pool = all.slice(0, Math.max(3, Math.ceil(all.length * 0.6)));
  const topics: string[] = [];
  while (topics.length < Math.min(3, pool.length)) {
    const id = pool[Math.floor(r() * pool.length)];
    if (!topics.includes(id)) topics.push(id);
  }
  const marks: TopicMark[] = [];
  let w = wrong;
  let b = Math.floor(blank / 2);
  topics.forEach((topicId, j) => {
    const last = j === topics.length - 1;
    const tw = last ? w : Math.min(w, Math.ceil(w / 2));
    const tb = last ? b : Math.min(b, Math.ceil(b / 2));
    w -= tw;
    b -= tb;
    if (tw + tb > 0) marks.push({ sectionId, topicId, wrong: tw, blank: tb });
  });
  return marks;
}

/** Days back of each paper's exams: the general paper (TYT, LGS, KPSS) four, AYT/YDT three. */
const MAIN_PAPER_DAYS = [24, 17, 10, 3];
const SECOND_PAPER_DAYS = [20, 13, 6];

function buildExams(now: number, r: () => number, plan: Plan): BackupExam[] {
  const today = dayStart(now);
  const exams: BackupExam[] = [];
  plan.kinds.forEach((kind, k) => {
    const days = k === 0 ? MAIN_PAPER_DAYS : SECOND_PAPER_DAYS;
    const sections = EXAM_SECTIONS[kind];
    // A fixed strength per section; the share of correct answers rises from exam to exam and the
    // share of wrong ones falls, so every total net is higher than the one before.
    const strength = sections.map(() => (r() - 0.5) * 0.16);
    days.forEach((back, i) => {
      const progress = i / (days.length - 1);
      const day = today - back * DAY;
      const createdAt = day + 19 * HOUR;
      const scores = sections.map((s, j) => {
        const share = Math.min(0.92, Math.max(0.2, 0.52 + 0.26 * progress + strength[j]));
        const correct = Math.round(s.questions * share);
        const wrong = Math.min(s.questions - correct, Math.round(s.questions * (0.2 - 0.08 * progress)));
        return { sectionId: s.id, questions: s.questions, correct, wrong };
      });
      exams.push({
        id: `demo-e-${kind.toLowerCase().replace(/_/g, '-')}-${i + 1}`,
        kind,
        scope: 'genel',
        bransSectionId: null,
        takenOn: istanbulDayKey(day),
        createdAt,
        analysisDoneAt: createdAt + 40 * MIN,
        scores,
        marks: scores.flatMap((s) =>
          marksFor(kind, s.sectionId, s.wrong, s.questions - s.correct - s.wrong, r),
        ),
      });
    });
  });
  return exams.sort((a, b) => a.createdAt - b.createdAt);
}

/** About a third of each subject's topics done, the next one or two marked for review. */
function buildTopicProgress(now: number, profile: Profile, plan: Plan): BackupTopicProgress[] {
  const marks: [string, 'done' | 'review'][] = [];
  const seen = new Set<string>();
  for (const [subjectId] of plan.weights) {
    const topics = topicsForSubject(profile.examType, profile.yksArea, subjectId).map((t) => t.id);
    const done = Math.floor(topics.length * 0.35);
    const review = topics.length > 3 ? 2 : topics.length > 1 ? 1 : 0;
    topics.slice(0, done + review).forEach((id, i) => {
      if (seen.has(id)) return;
      seen.add(id);
      marks.push([id, i < done ? 'done' : 'review']);
    });
  }
  const from = dayStart(now) - 25 * DAY;
  const span = 24 * DAY;
  return marks.map(([topicId, status], i) => ({
    topicId,
    status,
    updatedAt: from + Math.round((span * i) / marks.length) + 21 * HOUR,
  }));
}

/** Target nets: the two largest sections of each paper, about 85 % of their questions. */
function buildNetTargets(plan: Plan): Record<string, number> {
  const targets: Record<string, number> = {};
  for (const kind of plan.kinds) {
    const largest = [...EXAM_SECTIONS[kind]].sort((a, b) => b.questions - a.questions).slice(0, 2);
    for (const s of largest) targets[targetKey(kind, s.id)] = Math.round(s.questions * 0.85 * 4) / 4;
  }
  return targets;
}

/** Weekly minutes for the six largest subjects: their share of about 17 h 30 min, in 30-minute steps. */
function buildSubjectTargets(plan: Plan): Record<string, number> {
  const total = plan.weights.reduce((s, [, w]) => s + w, 0);
  const targets: Record<string, number> = {};
  for (const [id, w] of plan.weights.slice(0, 6)) {
    targets[id] = Math.min(2400, Math.max(60, Math.round(((1050 * w) / total) / 30) * 30));
  }
  return targets;
}

/** Example data for `profile` at `now` (see the file comment). */
export function buildDemoData(profile: Profile, now: number): BackupData {
  const r = rng(SEED);
  const plan = makePlan(profile);
  return {
    sessions: buildSessions(now, r, plan),
    exams: buildExams(now, r, plan),
    topicProgress: buildTopicProgress(now, profile, plan),
    settings: {
      dailyGoalMinutes: DEMO_GOAL_MIN,
      pomodoro: null,
      timerMode: 'stopwatch',
      examDates: {},
      netTargets: buildNetTargets(plan),
      lastSubject: plan.weights[0][0],
      subjectWeeklyTargets: buildSubjectTargets(plan),
    },
  };
}
