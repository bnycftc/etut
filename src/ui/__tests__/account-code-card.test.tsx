/**
 * The account code card (src/ui/account-code-card.tsx) against the fake server: it shows the
 * code and what it is for, copies it through the share sheet, offers a new code when the phone
 * lost its copy, and recovers from a failed call.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { ApiError } from '../../sync/api';
import { createFakeAccountCodeServer } from '../../sync/testing/account-code-fake';
import { accountCodeTr } from '../../strings-wp/account-code';
import { AccountCodeCard } from '../account-code-card';

jest.mock('@/strings', () => {
  const actual = jest.requireActual('@/strings');
  return { ...actual, DATA_CONTROLLER: { ...actual.DATA_CONTROLLER, contact: 'destek@ornek.com' } };
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('makes the code on first use and shows it with what it is for', async () => {
  const server = createFakeAccountCodeServer();
  render(<AccountCodeCard api={server.api} />);
  expect(await screen.findByText('ABCD-EFGH-JKLM')).toBeTruthy();
  expect(screen.getByTestId('account-code-value').props.accessibilityLabel).toBe(
    'Hesap kodun: A B C D - E F G H - J K L M',
  );
  expect(screen.getByTestId('account-code-value').props.selectable).toBe(true);
  // What it is for, where to send it, and that it is not to be shared.
  expect(screen.getByText(accountCodeTr.info('destek@ornek.com'))).toBeTruthy();
  expect(screen.getByText(/destek@ornek\.com/)).toBeTruthy();
  expect(screen.getByText(accountCodeTr.secret)).toBeTruthy();
  expect(screen.queryByTestId('account-code-missing')).toBeNull();
  expect(server.calls).toEqual(['accountCode']);
});

it('copies the code through the share sheet', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const server = createFakeAccountCodeServer();
  render(<AccountCodeCard api={server.api} />);
  fireEvent.press(await screen.findByTestId('account-code-copy'));
  expect(share).toHaveBeenCalledWith({ message: 'Etüt hesap kodum: ABCD-EFGH-JKLM' });
});

it('shows the saved copy again without making a new code', async () => {
  const server = createFakeAccountCodeServer();
  await server.api.accountCode();
  render(<AccountCodeCard api={server.api} />);
  expect(await screen.findByText('ABCD-EFGH-JKLM')).toBeTruthy();
  expect(server.calls).toEqual(['accountCode', 'accountCode']);
  expect(server.serverCode).toBe('ABCDEFGHJKLM');
});

it('offers a new code, after a warning, when the phone lost its copy', async () => {
  const server = createFakeAccountCodeServer();
  await server.api.accountCode();
  server.phoneCopy = null;
  render(<AccountCodeCard api={server.api} />);
  expect(await screen.findByTestId('account-code-missing')).toBeTruthy();
  expect(screen.queryByTestId('account-code-value')).toBeNull();

  // Cancel keeps the old code.
  fireEvent.press(screen.getByTestId('account-code-renew'));
  expect(screen.getByText(accountCodeTr.renewConfirm)).toBeTruthy();
  fireEvent.press(screen.getByTestId('account-code-renew-cancel'));
  expect(screen.queryByText(accountCodeTr.renewConfirm)).toBeNull();
  expect(server.serverCode).toBe('ABCDEFGHJKLM');

  fireEvent.press(screen.getByTestId('account-code-renew'));
  fireEvent.press(screen.getByTestId('account-code-renew-confirm'));
  expect(await screen.findByText('NPQR-STUV-WXYZ')).toBeTruthy();
  expect(screen.getByTestId('account-code-notice').props.children).toBe(accountCodeTr.renewed);
  expect(screen.queryByTestId('account-code-missing')).toBeNull();
  expect(server.serverCode).toBe('NPQRSTUVWXYZ');
});

it('says when the server cannot be reached and tries again', async () => {
  const server = createFakeAccountCodeServer();
  server.failNext = new ApiError('network');
  render(<AccountCodeCard api={server.api} />);
  expect(await screen.findByTestId('account-code-error')).toBeTruthy();
  expect(screen.getByTestId('account-code-error').props.children).toBe('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
  fireEvent.press(screen.getByTestId('account-code-retry'));
  expect(await screen.findByText('ABCD-EFGH-JKLM')).toBeTruthy();
  await waitFor(() => expect(screen.queryByTestId('account-code-error')).toBeNull());
});
