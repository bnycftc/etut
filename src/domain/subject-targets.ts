/**
 * Optional weekly study target per subject ("Matematik: haftada 8 sa"). Only the student's own
 * plan: shown as a progress bar in Haftalık and in the subject report card, never as a ranking,
 * and no reminder or notification is tied to it. Weeks are Istanbul weeks (Monday–Sunday).
 */

/** Targets move in half-hour steps. */
export const SUBJECT_TARGET_STEP_MIN = 30;
export const SUBJECT_TARGET_MIN_MIN = 30;
/** 40 hours a week for one subject is already more than anyone plans. */
export const SUBJECT_TARGET_MAX_MIN = 40 * 60;

const SUBJECT_ID = /^[a-z0-9_]+$/;

/** Subject id → weekly minutes. */
export type SubjectTargets = Record<string, number>;

/** A valid target in minutes, or `null` (none). Off-step values snap to the nearest step. */
export function normalizeSubjectTarget(minutes: unknown): number | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  const stepped = Math.round(minutes / SUBJECT_TARGET_STEP_MIN) * SUBJECT_TARGET_STEP_MIN;
  return Math.min(SUBJECT_TARGET_MAX_MIN, Math.max(SUBJECT_TARGET_MIN_MIN, stepped));
}

/** Stored or imported map → only valid subject ids with valid targets. */
export function normalizeSubjectTargets(value: unknown): SubjectTargets {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: SubjectTargets = {};
  for (const [id, minutes] of Object.entries(value as Record<string, unknown>)) {
    const target = normalizeSubjectTarget(minutes);
    if (target !== null && id.length <= 40 && SUBJECT_ID.test(id)) out[id] = target;
  }
  return out;
}

/** The target after one tap on − or +; below the minimum it is turned off (`null`). */
export function stepSubjectTarget(current: number | null, direction: 1 | -1): number | null {
  if (current === null) return direction === 1 ? SUBJECT_TARGET_MIN_MIN : null;
  const next = current + direction * SUBJECT_TARGET_STEP_MIN;
  return next < SUBJECT_TARGET_MIN_MIN ? null : Math.min(SUBJECT_TARGET_MAX_MIN, next);
}

export interface SubjectTargetProgress {
  targetMs: number;
  /** 0…1 (capped). */
  ratio: number;
  /** Whole percent, may be above 100. */
  percent: number;
  reached: boolean;
  /** What is left to the target this week (0 once reached). */
  leftMs: number;
}

export function subjectTargetProgress(weekMs: number, targetMinutes: number): SubjectTargetProgress {
  const targetMs = targetMinutes * 60_000;
  const ratio = targetMs <= 0 ? 0 : Math.min(1, Math.max(0, weekMs / targetMs));
  return {
    targetMs,
    ratio,
    percent: targetMs <= 0 ? 0 : Math.floor((weekMs * 100) / targetMs),
    reached: weekMs >= targetMs,
    leftMs: Math.max(0, targetMs - weekMs),
  };
}
