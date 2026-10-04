import type { ClosedPause, CompletedSession } from '../domain/timer';
import { getDb } from './db';

interface SessionRow {
  id: string;
  subject_id: string;
  started_at: number;
  ended_at: number;
  pauses: string;
  duration_ms: number;
}

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
  return {
    id: row.id,
    subjectId: row.subject_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    pauses: parsePauses(row.pauses),
    durationMs: row.duration_ms,
  };
}

/** Idempotent: saving the same session id twice keeps one row. */
export function saveSession(session: CompletedSession, now: number): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO sessions (id, subject_id, started_at, ended_at, pauses, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.subjectId,
    session.startedAt,
    session.endedAt,
    JSON.stringify(session.pauses),
    session.durationMs,
    now,
  );
}

/** Sessions that overlap `[fromMs, toMs)`. */
export function sessionsOverlapping(fromMs: number, toMs: number): CompletedSession[] {
  return getDb()
    .getAllSync<SessionRow>(
      `SELECT id, subject_id, started_at, ended_at, pauses, duration_ms
       FROM sessions WHERE ended_at > ? AND started_at < ? ORDER BY started_at`,
      fromMs,
      toMs,
    )
    .map(toSession);
}
