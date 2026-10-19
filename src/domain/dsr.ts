/**
 * KVKK applications ("ilgili kişi başvurusu", KVKK m.11, m.13; hukuk/03 K-31, K-38) made in the
 * app. The server applies the same rules again (supabase/migrations/*_etut_requests.sql); these
 * exist so the form can say what is missing before anything is sent.
 */

import { DAY_MS } from './istanbul-day';

/** The rights of KVKK m.11/1 in order, then "Şikâyet / bildirim" (K-31) and "Diğer". */
export const REQUEST_KINDS = [
  'processed',
  'info',
  'purpose',
  'recipients',
  'correction',
  'deletion',
  'notify_recipients',
  'automated_decision',
  'damages',
  'complaint',
  'other',
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** Who applies: the account holder, or a parent for their child (kvkk/07 C2). */
export const REQUEST_APPLICANTS = ['self', 'parent'] as const;
export type RequestApplicant = (typeof REQUEST_APPLICANTS)[number];

export type AnswerResult = 'accepted' | 'partial' | 'rejected';

export const REQUEST_BODY_MAX = 2000;

/** KVKK m.13/2: the answer is due within 30 days of the application. */
export const ANSWER_DAYS = 30;

/** Kinds that mean nothing without a few words of explanation. */
export function bodyRequired(kind: RequestKind): boolean {
  return kind === 'other' || kind === 'complaint';
}

export type RequestInputError = 'body_required' | 'body_too_long';

/** What is wrong with the form, `null` when it can be sent. Spaces around the text do not count. */
export function checkRequestInput(kind: RequestKind, body: string): RequestInputError | null {
  const text = body.trim();
  if (text.length > REQUEST_BODY_MAX) return 'body_too_long';
  if (text.length === 0 && bodyRequired(kind)) return 'body_required';
  return null;
}

/** The deadline the server sets: 30 calendar days later (Istanbul has no daylight saving). */
export function dueAtMs(createdAtMs: number): number {
  return createdAtMs + ANSWER_DAYS * DAY_MS;
}

export type RequestState = 'open' | 'overdue' | 'answered';

export function requestState(request: { answeredAt: string | null; dueAt: string }, nowMs: number): RequestState {
  if (request.answeredAt !== null) return 'answered';
  return Date.parse(request.dueAt) < nowMs ? 'overdue' : 'open';
}

/** An answer the applicant has not opened yet. */
export function isUnseenAnswer(request: { answeredAt: string | null; seenAt: string | null }): boolean {
  return request.answeredAt !== null && request.seenAt === null;
}
