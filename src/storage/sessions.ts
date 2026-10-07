import { normalizeQuestions } from '../domain/questions';
import type { ClosedPause, CompletedSession, SessionSource } from '../domain/timer';
import { getDb } from './db';

interface SessionRow {
  id: string;
  subject_id: string;
  topic_id: string | null;
  started_at: number;
  ended_at: number;
  pauses: string;
  duration_ms: number;
  source: string;
  questions: number | null;
}

const COLUMNS = 'id, subject_id, topic_id, started_at, ended_at, pauses, duration_ms, source, questions';

function parsePauses(json: string): ClosedPause[] {
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (p): p is ClosedPause =>
        typeof p === 'object' && p !== null && typeof p.start === 'number' && typeof p.end === 'number',
    );
  } catch {
    return [];
  }
}

function toSession(row: SessionRow): CompletedSession {
  const session: CompletedSession = {
    id: row.id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    pauses: parsePauses(row.pauses),
    durationMs: row.duration_ms,
    source: (row.source === 'manual' ? 'manual' : 'timer') satisfies SessionSource,
  };
  // Only sessions with a count carry the field (older ones read back exactly as before).
  const questions = normalizeQuestions(row.questions);
  if (questions !== null) session.questions = questions;
  return session;
}

/** Idempotent: saving the same session id twice keeps one row. */
export function saveSession(session: CompletedSession, now: number): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO sessions
       (id, subject_id, topic_id, started_at, ended_at, pauses, duration_ms, source, created_at, questions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.subjectId,
    session.topicId,
    session.startedAt,
    session.endedAt,
    JSON.stringify(session.pauses),
    session.durationMs,
    session.source,
    now,
    normalizeQuestions(session.questions),
  );
}

/** Sessions that overlap `[fromMs, toMs)`. */
export function sessionsOverlapping(fromMs: number, toMs: number): CompletedSession[] {
  return getDb()
    .getAllSync<SessionRow>(
      `SELECT ${COLUMNS} FROM sessions WHERE ended_at > ? AND started_at < ? ORDER BY started_at`,
      fromMs,
      toMs,
    )
    .map(toSession);
}

/** Every stored session, oldest first (backup and CSV export). */
export function allSessions(): CompletedSession[] {
  return getDb()
    .getAllSync<SessionRow>(`SELECT ${COLUMNS} FROM sessions ORDER BY started_at, id`)
    .map(toSession);
}

/** Most recent sessions added afterwards ("elle"), newest first. */
export function recentManualSessions(limit: number): CompletedSession[] {
  return getDb()
    .getAllSync<SessionRow>(
      `SELECT ${COLUMNS} FROM sessions WHERE source = 'manual' ORDER BY started_at DESC LIMIT ?`,
      limit,
    )
    .map(toSession);
}

/** Only manual entries can be deleted from the app (timer sessions are kept as recorded). */
export function deleteManualSession(id: string): void {
  getDb().runSync(`DELETE FROM sessions WHERE id = ? AND source = 'manual'`, id);
}

/**
 * "Geri al" right after Bitir (domain/finish.ts): the session goes back to running, so its
 * just-saved record is removed. Not for editing history: timer sessions are otherwise kept.
 */
export function deleteSessionForUndo(id: string): void {
  getDb().runSync(`DELETE FROM sessions WHERE id = ? AND source = 'timer'`, id);
}

/** Total study time per topic (all time). */
export function topicTotals(): Record<string, number> {
  const rows = getDb().getAllSync<{ topic_id: string; total: number }>(
    `SELECT topic_id, SUM(duration_ms) AS total FROM sessions
     WHERE topic_id IS NOT NULL GROUP BY topic_id`,
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.topic_id] = r.total;
  return out;
}
