import { topicGroupsForSubject, topicOfSubject, topicsForSection } from '../curriculum';
import { EXAM_SECTIONS, examKindsForArea, examKindsToShow } from '../net';
import { changeExam, type Profile } from '../profile';
import { defaultSubject, SUBJECTS_BY_EXAM, subjectsFor, TYT_SUBJECTS } from '../subjects';

describe('subjects per YKS area (ÖSYM puan türleri)', () => {
  it('Sayısal: TYT subjects + Matematik, Geometri, Fen; no literature, no foreign language', () => {
    const list = subjectsFor('YKS', 'sayisal');
    expect(list.slice(0, 5)).toEqual(['matematik', 'geometri', 'fizik', 'kimya', 'biyoloji']);
    expect(list).not.toContain('edebiyat');
    expect(list).not.toContain('yabanci_dil');
    expect(list).toEqual(expect.arrayContaining([...TYT_SUBJECTS, 'diger']));
  });

  it('Eşit Ağırlık: Matematik, Geometri, TDE, Tarih-1, Coğrafya-1 first; no foreign language', () => {
    const list = subjectsFor('YKS', 'esit_agirlik');
    expect(list.slice(0, 5)).toEqual(['matematik', 'geometri', 'edebiyat', 'tarih', 'cografya']);
    expect(list).toContain('fizik'); // TYT Fen
    expect(list).not.toContain('yabanci_dil');
  });

  it('Sözel: TDE, Tarih, Coğrafya, Felsefe grubu, Din first; TYT Matematik stays', () => {
    const list = subjectsFor('YKS', 'sozel');
    expect(list.slice(0, 5)).toEqual(['edebiyat', 'tarih', 'cografya', 'felsefe', 'din']);
    expect(list).toContain('matematik');
    expect(list).not.toContain('yabanci_dil');
  });

  it('Dil: Yabancı Dil (YDT) first, TYT subjects, no literature', () => {
    const list = subjectsFor('YKS', 'dil');
    expect(list[0]).toBe('yabanci_dil');
    expect(list).not.toContain('edebiyat');
    expect(list).toEqual(expect.arrayContaining(TYT_SUBJECTS));
  });

  it('every subject appears once and belongs to the full YKS list', () => {
    for (const area of ['sayisal', 'esit_agirlik', 'sozel', 'dil'] as const) {
      const list = subjectsFor('YKS', area);
      expect(new Set(list).size).toBe(list.length);
      for (const id of list) expect(SUBJECTS_BY_EXAM.YKS).toContain(id);
      expect(list[list.length - 1]).toBe('diger');
    }
  });

  it('other exams and YKS without an area keep the full list', () => {
    expect(subjectsFor('LGS', null)).toEqual(SUBJECTS_BY_EXAM.LGS);
    expect(subjectsFor('KPSS', null)).toEqual(SUBJECTS_BY_EXAM.KPSS);
    expect(subjectsFor('YKS', null)).toEqual(SUBJECTS_BY_EXAM.YKS);
  });

  it('the default subject is the last used one only if the area offers it', () => {
    expect(defaultSubject('YKS', 'edebiyat', 'sayisal')).toBe('matematik');
    expect(defaultSubject('YKS', 'edebiyat', 'sozel')).toBe('edebiyat');
    expect(defaultSubject('YKS', null, 'dil')).toBe('yabanci_dil');
  });

  it('topic picker: AYT topics only for the subjects of the area', () => {
    expect(topicGroupsForSubject('YKS', 'sayisal', 'matematik').map((g) => g.paper)).toEqual(['TYT', 'AYT']);
    expect(topicGroupsForSubject('YKS', 'sozel', 'matematik').map((g) => g.paper)).toEqual(['TYT']);
    expect(topicGroupsForSubject('YKS', 'sayisal', 'edebiyat')).toEqual([]);
    expect(topicGroupsForSubject('YKS', 'esit_agirlik', 'edebiyat').map((g) => g.paper)).toEqual(['AYT']);
  });
});

describe('mock exam papers per area', () => {
  it('TYT and the paper of the area', () => {
    expect(examKindsForArea('sayisal')).toEqual(['TYT', 'AYT_SAY']);
    expect(examKindsForArea('esit_agirlik')).toEqual(['TYT', 'AYT_EA']);
    expect(examKindsForArea('sozel')).toEqual(['TYT', 'AYT_SOZ']);
    expect(examKindsForArea('dil')).toEqual(['TYT', 'YDT']);
    expect(examKindsForArea(null)).toHaveLength(5);
  });

  it('charts also keep papers that already have exams', () => {
    expect(examKindsToShow('sozel', [])).toEqual(['TYT', 'AYT_SOZ']);
    expect(examKindsToShow('sozel', ['AYT_SAY', 'TYT', 'AYT_SAY'])).toEqual(['TYT', 'AYT_SOZ', 'AYT_SAY']);
  });

  it('the area papers match ÖSYM (SAY: Mat+Fen, EA: Mat+TDE-Sos1, SÖZ: TDE-Sos1+Sos2)', () => {
    expect(EXAM_SECTIONS.AYT_EA.map((s) => s.id)).toEqual(['matematik', 'edebiyat', 'tarih1', 'cografya1']);
    expect(EXAM_SECTIONS.AYT_SOZ.map((s) => s.id)).toEqual([
      'edebiyat',
      'tarih1',
      'cografya1',
      'tarih2',
      'cografya2',
      'felsefe_grubu',
      'din',
    ]);
    // Analysis: the AYT Tarih-1 section offers AYT history topics, never TYT ones.
    expect(topicsForSection('AYT_EA', 'tarih1').every((t) => t.id.startsWith('ayt.tarih.'))).toBe(true);
  });
});

describe('changing the exam in settings', () => {
  const profile: Profile = { birthYear: 2008, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 5 };

  it('changes only exam and area; birth year, solo flag and creation time stay (K-17)', () => {
    expect(changeExam(profile, 'YKS', 'sozel')).toEqual({ ...profile, yksArea: 'sozel' });
    expect(changeExam(profile, 'KPSS', 'sozel')).toEqual({ ...profile, examType: 'KPSS', yksArea: null });
    expect(changeExam({ ...profile, soloOnly: true }, 'LGS', null)?.soloOnly).toBe(true);
  });

  it('YKS without an area is incomplete', () => {
    expect(changeExam({ ...profile, examType: 'KPSS', yksArea: null }, 'YKS', null)).toBeNull();
  });

  it('a picked topic of the old subject or area is dropped, never paired with another subject', () => {
    // EA student picked an AYT literature topic, then switched to Sayısal: subject falls back to maths.
    expect(topicOfSubject('YKS', 'esit_agirlik', 'edebiyat', 'ayt.edebiyat.anlam-bilgisi')).toBe(
      'ayt.edebiyat.anlam-bilgisi',
    );
    expect(topicOfSubject('YKS', 'sayisal', 'matematik', 'ayt.edebiyat.anlam-bilgisi')).toBeNull();
    // SAY → SÖZ: AYT maths topics are no longer listed under maths (only TYT maths is).
    expect(topicOfSubject('YKS', 'sayisal', 'matematik', 'ayt.matematik.fonksiyonlar')).toBe('ayt.matematik.fonksiyonlar');
    expect(topicOfSubject('YKS', 'sozel', 'matematik', 'ayt.matematik.fonksiyonlar')).toBeNull();
    expect(topicOfSubject('YKS', 'sozel', 'matematik', null)).toBeNull();
  });
});
