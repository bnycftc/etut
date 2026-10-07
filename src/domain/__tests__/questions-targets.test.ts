import { dayStartMs } from '../istanbul-day';
import { MAX_SESSION_QUESTIONS, normalizeQuestions, parseQuestionCount, questionTotals } from '../questions';
import {
  normalizeSubjectTarget,
  normalizeSubjectTargets,
  stepSubjectTarget,
  SUBJECT_TARGET_MAX_MIN,
  subjectTargetProgress,
} from '../subject-targets';

const HOUR = 3_600_000;

describe('question count input', () => {
  it('empty and 0 mean "not given"; whole numbers up to the limit are kept', () => {
    expect(parseQuestionCount('')).toEqual({ ok: true, value: null });
    expect(parseQuestionCount('  ')).toEqual({ ok: true, value: null });
    expect(parseQuestionCount('0')).toEqual({ ok: true, value: null });
    expect(parseQuestionCount(' 40 ')).toEqual({ ok: true, value: 40 });
    expect(parseQuestionCount(String(MAX_SESSION_QUESTIONS))).toEqual({ ok: true, value: MAX_SESSION_QUESTIONS });
  });

  it('refuses anything that is not a whole number in range', () => {
    for (const text of ['-3', '4,5', '1.5', 'kırk', '1e3', String(MAX_SESSION_QUESTIONS + 1), '99999']) {
      expect(parseQuestionCount(text)).toEqual({ ok: false });
    }
  });

  it('stored values outside the rules read as "not given"', () => {
    expect(normalizeQuestions(25)).toBe(25);
    for (const v of [0, -1, 2.5, MAX_SESSION_QUESTIONS + 1, '25', null, undefined, Number.NaN]) {
      expect(normalizeQuestions(v)).toBeNull();
    }
  });
});

describe('question totals', () => {
  const at = (day: string, hour: number) => dayStartMs(day) + hour * HOUR;
  const spans = [
    { subjectId: 'matematik', startedAt: at('2026-10-05', 10), questions: 40 },
    { subjectId: 'fizik', startedAt: at('2026-10-05', 14), questions: 12 },
    { subjectId: 'matematik', startedAt: at('2026-10-06', 9), questions: 30 },
    // Not given: ignored.
    { subjectId: 'kimya', startedAt: at('2026-10-06', 11) },
    { subjectId: 'kimya', startedAt: at('2026-10-06', 12), questions: null },
    // Started 23:30 on the 6th, ended after midnight: counts on the day it started.
    { subjectId: 'fizik', startedAt: at('2026-10-06', 23.5), questions: 8 },
    // Outside the asked days.
    { subjectId: 'matematik', startedAt: at('2026-10-12', 9), questions: 100 },
  ];

  it('adds up per day and per subject on the day each session started', () => {
    expect(questionTotals(spans, ['2026-10-05', '2026-10-06', '2026-10-07'])).toEqual({
      total: 90,
      byDay: { '2026-10-05': 52, '2026-10-06': 38 },
      bySubject: { matematik: 70, fizik: 20 },
    });
  });

  it('nothing given: zero', () => {
    expect(questionTotals([{ subjectId: 'x', startedAt: at('2026-10-05', 1) }], ['2026-10-05'])).toEqual({
      total: 0,
      byDay: {},
      bySubject: {},
    });
  });
});

describe('weekly target per subject', () => {
  it('targets snap to half hours within limits; nonsense is no target', () => {
    expect(normalizeSubjectTarget(480)).toBe(480);
    expect(normalizeSubjectTarget(100)).toBe(90);
    expect(normalizeSubjectTarget(10)).toBe(30);
    expect(normalizeSubjectTarget(10_000)).toBe(SUBJECT_TARGET_MAX_MIN);
    for (const v of [0, -30, Number.NaN, '480', null]) expect(normalizeSubjectTarget(v)).toBeNull();
  });

  it('a stored map keeps only valid subjects and targets', () => {
    expect(normalizeSubjectTargets({ matematik: 480, fizik: 0, 'bad id': 60, kimya: '60' })).toEqual({ matematik: 480 });
    expect(normalizeSubjectTargets(null)).toEqual({});
    expect(normalizeSubjectTargets([480])).toEqual({});
  });

  it('− and + move by half an hour; below the minimum the target goes off', () => {
    expect(stepSubjectTarget(null, 1)).toBe(30);
    expect(stepSubjectTarget(null, -1)).toBeNull();
    expect(stepSubjectTarget(30, -1)).toBeNull();
    expect(stepSubjectTarget(60, 1)).toBe(90);
    expect(stepSubjectTarget(SUBJECT_TARGET_MAX_MIN, 1)).toBe(SUBJECT_TARGET_MAX_MIN);
  });

  it('progress of the week towards the target', () => {
    expect(subjectTargetProgress(3 * HOUR, 480)).toEqual({
      targetMs: 8 * HOUR,
      ratio: 3 / 8,
      percent: 37,
      reached: false,
      leftMs: 5 * HOUR,
    });
    expect(subjectTargetProgress(9 * HOUR, 480)).toMatchObject({ ratio: 1, percent: 112, reached: true, leftMs: 0 });
  });
});
