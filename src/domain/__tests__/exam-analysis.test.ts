import {
  analysisAfterEdit,
  blankCount,
  chartScale,
  netTrend,
  studyTargetForTopic,
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

describe('editing a saved exam keeps its analysis', () => {
  const mark = (sectionId: string, wrong: number, blank = 0) => ({ sectionId, topicId: `t.${sectionId}`, wrong, blank });
  const turkce = (correct: number, wrong: number) => ({ sectionId: 'turkce', questions: 40, correct, wrong });
  const before = {
    kind: 'TYT' as const,
    scores: [score(30, 6), turkce(30, 5)],
    marks: [mark('matematik', 4, 2), mark('turkce', 3)],
    analysisDoneAt: 100,
  };

  it('a date-only or count-only change that still fits keeps every mark and the done state', () => {
    expect(analysisAfterEdit(before, 'TYT', [score(31, 5), turkce(30, 5)], 200)).toEqual({
      marks: before.marks,
      analysisDoneAt: 100,
    });
  });

  it('marks that no longer fit their section go and the analysis is pending again', () => {
    // Matematik: 3 wrong now, 4 were tagged.
    expect(analysisAfterEdit(before, 'TYT', [score(35, 3), turkce(30, 5)], 200)).toEqual({
      marks: [mark('turkce', 3)],
      analysisDoneAt: null,
    });
  });

  it('a section that is gone (genel → branş) takes its marks with it', () => {
    expect(analysisAfterEdit(before, 'TYT', [turkce(30, 5)], 200)).toEqual({
      marks: [mark('turkce', 3)],
      analysisDoneAt: null,
    });
  });

  it('another paper drops every mark', () => {
    expect(analysisAfterEdit(before, 'AYT_SAY', [score(30, 6)], 200)).toEqual({ marks: [], analysisDoneAt: null });
  });

  it('nothing left to analyse → done; something new to analyse → pending', () => {
    expect(analysisAfterEdit({ ...before, analysisDoneAt: null }, 'TYT', [score(40, 0)], 200)).toEqual({
      marks: [],
      analysisDoneAt: 200,
    });
    const perfect = { kind: 'TYT' as const, scores: [score(40, 0)], marks: [], analysisDoneAt: 5 };
    expect(analysisAfterEdit(perfect, 'TYT', [score(38, 2)], 200)).toEqual({ marks: [], analysisDoneAt: null });
    // Still pending stays pending.
    expect(analysisAfterEdit({ ...before, analysisDoneAt: null }, 'TYT', before.scores, 200).analysisDoneAt).toBeNull();
  });
});

describe('net charts', () => {
  it('a single exam sits below a round top, not at the top edge', () => {
    expect(chartScale([11.5], null, 120)).toEqual({ min: 0, max: 15 });
    expect(chartScale([28.75, 31], null, 40)).toEqual({ min: 0, max: 40 });
    expect(chartScale([3.25], null, 7)).toEqual({ min: 0, max: 4 });
  });

  it('the target and negative nets fit in the range; never above the question count', () => {
    expect(chartScale([12], 30, 40).max).toBe(40);
    expect(chartScale([110], null, 120).max).toBe(120);
    expect(chartScale([-2.5, 4], null, 40)).toEqual({ min: -3, max: 5 });
    expect(chartScale([0], null, 40)).toEqual({ min: 0, max: 5 });
    expect(chartScale([], null, 6)).toEqual({ min: 0, max: 5 });
  });

  it('trend: the last net and the change from the one before', () => {
    expect(netTrend([])).toBeNull();
    expect(netTrend([11.5])).toEqual({ last: 11.5, change: null });
    expect(netTrend([10, 12.25, 9])).toEqual({ last: 9, change: -3.25 });
  });
});

describe('studying a most-missed topic', () => {
  it('finds the timer subject of the topic in the student\'s lists', () => {
    expect(studyTargetForTopic('YKS', 'sayisal', 'tyt.matematik.mutlak-deger')).toEqual({
      subjectId: 'matematik',
      topicId: 'tyt.matematik.mutlak-deger',
    });
    expect(studyTargetForTopic('LGS', null, 'lgs.turkce.sozcukte-anlam')).toEqual({
      subjectId: 'turkce',
      topicId: 'lgs.turkce.sozcukte-anlam',
    });
  });

  it('a topic outside the current lists (other area, removed id) offers no start', () => {
    expect(studyTargetForTopic('YKS', 'sozel', 'ayt.matematik.fonksiyonlar')).toBeNull();
    expect(studyTargetForTopic('YKS', 'sayisal', 'no.such.topic')).toBeNull();
  });
});