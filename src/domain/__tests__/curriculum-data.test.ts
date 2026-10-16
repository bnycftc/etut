import { sharedTopicPaper } from '../curriculum';
import { KPSS_TOPICS } from '../curriculum/kpss';
import { LGS_TOPICS } from '../curriculum/lgs';
import type { SubjectTopics, Topic } from '../curriculum/types';
import { AYT_TOPICS } from '../curriculum/yks-ayt';
import { TYT_TOPICS } from '../curriculum/yks-tyt';

const ID_PATTERN = /^(tyt|ayt|lgs|kpss)\.[a-z_]+\.[a-z0-9]+(-[a-z0-9]+)*$/;

const PAPERS: readonly (readonly [string, SubjectTopics, readonly string[]])[] = [
  [
    'tyt',
    TYT_TOPICS,
    ['turkce', 'matematik', 'geometri', 'fizik', 'kimya', 'biyoloji', 'tarih', 'cografya', 'felsefe', 'din'],
  ],
  [
    'ayt',
    AYT_TOPICS,
    [
      'matematik',
      'geometri',
      'fizik',
      'kimya',
      'biyoloji',
      'edebiyat',
      'tarih',
      'cografya',
      'felsefe',
      'din',
      'yabanci_dil',
    ],
  ],
  ['lgs', LGS_TOPICS, ['turkce', 'matematik', 'fen', 'inkilap', 'din', 'yabanci_dil']],
  ['kpss', KPSS_TOPICS, ['turkce', 'matematik', 'tarih', 'cografya', 'vatandaslik', 'guncel']],
];

function entries(topics: SubjectTopics): [string, readonly Topic[]][] {
  return Object.entries(topics).map(([key, list]) => [key, list ?? []]);
}

describe('curriculum data', () => {
  it.each(PAPERS)('%s has exactly the expected subject keys', (_paper, topics, keys) => {
    expect(Object.keys(topics).sort()).toEqual([...keys].sort());
  });

  it.each(PAPERS)('%s: every subject list is non-empty', (_paper, topics) => {
    for (const [, list] of entries(topics)) {
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it.each(PAPERS)('%s: ids match <paper>.<subject>.<slug>', (paper, topics) => {
    for (const [subject, list] of entries(topics)) {
      for (const topic of list) {
        expect(topic.id).toMatch(ID_PATTERN);
        const [idPaper, idSubject] = topic.id.split('.');
        expect(idPaper).toBe(paper);
        expect(idSubject).toBe(subject);
      }
    }
  });

  it.each(PAPERS)('%s: names are non-empty, trimmed and unique within a subject', (_paper, topics) => {
    for (const [, list] of entries(topics)) {
      const names = list.map((t) => t.name);
      for (const name of names) {
        expect(name.length).toBeGreaterThan(0);
        expect(name).toBe(name.trim());
      }
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('ids are unique across all papers', () => {
    const ids = PAPERS.flatMap(([, topics]) => entries(topics).flatMap(([, list]) => list.map((t) => t.id)));
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
  });
});

describe('topic names shared by TYT and AYT', () => {
  it('carry their paper; names of one paper, LGS and KPSS do not', () => {
    expect(sharedTopicPaper('tyt.matematik.fonksiyonlar')).toBe('TYT');
    expect(sharedTopicPaper('ayt.matematik.fonksiyonlar')).toBe('AYT');
    expect(sharedTopicPaper('ayt.matematik.turev')).toBeNull();
    expect(sharedTopicPaper('tyt.fizik.basinc')).toBeNull();
    expect(sharedTopicPaper('lgs.turkce.sozcukte-anlam')).toBeNull();
    expect(sharedTopicPaper('kpss.turkce.sozcukte-anlam')).toBeNull();
    expect(sharedTopicPaper('tyt.yok.yok')).toBeNull();
    expect(sharedTopicPaper(null)).toBeNull();
  });

  it('every TYT/AYT pair with the same name gets told apart', () => {
    const all = [...Object.values(TYT_TOPICS), ...Object.values(AYT_TOPICS)].flatMap((topics) => topics ?? []);
    const byName = new Map<string, Topic[]>();
    for (const t of all) byName.set(t.name, [...(byName.get(t.name) ?? []), t]);
    for (const topics of byName.values()) {
      const papers = new Set(topics.map((t) => t.id.slice(0, 3)));
      if (papers.size > 1) for (const t of topics) expect(sharedTopicPaper(t.id)).toBe(t.id.slice(0, 3).toUpperCase());
    }
  });
});
