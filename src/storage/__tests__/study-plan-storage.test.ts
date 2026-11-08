/**
 * @jest-environment node
 *
 * storage/study-plan.ts: the availability in the key-value store (an in-memory stand-in for
 * `kvStore()`), and the plan built from the stored data (the other stores replaced by fakes).
 */

import { dayStartMs } from '../../domain/istanbul-day';
import { buildWeekPlan, defaultAvailability } from '../../domain/study-plan';
import type { CompletedSession } from '../../domain/timer';
import {
  availabilityOrDefault,
  currentWeekPlan,
  loadAvailability,
  saveAvailability,
  studiedThisWeek,
  todaysPlan,
  weekStartFor,
} from '../study-plan';

const mockKv = new Map<string, string>();
const mockData = {
  goal: null as number | null,
  sessions: [] as CompletedSession[],
  marks: {} as Record<string, 'done' | 'review'>,
};

jest.mock('../kv-store', () => ({
  kvStore: () => ({
    getItemSync: (k: string) => mockKv.get(k) ?? null,
    setItemSync: (k: string, v: string) => {
      mockKv.set(k, v);
    },
    removeItemSync: (k: string) => {
      mockKv.delete(k);
    },
  }),
}));
jest.mock('../kv', () => ({
  loadDailyGoal: () => mockData.goal,
  loadCustomExamDate: () => null,
}));
jest.mock('../sessions', () => ({
  sessionsOverlapping: (from: number, to: number) =>
    mockData.sessions.filter((s) => s.endedAt > from && s.startedAt < to),
}));
jest.mock('../topics', () => ({ loadTopicStatuses: () => mockData.marks }));
jest.mock('../mock-exams', () => ({ listAllMarks: () => [] }));
jest.mock('../subject-targets', () => ({ loadSubjectTargets: () => ({}) }));

const AVAILABILITY = { 0: 90, 1: 60, 2: 0, 3: 120, 4: 45, 5: 180, 6: 30 } as const;
// Wednesday 4 November 2026, 12:00 Istanbul.
const NOW = Date.parse('2026-11-04T09:00:00Z');
const YKS = { examType: 'YKS', yksArea: 'sayisal' } as const;

function session(id: string, subjectId: string, day: string, minutes: number): CompletedSession {
  const startedAt = dayStartMs(day) + 10 * 3_600_000;
  return { id, subjectId, topicId: null, startedAt, endedAt: startedAt + minutes * 60_000, pauses: [], durationMs: minutes * 60_000, source: 'timer' };
}

beforeEach(() => {
  mockKv.clear();
  mockData.goal = null;
  mockData.sessions = [];
  mockData.marks = {};
});

describe('availability', () => {
  it('is null until set, then reads back exactly; null removes it', () => {
    expect(loadAvailability()).toBeNull();
    saveAvailability({ ...AVAILABILITY });
    expect(loadAvailability()).toEqual(AVAILABILITY);
    saveAvailability(null);
    expect(loadAvailability()).toBeNull();
  });

  it('without one the default follows the daily goal', () => {
    expect(availabilityOrDefault()).toEqual(defaultAvailability(null));
    mockData.goal = 150;
    expect(availabilityOrDefault()).toEqual(defaultAvailability(150));
    saveAvailability({ ...AVAILABILITY });
    expect(availabilityOrDefault()).toEqual(AVAILABILITY);
  });

  it('a damaged or out-of-range value reads as none (the default is used)', () => {
    mockKv.set('etut.studyAvailability.v1', '{not json');
    expect(loadAvailability()).toBeNull();
    mockKv.set('etut.studyAvailability.v1', JSON.stringify({ ...AVAILABILITY, 3: 999 }));
    expect(loadAvailability()).toBeNull();
    mockKv.set('etut.studyAvailability.v1', JSON.stringify({ 0: 60 }));
    expect(loadAvailability()).toBeNull();
  });
});

describe('plan from the stored data', () => {
  it('the week starts on Monday (Istanbul)', () => {
    expect(weekStartFor('2026-11-04')).toBe('2026-11-02');
    expect(weekStartFor('2026-11-02')).toBe('2026-11-02');
    expect(weekStartFor('2026-11-08')).toBe('2026-11-02');
  });

  it('uses the stored availability and adds up to it', () => {
    saveAvailability({ ...AVAILABILITY });
    const plan = currentWeekPlan(YKS, NOW);
    expect(plan.weekStart).toBe('2026-11-02');
    expect(plan.totalMinutes).toBe(90 + 60 + 120 + 45 + 180 + 30);
    expect(plan.blocks.some((b) => b.day === 2)).toBe(false);
    // Without any data every block of a curriculum exam has a real topic.
    expect(plan.blocks.every((b) => b.topicId !== null)).toBe(true);
  });

  it('study before today shapes the week; today’s study only ticks today’s blocks off', () => {
    saveAvailability({ ...AVAILABILITY });
    mockData.sessions = [
      session('a', 'matematik', '2026-11-02', 120), // Monday
      session('b', 'fizik', '2026-11-04', 600), // today
      session('c', 'kimya', '2026-10-30', 300), // last week: not counted
    ];
    const studied = studiedThisWeek('2026-11-04');
    expect(studied).toEqual({ beforeToday: { matematik: 120 }, today: { fizik: 600 } });

    const plan = currentWeekPlan(YKS, NOW);
    const expected = buildWeekPlan({
      examType: 'YKS',
      yksArea: 'sayisal',
      examDay: plan.daysLeft === null ? null : null,
      weekStart: '2026-11-02',
      availability: { ...AVAILABILITY },
      topicMarks: {},
      missedTopics: [],
      subjectTargets: {},
      studiedThisWeekBySubject: { matematik: 120 },
    });
    expect(plan.blocks.map((b) => b.subjectId)).toEqual(expected.blocks.map((b) => b.subjectId));
  });

  it('today: Wednesday is a rest day here, so no blocks', () => {
    saveAvailability({ ...AVAILABILITY });
    expect(todaysPlan(YKS, NOW)).toEqual({ blocks: [], done: 0 });
  });

  it('today: blocks of today with done flags from today’s study', () => {
    saveAvailability({ ...AVAILABILITY, 2: 120 });
    const first = todaysPlan(YKS, NOW);
    expect(first.blocks.length).toBeGreaterThan(0);
    expect(first.blocks.every((b) => b.day === 2)).toBe(true);
    expect(first.done).toBe(0);
    const subject = first.blocks[0].subjectId;
    mockData.sessions = [session('t', subject, '2026-11-04', 120)];
    const after = todaysPlan(YKS, NOW);
    // Same blocks (today's study does not move them), the first one ticked off.
    expect(after.blocks.map((b) => [b.subjectId, b.topicId])).toEqual(first.blocks.map((b) => [b.subjectId, b.topicId]));
    expect(after.blocks[0].done).toBe(true);
    expect(after.done).toBeGreaterThan(0);
  });
});
