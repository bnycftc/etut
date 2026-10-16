import { QUICK_SUBJECT_COUNT, quickSubjects, SUBJECTS_BY_EXAM, subjectsByRecency, subjectsFor } from '../subjects';

const SAYISAL = subjectsFor('YKS', 'sayisal');

describe('subjectsByRecency', () => {
  it('orders subjects by their latest session, newest first, each once', () => {
    expect(
      subjectsByRecency([
        { subjectId: 'fizik', endedAt: 10 },
        { subjectId: 'kimya', endedAt: 30 },
        { subjectId: 'fizik', endedAt: 50 },
        { subjectId: 'tarih', endedAt: 20 },
      ]),
    ).toEqual(['fizik', 'kimya', 'tarih']);
  });

  it('no sessions: no recent subjects', () => {
    expect(subjectsByRecency([])).toEqual([]);
  });
});

describe('quickSubjects ("Ders seç" before "Tüm dersler")', () => {
  it('first use: the first six of the list', () => {
    expect(quickSubjects(SAYISAL, [], SAYISAL[0])).toEqual(SAYISAL.slice(0, QUICK_SUBJECT_COUNT));
    expect(QUICK_SUBJECT_COUNT).toBe(6);
  });

  it('the recently studied ones are in, still in list order (chips do not move)', () => {
    const quick = quickSubjects(SAYISAL, ['din', 'tarih'], 'din');
    expect(quick).toHaveLength(6);
    expect(quick).toEqual(['matematik', 'geometri', 'fizik', 'kimya', 'tarih', 'din']);
  });

  it('the six most recent win over the list order', () => {
    const recent = ['diger', 'din', 'felsefe', 'cografya', 'tarih', 'turkce', 'matematik'];
    expect(quickSubjects(SAYISAL, recent, 'diger')).toEqual(['turkce', 'tarih', 'cografya', 'felsefe', 'din', 'diger']);
  });

  it('the selected subject is always shown, even when it is not among the recent ones', () => {
    const recent = ['matematik', 'geometri', 'fizik', 'kimya', 'biyoloji', 'turkce'];
    const quick = quickSubjects(SAYISAL, recent, 'felsefe');
    expect(quick).toContain('felsefe');
    expect(quick).toHaveLength(6);
    expect(quick).not.toContain('turkce'); // the least recent one makes room
  });

  it('subjects of another exam or area (an older session) are skipped', () => {
    expect(quickSubjects(SAYISAL, ['edebiyat', 'yabanci_dil'], 'matematik')).toEqual(SAYISAL.slice(0, 6));
  });

  it('a short list is shown whole: no "Tüm dersler" for one hidden subject', () => {
    expect(SUBJECTS_BY_EXAM.LGS).toHaveLength(7);
    expect(quickSubjects(SUBJECTS_BY_EXAM.LGS, [], 'turkce')).toEqual(SUBJECTS_BY_EXAM.LGS);
    expect(quickSubjects(SUBJECTS_BY_EXAM.DIGER, [], 'genel')).toEqual(SUBJECTS_BY_EXAM.DIGER);
    // KPSS has 8: six and "Tüm dersler".
    expect(quickSubjects(SUBJECTS_BY_EXAM.KPSS, [], 'turkce')).toHaveLength(6);
  });
});
