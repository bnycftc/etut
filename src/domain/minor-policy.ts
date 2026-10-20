/**
 * K-23: what a 15–17 group account may do before a parent approves. The rule in force is a
 * server setting (app.settings.minor_policy, supabase/migrations/*_etut_minor_policy.sql), because
 * the final choice is the lawyer's; this module mirrors the server's app.minor_restriction so the
 * app can explain the limits. The server enforces them either way.
 *
 *   closed  15–17 is not served: no 15–17 profile; an existing one keeps account + parent link.
 *   strict  until approval: account and parent link only.
 *   basic   until approval: may join groups (always invisible), no reactions, no new group.
 *   open    no restriction.
 */

import type { AgeBand } from './groups';

export type MinorPolicy = 'closed' | 'strict' | 'basic' | 'open';

export const MINOR_POLICIES: readonly MinorPolicy[] = ['closed', 'strict', 'basic', 'open'];

/** The caller's standing, as my_minor_status() returns it. */
export interface MinorStatus {
  policy: MinorPolicy;
  /** null = no group profile yet. */
  band: AgeBand | null;
  /** At least one parent is linked. */
  linked: boolean;
  /** At least one linked parent approved. */
  approved: boolean;
  /** Istanbul days since the profile was made; null = no profile. */
  daysSinceSignup: number | null;
}

/** The restriction that applies now; null = none (not 15–17, open, or approved). */
export type MinorRestriction = Exclude<MinorPolicy, 'open'> | null;

export function minorRestriction(s: MinorStatus): MinorRestriction {
  if (s.band !== '15_17' || s.policy === 'open') return null;
  if (s.policy === 'closed') return 'closed';
  return s.approved ? null : s.policy;
}

/** Live status as others see it: shown (own choice applies), always hidden, or not sent. */
export type LiveStatus = 'own_choice' | 'hidden' | 'off';

export interface MinorActions {
  /** Own account: profile, preferences, deletion, account code. Always. */
  account: boolean;
  /** Making a parent code and the parent link. Always for 15–17. */
  parentLink: boolean;
  /** Asking to join, the group list, board and ranking. */
  joinGroups: boolean;
  createGroup: boolean;
  /** Sending and receiving ready-made reactions. */
  reactions: boolean;
  liveStatus: LiveStatus;
}

export function allowedActions(s: MinorStatus): MinorActions {
  const r = minorRestriction(s);
  const parentLink = s.band === '15_17';
  if (r === 'closed' || r === 'strict') {
    return { account: true, parentLink, joinGroups: false, createGroup: false, reactions: false, liveStatus: 'off' };
  }
  if (r === 'basic') {
    return { account: true, parentLink, joinGroups: true, createGroup: false, reactions: false, liveStatus: 'hidden' };
  }
  return { account: true, parentLink, joinGroups: true, createGroup: true, reactions: true, liveStatus: 'own_choice' };
}

/** A new profile with this band is accepted under the policy. */
export function canCreateProfile(policy: MinorPolicy, band: AgeBand): boolean {
  return band !== '15_17' || policy !== 'closed';
}

/** Day of the reminder that the parent has not approved yet (K-23: "örneğin 14 gün sonra"). */
export const APPROVAL_REMINDER_DAY = 14;

/** Waiting for an approval that would lift a restriction, for 14 days or more. */
export function showApprovalReminder(s: MinorStatus): boolean {
  const r = minorRestriction(s);
  return (r === 'strict' || r === 'basic') && (s.daysSinceSignup ?? 0) >= APPROVAL_REMINDER_DAY;
}

/**
 * What the parent screen offers for one linked student. Approving matters only where it lifts
 * something ('strict', 'basic') and is offered until a linked parent approved. Objecting (deletes
 * the student's group account) is offered in every policy.
 */
export function parentActions(policy: MinorPolicy, approved: boolean): { approve: boolean; object: boolean } {
  return { approve: (policy === 'strict' || policy === 'basic') && !approved, object: true };
}

/** An unknown value from the server counts as the strictest rule. */
export function toMinorPolicy(value: unknown): MinorPolicy {
  return (MINOR_POLICIES as readonly unknown[]).includes(value) ? (value as MinorPolicy) : 'closed';
}
