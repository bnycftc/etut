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
