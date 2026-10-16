import { isTopicStatus, type TimedTopicStatus, type TopicStatus } from '../domain/topics';
import { getDb } from './db';

/** One topic's mark with the time it was set; `null` = not marked. */
export function loadTopicMark(topicId: string): TimedTopicStatus | null {
  const row = getDb().getFirstSync<{ status: string; updated_at: number }>(
    'SELECT status, updated_at FROM topic_progress WHERE topic_id = ?',
    topicId,
  );
  return row !== null && isTopicStatus(row.status) ? { status: row.status, updatedAt: row.updated_at } : null;
}

export function loadTopicStatuses(): Record<string, TopicStatus> {
  const rows = getDb().getAllSync<{ topic_id: string; status: string }>(
    'SELECT topic_id, status FROM topic_progress',
  );
  const out: Record<string, TopicStatus> = {};
  for (const r of rows) if (isTopicStatus(r.status)) out[r.topic_id] = r.status;
  return out;
}

/** `null` clears the mark. */
export function setTopicStatus(topicId: string, status: TopicStatus | null, now: number): void {
  if (status === null) {
    getDb().runSync('DELETE FROM topic_progress WHERE topic_id = ?', topicId);
  } else {
    getDb().runSync(
      'INSERT OR REPLACE INTO topic_progress (topic_id, status, updated_at) VALUES (?, ?, ?)',
      topicId,
      status,
      now,
    );
  }
}
