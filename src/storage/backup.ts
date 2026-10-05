/**
 * Reads every piece of on-device data for a backup and writes a merged/replaced data set back.
 * The rules (format, validation, merge, K-17) are in `domain/backup.ts`; this file only moves
 * rows. The profile is not written here (see `importBackup` in state/app-state.tsx).
 */

import type { BackupData, BackupExam, BackupSettings, BackupTopicProgress } from '../domain/backup';
import { net, totalNet } from '../domain/net';
import { EXAM_TYPES, type ExamType } from '../domain/profile';
import { isTopicStatus } from '../domain/topics';
import { getDb } from './db';
import {
  clearLastSubject,
  loadCustomExamDate,
  loadDailyGoal,
  loadLastSubject,
  loadNetTargets,
  loadStoredPomodoroConfig,
  loadStoredTimerMode,
  restoreTimerSettings,
  storeCustomExamDate,
  storeDailyGoal,
  storeLastSubject,
  storeNetTargets,
} from './kv';
import { getExamMarks, getMockExam, listMockExams } from './mock-exams';
import { allSessions } from './sessions';

function readSettings(): BackupSettings {
  const examDates: Partial<Record<ExamType, string>> = {};
  for (const t of EXAM_TYPES) {
    const day = loadCustomExamDate(t);
    if (day !== null) examDates[t] = day;
  }
  return {
    dailyGoalMinutes: loadDailyGoal(),
    pomodoro: loadStoredPomodoroConfig(),
    timerMode: loadStoredTimerMode(),
    examDates,
    netTargets: loadNetTargets(),
    lastSubject: loadLastSubject(),
  };
}

function readExams(): BackupExam[] {
  return listMockExams()
    .reverse()
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      scope: e.scope,
      bransSectionId: e.bransSectionId,
      takenOn: e.takenOn,
      createdAt: e.createdAt,
      analysisDoneAt: e.analysisDoneAt,
      scores: getMockExam(e.id)?.scores ?? [],
      marks: getExamMarks(e.id),
    }));
}

function readTopicProgress(): BackupTopicProgress[] {
  return getDb()
    .getAllSync<{ topic_id: string; status: string; updated_at: number }>(
      'SELECT topic_id, status, updated_at FROM topic_progress ORDER BY topic_id',
    )
    .flatMap((r) =>
      isTopicStatus(r.status) ? [{ topicId: r.topic_id, status: r.status, updatedAt: r.updated_at }] : [],
    );
}

export function readBackupData(): BackupData {
  return {
    sessions: allSessions(),
    exams: readExams(),
    topicProgress: readTopicProgress(),
    settings: readSettings(),
  };
}

function writeSettings(s: BackupSettings): void {
  storeDailyGoal(s.dailyGoalMinutes);
  restoreTimerSettings(s.timerMode, s.pomodoro);
  for (const t of EXAM_TYPES) storeCustomExamDate(t, s.examDates[t] ?? null);
  storeNetTargets(s.netTargets);
  if (s.lastSubject === null) clearLastSubject();
  else storeLastSubject(s.lastSubject);
}

/**
 * Replaces every session, exam (with scores and analysis marks) and topic mark with `data`, in
 * one transaction (all or nothing), then the settings. Total nets are recomputed from scores.
 */
export function writeBackupData(data: BackupData): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync(
      'DELETE FROM mock_exam_marks; DELETE FROM mock_exam_scores; DELETE FROM mock_exams; ' +
        'DELETE FROM sessions; DELETE FROM topic_progress;',
    );
    const insertSession = db.prepareSync(
      `INSERT INTO sessions
         (id, subject_id, topic_id, started_at, ended_at, pauses, duration_ms, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertExam = db.prepareSync(
      `INSERT INTO mock_exams
         (id, kind, scope, brans_section_id, taken_on, total_net, created_at, analysis_done_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertScore = db.prepareSync(
      `INSERT INTO mock_exam_scores (exam_id, section_id, questions, correct, wrong, net)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertMark = db.prepareSync(
      `INSERT INTO mock_exam_marks (exam_id, section_id, topic_id, wrong, blank) VALUES (?, ?, ?, ?, ?)`,
    );
    const insertTopic = db.prepareSync(
      'INSERT INTO topic_progress (topic_id, status, updated_at) VALUES (?, ?, ?)',
    );
    try {
      for (const s of data.sessions) {
        insertSession.executeSync(
          s.id,
          s.subjectId,
          s.topicId,
          s.startedAt,
          s.endedAt,
          JSON.stringify(s.pauses),
          s.durationMs,
          s.source,
          s.endedAt,
        );
      }
      for (const e of data.exams) {
        insertExam.executeSync(
          e.id,
          e.kind,
          e.scope,
          e.bransSectionId,
          e.takenOn,
          totalNet(e.scores),
          e.createdAt,
          e.analysisDoneAt,
        );
        for (const s of e.scores) {
          insertScore.executeSync(e.id, s.sectionId, s.questions, s.correct, s.wrong, net(s.correct, s.wrong));
        }
        for (const m of e.marks) {
          if (m.wrong + m.blank > 0) insertMark.executeSync(e.id, m.sectionId, m.topicId, m.wrong, m.blank);
        }
      }
      for (const t of data.topicProgress) insertTopic.executeSync(t.topicId, t.status, t.updatedAt);
    } finally {
      insertSession.finalizeSync();
      insertExam.finalizeSync();
      insertScore.finalizeSync();
      insertMark.finalizeSync();
      insertTopic.finalizeSync();
    }
  });
  writeSettings(data.settings);
}
