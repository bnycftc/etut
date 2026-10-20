/**
 * src/domain/minor-policy.ts: the app's copy of the server's permission table (K-23,
 * supabase/tests/12_minor_policy.test.sql checks the server's), the day-14 reminder and what the
 * parent screen offers.
 */

import {
  allowedActions,
  APPROVAL_REMINDER_DAY,
  canCreateProfile,
  MINOR_POLICIES,
  type MinorPolicy,
  minorRestriction,
  type MinorStatus,
  parentActions,
  showApprovalReminder,
  toMinorPolicy,
} from '../minor-policy';

const teen = (policy: MinorPolicy, more: Partial<MinorStatus> = {}): MinorStatus => ({
  policy,
  band: '15_17',
  linked: false,
  approved: false,
  daysSinceSignup: 0,
  ...more,
});

const NONE = { account: true, joinGroups: false, createGroup: false, reactions: false, liveStatus: 'off' };
const BASIC = { account: true, joinGroups: true, createGroup: false, reactions: false, liveStatus: 'hidden' };
const ALL = { account: true, joinGroups: true, createGroup: true, reactions: true, liveStatus: 'own_choice' };

it.each([
  ['closed', false, 'closed', NONE],
  ['closed', true, 'closed', NONE],
  ['strict', false, 'strict', NONE],
  ['strict', true, null, ALL],
  ['basic', false, 'basic', BASIC],
  ['basic', true, null, ALL],
  ['open', false, null, ALL],
  ['open', true, null, ALL],
] as const)('15–17 under %s (approved: %s)', (policy, approved, restriction, actions) => {
  const s = teen(policy, { linked: approved, approved });
  expect(minorRestriction(s)).toBe(restriction);
  expect(allowedActions(s)).toEqual({ ...actions, parentLink: true });
});

it('an adult or a user without a profile is never restricted', () => {
  for (const policy of MINOR_POLICIES) {
    for (const band of ['18_plus', null] as const) {
      const s = teen(policy, { band });
      expect(minorRestriction(s)).toBeNull();
      expect(allowedActions(s)).toEqual({ ...ALL, parentLink: false });
      expect(showApprovalReminder({ ...s, daysSinceSignup: 30 })).toBe(false);
    }
  }
});

it('a new 15–17 profile is refused only while closed', () => {
  expect(canCreateProfile('closed', '15_17')).toBe(false);
  expect(canCreateProfile('closed', '18_plus')).toBe(true);
  for (const policy of ['strict', 'basic', 'open'] as const) expect(canCreateProfile(policy, '15_17')).toBe(true);
});

it('reminds from day 14 while an approval would lift something', () => {
  expect(APPROVAL_REMINDER_DAY).toBe(14);
  for (const policy of ['strict', 'basic'] as const) {
    expect(showApprovalReminder(teen(policy, { daysSinceSignup: 13 }))).toBe(false);
    expect(showApprovalReminder(teen(policy, { daysSinceSignup: 14 }))).toBe(true);
    expect(showApprovalReminder(teen(policy, { daysSinceSignup: 14, linked: true }))).toBe(true);
    expect(showApprovalReminder(teen(policy, { daysSinceSignup: 40, linked: true, approved: true }))).toBe(false);
  }
  // Closed: an approval changes nothing, so there is nothing to remind of. Open: nothing to wait for.
  expect(showApprovalReminder(teen('closed', { daysSinceSignup: 40 }))).toBe(false);
  expect(showApprovalReminder(teen('open', { daysSinceSignup: 40 }))).toBe(false);
  expect(showApprovalReminder(teen('strict', { daysSinceSignup: null }))).toBe(false);
});

it('offers the parent approval where it lifts something, objection always', () => {
  expect(parentActions('strict', false)).toEqual({ approve: true, object: true });
  expect(parentActions('basic', false)).toEqual({ approve: true, object: true });
  expect(parentActions('strict', true)).toEqual({ approve: false, object: true });
  expect(parentActions('closed', false)).toEqual({ approve: false, object: true });
  expect(parentActions('open', false)).toEqual({ approve: false, object: true });
});

it('reads an unknown policy from the server as closed', () => {
  expect(toMinorPolicy('basic')).toBe('basic');
  expect(toMinorPolicy('everything')).toBe('closed');
  expect(toMinorPolicy(null)).toBe('closed');
});
