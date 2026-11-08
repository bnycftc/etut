import type { ExamTopicMark } from '../exam-analysis';
import type { CompletedSession } from '../timer';
import { recentTopicSessions, topicSource, topicStats } from '../topic-stats';

const T = 'tyt.matematik.temel-kavramlar';

function session(id: string, topicId: string | null, startedAt: number, minutes: number): CompletedSession {
  return {
    id,
    subjectId: 'matematik',
    topicId,
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    pauses: [],
    durationMs: minutes * 60_000,
    source: 'timer',
  };
}

function mark(examId: string, topicId: string, wrong: number, blank: number): ExamTopicMark {
  return { examId, topicId, sectionId: 'matematik', wrong, blank, takenOn: '2026-10-01', createdAt: 0 };
}

describe('topicStats', () => {
  it('is all zeros without sessions or marks', () => {
    expect(topicStats(T, [], [])).toEqual({
      totalMinutes: 0,
      sessionCount: 0,
      lastStudiedAt: null,
      wrong: 0,
      blank: 0,
      examCount: 0,
    });
  });

  it('adds up the sessions on the topic only and keeps the latest end', () => {
    const sessions = [
      session('a', T, 1_000_000, 30),
      session('b', 'tyt.fizik.vektorler', 9_000_000, 50),
      session('c', T, 5_000_000, 45),
      session('d', null, 20_000_000, 10),
    ];
    const stats = topicStats(T, sessions, []);
    expect(stats.totalMinutes).toBe(75);
    expect(stats.sessionCount).toBe(2);
    expect(stats.lastStudiedAt).toBe(5_000_000 + 45 * 60_000);
  });

  it('sums wrong and blank answers over exams and counts the exams once', () => {
    const marks = [
      mark('e1', T, 3, 1),
      mark('e1', T, 1, 0),
      mark('e2', T, 0, 2),
      mark('e3', T, 0, 0),
      mark('e2', 'tyt.fizik.vektorler', 5, 5),
    ];
    const stats = topicStats(T, [], marks);
    expect(stats.wrong).toBe(4);
    expect(stats.blank).toBe(3);
    expect(stats.examCount).toBe(2);
  });

  it('an unknown topic gives zeros', () => {
    const stats = topicStats('yok.yok.yok', [session('a', T, 0, 30)], [mark('e1', T, 2, 2)]);
    expect(stats).toEqual({ totalMinutes: 0, sessionCount: 0, lastStudiedAt: null, wrong: 0, blank: 0, examCount: 0 });
  });

  it('rounds the time down to whole minutes', () => {
    const s = { ...session('a', T, 0, 1), durationMs: 119_000 };
    expect(topicStats(T, [s], []).totalMinutes).toBe(1);
  });
});

describe('recentTopicSessions', () => {
  it('newest first, at most the limit, only the topic', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => session(`s${i}`, T, i * 10_000_000, 20));
    sessions.push(session('x', 'tyt.fizik.vektorler', 999_000_000, 20));
    const recent = recentTopicSessions(T, sessions);
    expect(recent).toHaveLength(10);
    expect(recent[0].id).toBe('s11');
    expect(recent[9].id).toBe('s2');
  });
});

describe('topicSource', () => {
  it('reads the paper and the subject from the id', () => {
    expect(topicSource('tyt.matematik.temel-kavramlar')).toEqual({ paper: 'TYT', subjectId: 'matematik' });
    expect(topicSource('lgs.fen.mevsimler')).toEqual({ paper: 'LGS', subjectId: 'fen' });
    expect(topicSource('bozuk')).toBeNull();
  });
});
