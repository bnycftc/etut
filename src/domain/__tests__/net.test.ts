import {
  aytKindForArea,
  EXAM_KINDS,
  EXAM_SECTIONS,
  examKindsInOrder,
  formatNet,
  net,
  sectionsFor,
  totalNet,
  validateScore,
} from '../net';

describe('net', () => {
  it('is correct − wrong / 4', () => {
    expect(net(30, 8)).toBe(28);
    expect(net(30, 5)).toBe(28.75);
    expect(net(0, 0)).toBe(0);
    expect(net(0, 4)).toBe(-1);
    expect(net(40, 0)).toBe(40);
  });

  it('totals several sections', () => {
    expect(
      totalNet([
        { sectionId: 'turkce', questions: 40, correct: 32, wrong: 6 },
        { sectionId: 'matematik', questions: 40, correct: 25, wrong: 3 },
      ]),
    ).toBe(32 - 1.5 + 25 - 0.75);
  });

  it('formats with a Turkish decimal comma', () => {
    expect(formatNet(28.75)).toBe('28,75');
    expect(formatNet(28)).toBe('28');
    expect(formatNet(-1.5)).toBe('-1,5');
  });
});

describe('validateScore', () => {
  const base = { sectionId: 'fizik', questions: 7 };
  it('accepts valid counts including blanks', () => {
    expect(validateScore({ ...base, correct: 4, wrong: 3 })).toBeNull();
    expect(validateScore({ ...base, correct: 0, wrong: 0 })).toBeNull();
  });
  it('rejects too many answers', () => {
    expect(validateScore({ ...base, correct: 5, wrong: 3 })).toBe('too_many');
  });
  it('rejects negative and non-integer input', () => {
    expect(validateScore({ ...base, correct: -1, wrong: 0 })).toBe('negative');
    expect(validateScore({ ...base, correct: 1.5, wrong: 0 })).toBe('not_integer');
    expect(validateScore({ ...base, correct: Number.NaN, wrong: 0 })).toBe('not_integer');
  });
});

describe('exam structure', () => {
  const sum = (kind: keyof typeof EXAM_SECTIONS) =>
    EXAM_SECTIONS[kind].reduce((s, x) => s + x.questions, 0);

  it('matches the YKS question counts', () => {
    expect(sum('TYT')).toBe(120);
    expect(sum('AYT_SAY')).toBe(80);
    expect(sum('AYT_EA')).toBe(80);
    expect(sum('AYT_SOZ')).toBe(80);
    expect(sum('YDT')).toBe(80);
  });

  it('has unique section ids per exam', () => {
    for (const kind of EXAM_KINDS) {
      const ids = EXAM_SECTIONS[kind].map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('a genel deneme has every section, a branş deneme only one', () => {
    expect(sectionsFor('TYT', 'genel')).toHaveLength(9);
    expect(sectionsFor('AYT_SAY', 'brans', 'fizik')).toEqual([{ id: 'fizik', questions: 14 }]);
    expect(sectionsFor('AYT_SAY', 'brans', 'edebiyat')).toEqual([]);
  });

  it('maps YKS areas to their AYT paper and orders kinds', () => {
    expect(aytKindForArea('sayisal')).toBe('AYT_SAY');
    expect(aytKindForArea('esit_agirlik')).toBe('AYT_EA');
    expect(aytKindForArea('sozel')).toBe('AYT_SOZ');
    expect(aytKindForArea('dil')).toBe('YDT');
    expect(aytKindForArea(null)).toBe('AYT_SAY');
    expect(examKindsInOrder('sozel')).toEqual(['TYT', 'AYT_SOZ', 'AYT_SAY', 'AYT_EA', 'YDT']);
    expect(examKindsInOrder(null)).toHaveLength(EXAM_KINDS.length);
  });
});
