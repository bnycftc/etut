import { encodePrefill, parseCount, parsePrefill, scoresFromEntries } from '../net-calc';
import { EXAM_SECTIONS, formatNet, totalNet } from '../net';

describe('net calculator', () => {
  it('reads empty boxes as 0 and anything but digits as invalid', () => {
    expect(parseCount('')).toBe(0);
    expect(parseCount(' 12 ')).toBe(12);
    expect(Number.isNaN(parseCount('1,5'))).toBe(true);
    expect(Number.isNaN(parseCount('-3'))).toBe(true);
  });

  it('builds every section of the paper and nets them with the net.ts rule', () => {
    const scores = scoresFromEntries('TYT', { matematik: { correct: '30', wrong: '8' } });
    expect(scores.map((s) => s.sectionId)).toEqual(EXAM_SECTIONS.TYT.map((s) => s.id));
    expect(formatNet(totalNet(scores, 'TYT'))).toBe('28');
    const lgs = scoresFromEntries('LGS', { turkce: { correct: '15', wrong: '3' } });
    expect(formatNet(totalNet(lgs, 'LGS'))).toBe('14');
  });

  it('hands the counts to the new-exam form and reads them back', () => {
    const scores = scoresFromEntries('AYT_SAY', { fizik: { correct: '10', wrong: '2' } });
    const back = parsePrefill(encodePrefill('AYT_SAY', scores));
    expect(back?.kind).toBe('AYT_SAY');
    expect(back?.scores).toEqual(scores);
  });

  it('fills sections the param leaves out with zeros', () => {
    const back = parsePrefill(JSON.stringify({ kind: 'TYT', scores: [{ sectionId: 'fizik', correct: 5, wrong: 1 }] }));
    expect(back?.scores.find((s) => s.sectionId === 'fizik')).toMatchObject({ correct: 5, wrong: 1 });
    expect(back?.scores.find((s) => s.sectionId === 'turkce')).toMatchObject({ correct: 0, wrong: 0 });
  });

  it('refuses a malformed param', () => {
    expect(parsePrefill(undefined)).toBeNull();
    expect(parsePrefill('{')).toBeNull();
    expect(parsePrefill(JSON.stringify({ kind: 'XYZ', scores: [] }))).toBeNull();
    expect(parsePrefill(JSON.stringify({ kind: 'TYT', scores: [{ sectionId: 'fizik', correct: 7, wrong: 1 }] }))).toBeNull();
    expect(parsePrefill(JSON.stringify({ kind: 'TYT', scores: [{ sectionId: 'yok', correct: 1, wrong: 0 }] }))).toBeNull();
    expect(parsePrefill(JSON.stringify({ kind: 'TYT', scores: [{ sectionId: 'fizik', correct: 1.5, wrong: 0 }] }))).toBeNull();
  });
});
