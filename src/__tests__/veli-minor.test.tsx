/**
 * K-23 on the parent screen (app/veli.tsx) against the fake servers: "Onaylıyorum" records the
 * parent's approval, "İtiraz ediyorum" deletes the student's group account only after a clear
 * confirmation, and the screen works on without the approvals when they cannot be read.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ParentScreen from '../../app/veli';
import { ApiError, setGroupApiForTests } from '../sync/api';
import { setMinorApiForTests } from '../sync/minor-api';
import { createFakeServer, type FakeServer } from '../sync/testing/fake-api';
import { createFakeMinorServer, type FakeMinorServer } from '../sync/testing/minor-fake';
import { tr } from '../strings';
import type { MinorPolicy } from '../domain/minor-policy';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('@/state/app-state', () => ({ useAppState: () => ({ profile: { birthYear: 1980 } }) }));
jest.mock('@/storage/groups-kv', () => ({ loadParentAccount: () => true, storeParentAccount: () => {} }));

const m = tr.minor.parent;
let groups: FakeServer;
let minor: FakeMinorServer;

function setup(policy: MinorPolicy, approval: { approvedAt?: string | null; approved?: boolean } = {}) {
  groups = createFakeServer();
  groups.children = [
    {
      childId: 'child-1',
      nickname: 'Genç Öğrenci',
      groupsDisabled: false,
      forceInvisible: false,
      dailyLimitMinutes: null,
      linkedAt: '2026-10-01T09:00:00.000Z',
      otherParents: 0,
    },
  ];
  minor = createFakeMinorServer();
  minor.approvals = [{ childId: 'child-1', approvedAt: null, approved: false, policy, ...approval }];
  // An objection deletes the student: the link is gone for the group server too.
  const object = minor.api.parentObject;
  minor.api.parentObject = async (childId) => {
    await object(childId);
    groups.children = groups.children.filter((c) => c.childId !== childId);
  };
  setGroupApiForTests(groups.api);
  setMinorApiForTests(minor.api);
}

afterEach(() => {
  setGroupApiForTests(null);
  setMinorApiForTests(null);
});

it('strict: explains the limits and records the approval', async () => {
  setup('strict');
  render(<ParentScreen />);
  expect(await screen.findByText(m.approveInfo('strict'))).toBeTruthy();
  fireEvent.press(screen.getByTestId('parent-approve-0'));
  await waitFor(() => expect(screen.getByTestId('parent-notice').props.children).toBe(m.approvedNotice));
  expect(minor.calls).toContain('parentApprove:child-1');
  expect((await screen.findByTestId('parent-approved-0')).props.children).toBe(m.approvedOn('2026-10-20'));
  expect(screen.queryByTestId('parent-approve-0')).toBeNull();
  expect(screen.queryByText(m.approveInfo('strict'))).toBeNull();
});

it('basic: says what is limited under basic', async () => {
  setup('basic');
  render(<ParentScreen />);
  expect(await screen.findByText(m.approveInfo('basic'))).toBeTruthy();
});

it('another parent approved: no second approval is asked for', async () => {
  setup('strict', { approved: true });
  render(<ParentScreen />);
  expect((await screen.findByTestId('parent-approved-0')).props.children).toBe(m.approvedByOther);
  expect(screen.queryByTestId('parent-approve-0')).toBeNull();
  expect(screen.getByTestId('parent-object-0')).toBeTruthy();
});

it.each(['open', 'closed'] as const)('%s: no approval to give, objecting stays possible', async (policy) => {
  setup(policy);
  render(<ParentScreen />);
  expect(await screen.findByTestId('parent-object-0')).toBeTruthy();
  expect(screen.queryByTestId('parent-approve-0')).toBeNull();
});

it('objecting deletes the group account only after a clear confirmation', async () => {
  setup('strict');
  render(<ParentScreen />);
  fireEvent.press(await screen.findByTestId('parent-object-0'));
  const text = screen.getByTestId('parent-object-text-0').props.children as string;
  expect(text).toBe(m.objectConfirm('Genç Öğrenci'));
  expect(text).toContain('“Genç Öğrenci” adlı grup hesabı');
  expect(text).toContain('silinir');
  expect(text).toContain('geri alınamaz');
  expect(screen.getByText(m.objectYes)).toBeTruthy();

  // Vazgeç: nothing happens.
  fireEvent.press(screen.getByTestId('parent-object-cancel-0'));
  expect(screen.queryByTestId('parent-object-text-0')).toBeNull();
  expect(minor.objected).toEqual([]);

  fireEvent.press(screen.getByTestId('parent-object-0'));
  fireEvent.press(screen.getByTestId('parent-object-confirm-0'));
  await waitFor(() => expect(screen.getByTestId('parent-notice').props.children).toBe(m.objected));
  expect(minor.objected).toEqual(['child-1']);
  await waitFor(() => expect(screen.queryByTestId('parent-child-0')).toBeNull());
});

it('a failed objection keeps the student and says why', async () => {
  setup('strict');
  render(<ParentScreen />);
  fireEvent.press(await screen.findByTestId('parent-object-0'));
  minor.failNext = new ApiError('network');
  fireEvent.press(screen.getByTestId('parent-object-confirm-0'));
  await waitFor(() => expect(screen.getByTestId('parent-error')).toBeTruthy());
  expect(minor.objected).toEqual([]);
  expect(screen.getByTestId('parent-child-0')).toBeTruthy();
});

it('without the approvals the rest of the screen still works', async () => {
  setup('strict');
  minor.failNext = new ApiError('network');
  render(<ParentScreen />);
  expect((await screen.findByTestId('parent-child-0')).props.children).toBe('Genç Öğrenci');
  await waitFor(() => expect(minor.calls).toEqual(['parentApprovals']));
  expect(screen.queryByTestId('parent-approve-0')).toBeNull();
  expect(screen.queryByTestId('parent-object-0')).toBeNull();
  expect(screen.queryByTestId('parent-error')).toBeNull();
});
