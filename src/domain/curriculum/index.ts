/**
 * Curriculum lookups: which topics belong to a timer subject (per exam and YKS area) and to a
 * mock-exam section. Data: `yks-tyt.ts`, `yks-ayt.ts`, `lgs.ts`, `kpss.ts`.
 */

import type { ExamKind, YksArea } from '../net';
import type { ExamType } from '../profile';
import { KPSS_TOPICS } from './kpss';
import { LGS_TOPICS } from './lgs';
import type { SubjectTopics, Topic } from './types';
import { AYT_TOPICS } from './yks-ayt';
import { TYT_TOPICS } from './yks-tyt';

export type { SubjectTopics, Topic } from './types';

export type TopicPaper = 'TYT' | 'AYT' | null;

export interface TopicGroup {
  /** `TYT` / `AYT` for YKS, `null` for single-paper exams. */
  paper: TopicPaper;
  topics: readonly Topic[];
}

/** Timer subjects whose AYT topics belong to each YKS area. */
export const AYT_SUBJECTS_BY_AREA: Record<YksArea, readonly string[]> = {
  sayisal: ['matematik', 'geometri', 'fizik', 'kimya', 'biyoloji'],
  esit_agirlik: ['matematik', 'geometri', 'edebiyat', 'tarih', 'cografya'],
  sozel: ['edebiyat', 'tarih', 'cografya', 'felsefe', 'din'],
  dil: ['yabanci_dil'],
};

function list(source: SubjectTopics, subjectId: string): readonly Topic[] {
  return source[subjectId] ?? [];
}

/** Topics of a timer subject, grouped by paper. Empty when the subject has no topic list. */
export function topicGroupsForSubject(
  examType: ExamType,
  yksArea: YksArea | null,
  subjectId: string,
): TopicGroup[] {
  const groups: TopicGroup[] = [];
  const add = (paper: TopicPaper, topics: readonly Topic[]) => {
    if (topics.length > 0) groups.push({ paper, topics });
  };
  switch (examType) {
    case 'YKS':
      add('TYT', list(TYT_TOPICS, subjectId));
      if (yksArea !== null && AYT_SUBJECTS_BY_AREA[yksArea].includes(subjectId)) {
        add('AYT', list(AYT_TOPICS, subjectId));
      }
      break;
    case 'LGS':
      add(null, list(LGS_TOPICS, subjectId));
      break;
    case 'KPSS':
      add(null, list(KPSS_TOPICS, subjectId));
      break;
    case 'DIGER':
      break;
  }
  return groups;
}

export function topicsForSubject(
  examType: ExamType,
  yksArea: YksArea | null,
  subjectId: string,
): Topic[] {
  return topicGroupsForSubject(examType, yksArea, subjectId).flatMap((g) => g.topics);
}

/**
 * `topicId` if it is one of the subject's topics for this exam and area, otherwise `null`. A
 * picked topic can go stale when the subject falls back after an exam or area change.
 */
export function topicOfSubject(
  examType: ExamType,
  yksArea: YksArea | null,
  subjectId: string,
  topicId: string | null,
): string | null {
  if (topicId === null) return null;
  return topicsForSubject(examType, yksArea, subjectId).some((t) => t.id === topicId) ? topicId : null;
}

/** Topics a wrong/blank question of a mock-exam section can be tagged with. */
export function topicsForSection(kind: ExamKind, sectionId: string): Topic[] {
  const source = kind === 'TYT' ? TYT_TOPICS : AYT_TOPICS;
  switch (sectionId) {
    case 'matematik':
      // The mathematics test contains the geometry questions too.
      return [...list(source, 'matematik'), ...list(source, 'geometri')];
    case 'tarih1':
    case 'tarih2':
      return [...list(AYT_TOPICS, 'tarih')];
    case 'cografya1':
    case 'cografya2':
      return [...list(AYT_TOPICS, 'cografya')];
    case 'felsefe_grubu':
      return [...list(AYT_TOPICS, 'felsefe')];
    default:
      return [...list(source, sectionId)];
  }
}

let index: Map<string, Topic> | null = null;

/** Any topic by id, from every exam's list. */
export function findTopic(topicId: string): Topic | undefined {
  if (index === null) {
    index = new Map();
    for (const source of [TYT_TOPICS, AYT_TOPICS, LGS_TOPICS, KPSS_TOPICS]) {
      for (const topics of Object.values(source)) {
        for (const t of topics ?? []) index.set(t.id, t);
      }
    }
  }
  return index.get(topicId);
}

/** Display name of a topic id; unknown ids (e.g. from a removed list) show as `null`. */
export function topicName(topicId: string | null | undefined): string | null {
  if (!topicId) return null;
  return findTopic(topicId)?.name ?? null;
}
