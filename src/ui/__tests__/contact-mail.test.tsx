/**
 * The e-mail of Hakkında → İletişim and Ayarlar → Geri bildirim gönder once the address is filled
 * in: subject with the app and OS version only, no body (src/domain/contact.ts).
 */

import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { useContactMail } from '../contact-mail';

jest.mock('@/strings', () => {
  const actual = jest.requireActual('@/strings');
  return { ...actual, DATA_CONTROLLER: { ...actual.DATA_CONTROLLER, contact: 'destek@ornek.com' } };
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('opens a mailto with only the prefilled subject', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const { result } = renderHook(() => useContactMail());
  expect(result.current.email).toBe('destek@ornek.com');
  await act(async () => result.current.open());
  expect(open).toHaveBeenCalledTimes(1);
  const url = open.mock.calls[0][0];
  expect(url.startsWith('mailto:destek@ornek.com?subject=')).toBe(true);
  expect(url).not.toContain('body=');
  expect(decodeURIComponent(url.split('subject=')[1])).toMatch(/^Etüt geri bildirim · sürüm .+ \(.+\) · iOS /);
  expect(result.current.failed).toBe(false);
});

it('says so when no mail app opens', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no mail app'));
  const { result } = renderHook(() => useContactMail());
  await act(async () => result.current.open());
  expect(result.current.failed).toBe(true);
});
