/**
 * The K-23 card (src/ui/minor-status-card.tsx) against the fake server: what is limited and how
 * a parent approves while the policy limits a 15–17 account, the day-14 reminder, and nothing at
 * all for everyone else.
 */

import { render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../sync/api';
import { createFakeMinorServer } from '../../sync/testing/minor-fake';
import { minorTr } from '../../strings-wp/minor';
import { MinorStatusCard } from '../minor-status-card';

const t = minorTr.card;

it('strict, no parent yet: what is limited, why, and how a parent approves', async () => {
  const server = createFakeMinorServer({ policy: 'strict', daysSinceSignup: 3 });
  render(<MinorStatusCard api={server.api} />);
  expect((await screen.findByTestId('minor-info')).props.children).toBe(t.strict);
  expect(screen.getByText(t.title)).toBeTruthy();
  expect(screen.getByText(t.why)).toBeTruthy();
  expect(screen.getByTestId('minor-next').props.children).toBe(t.notLinked);
  expect(screen.queryByTestId('minor-reminder')).toBeNull();
});

it('from day 14 it leads with the reminder', async () => {
  const server = createFakeMinorServer({ policy: 'basic', linked: true, daysSinceSignup: 14 });
  render(<MinorStatusCard api={server.api} />);
  expect((await screen.findByTestId('minor-reminder')).props.children).toBe(t.reminder);
  expect(screen.getByTestId('minor-info').props.children).toBe(t.basic);
  expect(screen.getByTestId('minor-next').props.children).toBe(t.waiting);
});

it('closed: explains, without asking for an approval that would change nothing', async () => {
  const server = createFakeMinorServer({ policy: 'closed', daysSinceSignup: 30 });
  render(<MinorStatusCard api={server.api} />);
  expect((await screen.findByTestId('minor-info')).props.children).toBe(t.closed);
  expect(screen.queryByTestId('minor-next')).toBeNull();
  expect(screen.queryByTestId('minor-reminder')).toBeNull();
});

it.each([
  ['approved', { policy: 'strict', linked: true, approved: true, daysSinceSignup: 20 }],
  ['open', { policy: 'open', daysSinceSignup: 20 }],
  ['18+', { policy: 'strict', band: '18_plus', daysSinceSignup: 20 }],
  ['no profile', { policy: 'closed', band: null, daysSinceSignup: null }],
] as const)('renders nothing when nothing is limited (%s)', async (_name, status) => {
  const server = createFakeMinorServer(status);
  render(<MinorStatusCard api={server.api} />);
  await waitFor(() => expect(server.calls).toEqual(['myMinorStatus']));
  expect(screen.queryByTestId('minor-status-card')).toBeNull();
});

it('renders nothing when the server cannot be reached', async () => {
  const server = createFakeMinorServer();
  server.failNext = new ApiError('network');
  render(<MinorStatusCard api={server.api} />);
  await waitFor(() => expect(server.calls).toEqual(['myMinorStatus']));
  expect(screen.queryByTestId('minor-status-card')).toBeNull();
});
