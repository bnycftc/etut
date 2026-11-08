/**
 * One topic at a glance (the topic detail screen): study time and sessions on it, when it was last
 * studied, and the wrong/blank questions mock exam analyses attributed to it.
 */

import type { ExamTopicMark } from './exam-analysis';
import type { CompletedSession } from './timer';

export interface TopicStats {
  totalMinutes: number;
  sessionCount: number;
  /** End of the most recent session on the topic; `null` = never studied. */
  lastStudiedAt: number | null;
  wrong: number;
  blank: number;
  /** Exams in which at least one wrong or blank question was tagged with the topic. */
  examCount: number;
}

/** Totals over every stored session and exam mark (an unknown topic id gives zeros). */
export function topicStats(
  topicId: string,
  sessions: readonly CompletedSession[],
  examMarks: readonly ExamTopicMark[],
): TopicStats {
  let ms = 0;
  let sessionCount = 0;
  let lastStudiedAt: number | null = null;
  for (const s of sessions) {
    if (s.topicId !== topicId) continue;
    ms += s.durationMs;
    sessionCount++;
    if (lastStudiedAt === null || s.endedAt > lastStudiedAt) lastStudiedAt = s.endedAt;
  }
  let wrong = 0;
  let blank = 0;
  const exams = new Set<string>();
  for (const m of examMarks) {
    if (m.topicId !== topicId || m.wrong + m.blank === 0) continue;
    wrong += m.wrong;
    blank += m.blank;
    exams.add(m.examId);
  }
  return {
    totalMinutes: Math.floor(ms / 60_000),
    sessionCount,
    lastStudiedAt,
    wrong,
    blank,
    examCount: exams.size,
  };
}

/** The topic's sessions, newest first, at most `limit`. */
export function recentTopicSessions(
  topicId: string,
  sessions: readonly CompletedSession[],
  limit = 10,
): CompletedSession[] {
  return sessions
    .filter((s) => s.topicId === topicId)
    .sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Paper label (`TYT`, `AYT`, `LGS`, `KPSS`) and subject id read from a topic id (`tyt.fizik.x`). */
export function topicSource(topicId: string): { paper: string; subjectId: string } | null {
  const [paper, subjectId] = topicId.split('.');
  if (!paper || !subjectId) return null;
  return { paper: paper.toUpperCase(), subjectId };
}
