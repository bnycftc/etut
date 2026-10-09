import type { BackupExam } from '../backup';
import { CSV_BOM, csvField, type CsvLabels, examRows, istanbulDateTime, sessionRows, toCsv } from '../csv';

describe('CSV fields', () => {
  it('quotes separators, quotes and line breaks; doubles inner quotes', () => {
    expect(csvField('Fizik')).toBe('Fizik');
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('a "b" c')).toBe('"a ""b"" c"');
    expect(csvField('iki\nsatır')).toBe('"iki\nsatır"');
    expect(csvField('cr\rlf')).toBe('"cr\rlf"');
    expect(csvField(null)).toBe('');
  });

  it('neutralises text that a spreadsheet would run as a formula', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-2')).toBe("'-2");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\tx')).toBe("'\tx");
  });

  it('numbers use a decimal comma and are never prefixed, negative nets included', () => {
    expect(csvField(28.75)).toBe('28,75');
    expect(csvField(-2.5)).toBe('-2,5');
    expect(csvField(Number.NaN)).toBe('');
  });

  it('BOM, header and CRLF line ends', () => {
    expect(toCsv(['a', 'b'], [[1, 'x;y']])).toBe(`${CSV_BOM}a;b\r\n1;"x;y"\r\n`);
  });

  it('Istanbul local time', () => {
    expect(istanbulDateTime(Date.parse('2026-10-04T21:05:00Z'))).toBe('2026-10-05 00:05');
  });
});

const LABELS: CsvLabels = {
  subject: (id) => ({ fizik: 'Fizik', matematik: 'Matematik' })[id] ?? id,
  topic: (id) => (id === 'tyt.fizik.basinc' ? 'Basınç' : id),
  source: (s) => (s === 'manual' ? 'elle' : 'sayaç'),
  examKind: (k) => k,
  scope: (s) => s,
  yesNo: (v) => (v ? 'evet' : 'hayır'),
};

describe('CSV rows', () => {
  it('sessions oldest first, minutes and seconds of study', () => {
    const rows = sessionRows(
      [
        {
          id: 'b',
          subjectId: 'fizik',
          topicId: 'tyt.fizik.basinc',
          startedAt: Date.parse('2026-10-02T07:00:00Z'),
          endedAt: Date.parse('2026-10-02T08:00:00Z'),
          pauses: [],
          durationMs: 3_599_999,
          source: 'manual',
        },
        {
          id: 'a',
          subjectId: 'matematik',
          topicId: null,
          startedAt: Date.parse('2026-10-01T07:00:00Z'),
          endedAt: Date.parse('2026-10-01T07:30:00Z'),
          pauses: [],
          durationMs: 1_800_000,
          source: 'timer',
          questions: 25,
        },
      ],
      LABELS,
    );
    // Last column: solved questions, empty when not given.
    expect(rows).toEqual([
      ['2026-10-01', '2026-10-01 10:00', '2026-10-01 10:30', 'Matematik', null, 'sayaç', 30, 1800, 25],
      ['2026-10-02', '2026-10-02 10:00', '2026-10-02 11:00', 'Fizik', 'Basınç', 'elle', 59, 3599, null],
    ]);
  });

  it('one row per exam section with blanks, nets and the exam total', () => {
    const exam: BackupExam = {
      id: 'e',
      kind: 'TYT',
      scope: 'genel',
      bransSectionId: null,
      takenOn: '2026-10-03',
      createdAt: 1,
      analysisDoneAt: null,
      scores: [
        { sectionId: 'matematik', questions: 40, correct: 20, wrong: 8 },
        { sectionId: 'fizik', questions: 7, correct: 0, wrong: 7 },
      ],
      marks: [],
    };
    expect(examRows([exam], LABELS)).toEqual([
      ['2026-10-03', 'TYT', 'genel', 'Matematik', 40, 20, 8, 12, 18, 16.25, 'hayır'],
      ['2026-10-03', 'TYT', 'genel', 'Fizik', 7, 0, 7, 0, -1.75, 16.25, 'hayır'],
    ]);
  });
});
