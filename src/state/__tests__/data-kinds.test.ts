/**
 * Which versions a change moves on (`notifyDataChanged`). The screens key their storage reads on
 * the versions of the kinds they read; app-smoke.test.tsx checks those reads on the real screens.
 */

import { bumpVersions, type ChangedKinds, DATA_KINDS, type DataVersions, NO_CHANGES } from '../data-kinds';

it('moves on only the kinds a change names', () => {
  expect(bumpVersions(NO_CHANGES, ['topics'])).toEqual({ sessions: 0, exams: 0, topics: 1, settings: 0 });
  expect(bumpVersions(NO_CHANGES, ['exams', 'settings'])).toEqual({ sessions: 0, exams: 1, topics: 0, settings: 1 });
});

it('a kind named twice in one change moves on once', () => {
  expect(bumpVersions(NO_CHANGES, ['sessions', 'sessions'])).toEqual({ ...NO_CHANGES, sessions: 1 });
});

it('a restore or "delete all" moves on every kind', () => {
  const before: DataVersions = { sessions: 3, exams: 1, topics: 0, settings: 7 };
  expect(bumpVersions(before, DATA_KINDS)).toEqual({ sessions: 4, exams: 2, topics: 1, settings: 8 });
});

it('returns new versions and leaves the old ones as they were (React state)', () => {
  const before: DataVersions = { sessions: 1, exams: 1, topics: 1, settings: 1 };
  const after = bumpVersions(before, ['exams']);
  expect(after).not.toBe(before);
  expect(before).toEqual({ sessions: 1, exams: 1, topics: 1, settings: 1 });
});

it('a change must say what changed (checked by tsc)', () => {
  const notify = (...kinds: ChangedKinds) => kinds;
  // @ts-expect-error No kind: "anything may have changed" is spelled out as ...DATA_KINDS.
  notify();
  // @ts-expect-error The profile is React state, not a kind of stored data.
  notify('profile');
  expect(notify(...DATA_KINDS)).toEqual(['sessions', 'exams', 'topics', 'settings']);
});
