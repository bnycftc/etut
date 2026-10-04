/**
 * Rules of the (optional, server-backed) group module that the app applies before talking to the
 * server. The server enforces the same rules again (supabase/migrations); these exist so the app
 * can decide what to show and what to send.
 */

import { minimumAge, SOLO_AGE_LIMIT } from './profile';

/** Only the band leaves the device, never the birth year (hukuk/03 K-16, K-19, K-33). */
export type AgeBand = '15_17' | '18_plus';

export const ADULT_AGE = 18;

/**
 * Age band from the declared birth year, with the lower possible age (K-17). `null` = under 15
 * (or possibly under 15): no server account at all (K-16).
 */
export function ageBandFor(birthYear: number, currentYear: number): AgeBand | null {
  const age = minimumAge(birthYear, currentYear);
  if (age < SOLO_AGE_LIMIT) return null;
  return age >= ADULT_AGE ? '18_plus' : '15_17';
}

/** Parent mode is for adults only (the parent declares an adult birth year on their device). */
export function canUseParentMode(birthYear: number, currentYear: number): boolean {
  return minimumAge(birthYear, currentYear) >= ADULT_AGE;
}

export type NameKind = 'nickname' | 'group';
export type NameError = 'name_length' | 'name_chars';

const NAME_MAX: Record<NameKind, number> = { nickname: 20, group: 24 };
const NAME_MIN = 3;
const ALLOWED = /^[A-Za-z0-9çğıöşüâîûÇĞİÖŞÜÂÎÛ ._-]+$/;
const LETTER = /[A-Za-zçğıöşüâîûÇĞİÖŞÜÂÎÛ]/;

/** Trimmed, inner whitespace collapsed: the form the server stores. */
export function cleanName(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Quick local check (length, characters) so the student gets feedback before sending. The word
 * filter and personal-data patterns run on the server only (K-26, K-27).
 */
export function checkNameLocally(text: string, kind: NameKind): NameError | null {
  const name = cleanName(text);
  if (name.length < NAME_MIN || name.length > NAME_MAX[kind]) return 'name_length';
  if (!ALLOWED.test(name) || !LETTER.test(name)) return 'name_chars';
  return null;
}

export function nameMaxLength(kind: NameKind): number {
  return NAME_MAX[kind];
}

/** Codes are typed by people: ignore case, spaces and dashes (same as the server). */
export function normalizeCode(text: string): string {
  return text.replace(/[\s-]/g, '').toUpperCase();
}

export function isCodeShaped(text: string): boolean {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(normalizeCode(text));
}

/** `ABCDEFGH` → `ABCD-EFGH` for reading aloud. */
export function formatCode(code: string): string {
  const c = normalizeCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Fixed reaction set (K-07): no free text. */
export const REACTION_KINDS = ['tebrik', 'hadi', 'helal', 'basarilar'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

/** Fixed report reasons (no free text, K-09). `danger` = threat or self-harm risk (K-29). */
export const REPORT_REASONS = ['nickname', 'group_name', 'harassment', 'danger', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** How often the live status is refreshed while a session is open (one row update). */
export const HEARTBEAT_INTERVAL_MS = 5 * 60_000;
/** Group screens poll at most this often (no realtime socket). */
export const GROUP_REFRESH_MS = 30_000;

/** Daily limit of the group module set by a parent (K-22 c); `null` = no limit. */
export function usageLimitReached(usedMs: number, limitMinutes: number | null): boolean {
  return limitMinutes !== null && usedMs >= limitMinutes * 60_000;
}

export const DAILY_LIMIT_MIN = 15;
export const DAILY_LIMIT_MAX = 600;
export const DAILY_LIMIT_STEP = 15;

/** Steps the parent's daily limit; below the minimum means "no limit" (`null`). */
export function stepDailyLimit(current: number | null, direction: 1 | -1): number | null {
  if (current === null) return direction === 1 ? DAILY_LIMIT_MIN : null;
  const next = current + direction * DAILY_LIMIT_STEP;
  if (next < DAILY_LIMIT_MIN) return null;
  return Math.min(DAILY_LIMIT_MAX, next);
}

/** Milliseconds a member has been studying, drawn by the app from the server start time. */
export function liveElapsedMs(startedAtIso: string | null, now: number): number {
  if (startedAtIso === null) return 0;
  const start = Date.parse(startedAtIso);
  return Number.isFinite(start) ? Math.max(0, now - start) : 0;
}
