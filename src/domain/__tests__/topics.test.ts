import {
  AYT_SUBJECTS_BY_AREA,
  findTopic,
  topicGroupsForSubject,
  topicName,
  topicsForSection,
  topicsForSubject,
} from '../curriculum';
import { AYT_TOPICS } from '../curriculum/yks-ayt';
import { TYT_TOPICS } from '../curriculum/yks-tyt';
import { EXAM_KINDS, EXAM_SECTIONS } from '../net';
import { SUBJECTS_BY_EXAM } from '../subjects';
import { toggleStatus, topicProgress } from '../topics';

describe('topics of a timer subject', () => {
  it('YKS sayısal physics has TYT and AYT topics; eşit ağırlık only TYT', () => {
    const say = topicGroupsForSubject('YKS', 'sayisal', 'fizik');
    expect(say.map((g) => g.paper)).toEqual(['TYT', 'AYT']);
    expect(say[0].topics).toBe(TYT_TOPICS.fizik);
    expect(say[1].topics).toBe(AYT_TOPICS.fizik);
    expect(topicGroupsForSubject('YKS', 'esit_agirlik', 'fizik').map((g) => g.paper)).toEqual(['TYT']);
  });

  it('literature is AYT-only and belongs to EA and sözel', () => {
    expect(topicGroupsForSubject('YKS', 'sozel', 'edebiyat').map((g) => g.paper)).toEqual(['AYT']);
    expect(topicGroupsForSubject('YKS', 'sayisal', 'edebiyat')).toEqual([]);
  });

  it('dil students get the YDT list for the foreign language', () => {
    expect(topicsForSubject('YKS', 'dil', 'yabanci_dil')).toEqual(AYT_TOPICS.yabanci_dil);
  });

  it('every subject of an area has an AYT list', () => {
    for (const subjects of Object.values(AYT_SUBJECTS_BY_AREA)) {
      for (const id of subjects) expect(AYT_TOPICS[id]?.length).toBeGreaterThan(0);
    }
  });

  it('LGS and KPSS subjects have topics; "diğer" and other exams have none', () => {
    for (const id of SUBJECTS_BY_EXAM.LGS.filter((s) => s !== 'diger')) {
      expect(topicsForSubject('LGS', null, id).length).toBeGreaterThan(0);
    }
    for (const id of ['turkce', 'matematik', 'tarih', 'cografya', 'vatandaslik', 'guncel']) {
      expect(topicsForSubject('KPSS', null, id).length).toBeGreaterThan(0);
    }
    expect(topicsForSubject('KPSS', null, 'egitim_bilimleri')).toEqual([]);
    expect(topicsForSubject('YKS', 'sayisal', 'diger')).toEqual([]);
    expect(topicsForSubject('DIGER', null, 'genel')).toEqual([]);
  });
});

describe('topics of a mock-exam section', () => {
  it('every section of every exam kind can be tagged', () => {
    for (const kind of EXAM_KINDS) {
      for (const s of EXAM_SECTIONS[kind]) expect(topicsForSection(kind, s.id).length).toBeGreaterThan(0);
    }
  });

  it('mathematics includes geometry; Tarih-1/2 and Coğrafya-1/2 use the AYT lists', () => {
    const tytMath = topicsForSection('TYT', 'matematik').map((t) => t.id);
    expect(tytMath).toEqual([...TYT_TOPICS.matematik!, ...TYT_TOPICS.geometri!].map((t) => t.id));
    expect(topicsForSection('AYT_SAY', 'matematik').some((t) => t.id.startsWith('ayt.geometri.'))).toBe(true);
    expect(topicsForSection('AYT_SOZ', 'tarih2')).toEqual(AYT_TOPICS.tarih);
    expect(topicsForSection('AYT_EA', 'cografya1')).toEqual(AYT_TOPICS.cografya);
    expect(topicsForSection('AYT_SOZ', 'felsefe_grubu')).toEqual(AYT_TOPICS.felsefe);
    expect(topicsForSection('TYT', 'din')).toEqual(TYT_TOPICS.din);
    expect(topicsForSection('AYT_SOZ', 'din')).toEqual(AYT_TOPICS.din);
  });

  it('finds a topic by id and names unknown ids as null', () => {
    const first = TYT_TOPICS.matematik![0];
    expect(findTopic(first.id)).toBe(first);
    expect(topicName(first.id)).toBe(first.name);
    expect(topicName('yok.boyle.bir-konu')).toBeNull();
    expect(topicName(null)).toBeNull();
  });
});

describe('topic progress', () => {
  const topics = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];

  it('percent of topics marked done, rounded down', () => {
    expect(topicProgress(topics, { a: 'done', b: 'review', x: 'done' })).toEqual({
      total: 3,
      done: 1,
      review: 1,
      percent: 33,
    });
    expect(topicProgress(topics, { a: 'done', b: 'done', c: 'done' }).percent).toBe(100);
    expect(topicProgress([], {}).percent).toBe(0);
  });

  it('tapping the active status clears it, another one switches', () => {
    expect(toggleStatus(undefined, 'done')).toBe('done');
    expect(toggleStatus('done', 'done')).toBeNull();
    expect(toggleStatus('done', 'review')).toBe('review');
  });
});
