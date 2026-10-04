import {
  blankCount,
  examNeedsAnalysis,
  parseTargetNet,
  targetKey,
  targetProgress,
  topMissedTopics,
  validateSectionMarks,
} from '../exam-analysis';

const score = (correct: number, wrong: number, questions = 40) => ({
  sectionId: 'matematik',
  questions,
  correct,
  wrong,
});

describe('two-step analysis', () => {
  it('blank = questions − correct − wrong', () => {
    expect(blankCount(score(30, 6))).toBe(4);
    expect(blankCount(score(40, 0))).toBe(0);
  });

  it('only exams with a wrong or blank answer need an analysis', () => {
    expect(examNeedsAnalysis([score(40, 0)])).toBe(false);
    expect(examNeedsAnalysis([score(40, 0), score(39, 0)])).toBe(true);
    expect(examNeedsAnalysis([score(38, 2)])).toBe(true);
  });

  it('tagged wrong/blank counts may not exceed the section counts', () => {
    const s = score(30, 6); // 6 wrong, 4 blank
    const mark = (wrong: number, blank: number, topicId = 't1') => ({ sectionId: 'matematik', topicId, wrong, blank });
    expect(validateSectionMarks(s, [mark(3, 2), mark(3, 2, 't2')])).toBeNull();
    expect(validateSectionMarks(s, [mark(4, 0), mark(3, 0, 't2')])).toBe('too_many_wrong');
    expect(validateSectionMarks(s, [mark(0, 5)])).toBe('too_many_blank');
    expect(validateSectionMarks(s, [mark(-1, 0)])).toBe('negative');
    expect(validateSectionMarks(s, [mark(1.5, 0)])).toBe('not_integer');
    // Marks of other sections are ignored; tagging fewer than all is fine.
    expect(validateSectionMarks(s, [{ sectionId: 'fizik', topicId: 'x', wrong: 9, blank: 9 }])).toBeNull();
  });
});

describe('topMissedTopics', () => {
  it('sums across exams, orders by wrong then blank, and keeps 5', () => {
    const marks = [
      { sectionId: 'matematik', topicId: 'a', wrong: 2, blank: 0 },
      { sectionId: 'matematik', topicId: 'b', wrong: 3, blank: 1 },
      { sectionId: 'matematik', topicId: 'a', wrong: 2, blank: 1 },
      { sectionId: 'fizik', topicId: 'c', wrong: 3, blank: 0 },
      { sectionId: 'fizik', topicId: 'd', wrong: 1, blank: 0 },
      { sectionId: 'fizik', topicId: 'e', wrong: 0, blank: 4 },
      { sectionId: 'fizik', topicId: 'f', wrong: 0, blank: 1 },
      { sectionId: 'fizik', topicId: 'g', wrong: 0, blank: 0 },
    ];
    expect(topMissedTopics(marks)).toEqual([
      { topicId: 'a', wrong: 4, blank: 1 },
      { topicId: 'b', wrong: 3, blank: 1 },
      { topicId: 'c', wrong: 3, blank: 0 },
      { topicId: 'd', wrong: 1, blank: 0 },
      { topicId: 'e', wrong: 0, blank: 4 },
    ]);
    expect(topMissedTopics([])).toEqual([]);
  });
});

describe('target net', () => {
  it('distance to the target uses the average of the last 3 nets', () => {
    expect(targetProgress(30, [25, 20, 15, 99])).toEqual({ recentAverage: 20, gap: 10, reached: false });
    expect(targetProgress(30, [31.25])).toEqual({ recentAverage: 31.25, gap: -1.25, reached: true });
    expect(targetProgress(30, [30, 30, 30])?.reached).toBe(true);
    expect(targetProgress(30, [])).toBeNull();
  });

  it('rounds the average to two decimals', () => {
    expect(targetProgress(10, [1, 1, 0.25])).toEqual({ recentAverage: 0.75, gap: 9.25, reached: false });
    expect(targetProgress(10, [1, 0.25, 0.25])?.recentAverage).toBe(0.5);
  });

  it('parses target nets in Turkish or dotted notation, multiples of 0.25 within the section', () => {
    expect(parseTargetNet('32,5', 40)).toBe(32.5);
    expect(parseTargetNet('32.75', 40)).toBe(32.75);
    expect(parseTargetNet('40', 40)).toBe(40);
    expect(parseTargetNet('41', 40)).toBeNull();
    expect(parseTargetNet('0', 40)).toBeNull();
    expect(parseTargetNet('12,3', 40)).toBeNull();
    expect(parseTargetNet('abc', 40)).toBeNull();
    expect(parseTargetNet('', 40)).toBeNull();
  });

  it('target keys keep TYT and AYT sections apart', () => {
    expect(targetKey('TYT', 'matematik')).not.toBe(targetKey('AYT_SAY', 'matematik'));
  });
});
