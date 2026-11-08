import { findTopic, topicsForSubject } from '../curriculum';
import { addDays, istanbulWeekday } from '../istanbul-day';
import type { YksArea } from '../net';
import type { ExamType } from '../profile';
import {
  AVAILABILITY_MAX_MIN,
  type Availability,
  type BuildWeekPlanInput,
  buildWeekPlan,
  defaultAvailability,
  phaseFor,
  planReason,
  todayBlocks,
  type WeekPlan,
  type Weekday,
} from '../study-plan';
import { subjectsFor } from '../subjects';
import type { TopicStatus } from '../topics';

const WEEK_START = '2026-11-02'; // Monday

/** A week with an unrepresentable day (70), a short day (25) and a rest day (0). */
const AVAILABILITY: Availability = { 0: 70, 1: 90, 2: 50, 3: 130, 4: 25, 5: 180, 6: 0 };

function planInput(
  examType: ExamType,
  yksArea: YksArea | null = null,
  overrides: Partial<BuildWeekPlanInput> = {},
): BuildWeekPlanInput {
  return {
    examType,
    yksArea,
    examDay: addDays(WEEK_START, 100),
    weekStart: WEEK_START,
    availability: AVAILABILITY,
    topicMarks: {},
    missedTopics: [],
    subjectTargets: {},
    studiedThisWeekBySubject: {},
    ...overrides,
  };
}

const EXAM_CASES: Array<[string, BuildWeekPlanInput]> = [
  ['YKS sayısal', planInput('YKS', 'sayisal')],
  ['YKS eşit ağırlık', planInput('YKS', 'esit_agirlik')],
  ['YKS sözel', planInput('YKS', 'sozel')],
  ['LGS', planInput('LGS')],
  ['KPSS', planInput('KPSS')],
];

describe('buildWeekPlan', () => {
  it.each(EXAM_CASES)('%s: days add up, blocks are 25–60, subjects and topics are real', (_name, input) => {
    const plan = buildWeekPlan(input);
    const subjects = new Set(subjectsFor(input.examType, input.yksArea));

    for (const day of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
      const minutes = plan.blocks
        .filter((block) => block.day === day)
        .reduce((sum, block) => sum + block.minutes, 0);
      expect(minutes).toBe(input.availability[day]);
    }

    for (const block of plan.blocks) {
      expect(block.minutes).toBeGreaterThanOrEqual(25);
      expect(block.minutes).toBeLessThanOrEqual(60);
      expect(subjects.has(block.subjectId)).toBe(true);
      if (block.topicId !== null) expect(findTopic(block.topicId)).toBeDefined();
    }

    expect(plan.totalMinutes).toBe(plan.blocks.reduce((sum, block) => sum + block.minutes, 0));
  });

  it('is deterministic', () => {
    const input = planInput('YKS', 'sayisal');
    expect(buildWeekPlan(input)).toEqual(buildWeekPlan(input));
  });

  it('review phase puts exactly one exam-day block on Saturday', () => {
    const input = planInput('YKS', 'sayisal', { examDay: addDays(WEEK_START, 30) });
    const plan = buildWeekPlan(input);
    const saturday = plan.blocks.filter((block) => block.day === 5);
    const examDay = saturday.filter((block) => block.reason === 'exam-day');
    expect(examDay).toHaveLength(1);
    expect(examDay[0].topicId).toBeNull();
    expect(saturday.reduce((sum, block) => sum + block.minutes, 0)).toBe(input.availability[5]);
  });

  it('review phase plans a review-marked topic before the next topic', () => {
    const topics = topicsForSubject('YKS', 'sayisal', 'matematik');
    const [reviewed, next] = topics;
    const marks: Record<string, TopicStatus> = {};
    for (const topic of topics) marks[topic.id] = 'done';
    marks[reviewed.id] = 'review';
    delete marks[next.id];

    const plan = buildWeekPlan(
      planInput('YKS', 'sayisal', {
        examDay: addDays(WEEK_START, 30),
        topicMarks: marks,
      }),
    );
    const mathBlocks = plan.blocks.filter((block) => block.subjectId === 'matematik');
    const firstReview = mathBlocks.findIndex((block) => block.reason === 'review');
    const firstNext = mathBlocks.findIndex((block) => block.reason === 'next');
    expect(firstReview).toBeGreaterThanOrEqual(0);
    expect(firstNext).toBeGreaterThan(firstReview);
  });

  it('DIGER has no curriculum, so every block is a subject-only balance block', () => {
    const plan = buildWeekPlan(planInput('DIGER'));
    expect(plan.blocks.length).toBeGreaterThan(0);
    for (const block of plan.blocks) {
      expect(block.topicId).toBeNull();
      expect(block.reason).toBe('balance');
    }
  });
});

describe('phaseFor', () => {
  it('follows the 180/60 day boundaries', () => {
    expect(phaseFor(181)).toBe('learn');
    expect(phaseFor(180)).toBe('mixed');
    expect(phaseFor(60)).toBe('mixed');
    expect(phaseFor(59)).toBe('review');
    expect(phaseFor(null)).toBe('learn');
    expect(phaseFor(-1)).toBe('review');
  });
});

describe('defaultAvailability', () => {
  it('uses a positive goal Monday–Saturday and keeps Sunday off', () => {
    const week = defaultAvailability(90);
    expect([0, 1, 2, 3, 4, 5].map((day) => week[day as Weekday])).toEqual([90, 90, 90, 90, 90, 90]);
    expect(week[6]).toBe(0);
  });

  it('caps a goal above 8 hours at the editor limit (480), so the week can be stored and edited', () => {
    const week = defaultAvailability(600);
    expect([0, 1, 2, 3, 4, 5].map((day) => week[day as Weekday])).toEqual([480, 480, 480, 480, 480, 480]);
    expect(week[6]).toBe(0);
    expect(AVAILABILITY_MAX_MIN).toBe(480);
  });

  it('falls back to 120 on school days and 180 at the weekend', () => {
    const week = defaultAvailability(null);
    expect([0, 1, 2, 3, 4].map((day) => week[day as Weekday])).toEqual([120, 120, 120, 120, 120]);
    expect([week[5], week[6]]).toEqual([180, 180]);
  });
});

describe('todayBlocks', () => {
  const plan: WeekPlan = {
    weekStart: WEEK_START,
    phase: 'learn',
    daysLeft: 100,
    totalMinutes: 70,
    blocks: [
      { day: 0, subjectId: 'matematik', topicId: null, minutes: 30, reason: 'balance' },
      { day: 0, subjectId: 'matematik', topicId: null, minutes: 40, reason: 'balance' },
    ],
  };

  it('marks the blocks covered by the time studied today', () => {
    expect(istanbulWeekday(WEEK_START)).toBe(0);
    expect(todayBlocks(plan, WEEK_START, { matematik: 45 }).map((block) => block.done)).toEqual([
      true,
      false,
    ]);
    expect(todayBlocks(plan, WEEK_START, { matematik: 70 }).map((block) => block.done)).toEqual([
      true,
      true,
    ]);
  });

  it('keeps the reason accessible', () => {
    const [block] = plan.blocks;
    expect(planReason(block)).toBe('balance');
  });
});
