/**
 * The group module may only be switched on once the legal and store requirements around it exist
 * (K-23, K-25, K-28/K-29, K-31, K-37, K-38, K-42). Each open item is listed in
 * GROUPS_LAUNCH_BLOCKERS; this fails as soon as the flag is on while any is left.
 */

import { GROUPS_ENABLED, GROUPS_LAUNCH_BLOCKERS } from '../features';
import { PRIVACY_NOTICE_URL } from '../legal';

describe('group module launch gate', () => {
  it('is not switched on with open launch blockers', () => {
    expect(GROUPS_ENABLED ? GROUPS_LAUNCH_BLOCKERS : []).toEqual([]);
  });

  it('is not switched on without the published privacy notice', () => {
    expect(GROUPS_ENABLED && PRIVACY_NOTICE_URL === null).toBe(false);
  });
});
