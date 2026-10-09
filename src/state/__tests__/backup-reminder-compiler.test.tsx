/// <reference types="node" />
/**
 * "Son yedek: bugün" (ui/backup-reminder.tsx) as the app really runs it, compiled with the React
 * Compiler like the device and web bundles (see use-stored-compiler.test.tsx for why Jest alone
 * does not show this). The compiler memoises `lastBackupText(last, Date.now())` on `last` alone, so
 * the line never aged while Ayarlar or Yedek stayed open: "bugün" was still shown days later.
 * The label now takes its time from `useNow`, which re-renders it as time passes.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { act, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

let mockLastBackupAt: number | null = null;

jest.mock('../app-state', () => ({
  ...jest.requireActual('../app-state'),
  useAppState: () => ({ dataVersions: { sessions: 0, exams: 0, topics: 0, settings: 0 } }),
}));

jest.mock('../../storage/kv', () => ({
  loadLastBackupAt: () => mockLastBackupAt,
  loadBackupNudgeDismissedAt: () => null,
  storeBackupNudgeDismissedAt: () => {},
}));

type LastBackupLabel = ComponentType<{ testID?: string; note?: boolean }>;

/** ui/backup-reminder.tsx compiled with babel-plugin-react-compiler, its imports resolved as in the app. */
function compiledLastBackupLabel(): LastBackupLabel {
  const babel = require('@babel/core') as typeof import('@babel/core');
  const dir = path.join(__dirname, '..', '..', 'ui');
  const source = readFileSync(path.join(dir, 'backup-reminder.tsx'), 'utf8');
  const out = babel.transformSync(source, {
    filename: path.join(dir, 'backup-reminder.tsx'),
    babelrc: false,
    configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [
      require.resolve('babel-plugin-react-compiler'),
      [require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  });
  const compiled = out?.code ?? '';
  // The compiler really memoised the component (the check below runs against its output).
  expect(compiled).toContain('react/compiler-runtime');
  const load = (id: string) => require(id.startsWith('.') ? path.join(dir, id) : id);
  const module = { exports: {} as { LastBackupLabel?: LastBackupLabel } };
  new Function('require', 'module', 'exports', compiled)(load, module, module.exports);
  return module.exports.LastBackupLabel!;
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

it('compiled "Son yedek" ages while the screen stays open (React Compiler, as shipped)', () => {
  // 7 Oct 2026, 10:00 Istanbul; the backup was made at 09:00 the same day.
  jest.setSystemTime(Date.parse('2026-10-07T07:00:00Z'));
  mockLastBackupAt = Date.parse('2026-10-07T06:00:00Z');
  const Label = compiledLastBackupLabel();
  render(<Label testID="last" />);
  expect(screen.getByTestId('last').props.children).toBe('Son yedek: bugün');

  // The next morning, nothing else re-renders the screen: only the passing minutes do.
  act(() => {
    jest.setSystemTime(Date.parse('2026-10-08T07:00:00Z') - 60_000);
    jest.advanceTimersByTime(60_000);
  });
  expect(screen.getByTestId('last').props.children).toBe('Son yedek: dün');

  act(() => {
    jest.setSystemTime(Date.parse('2026-10-10T07:00:00Z') - 60_000);
    jest.advanceTimersByTime(60_000);
  });
  expect(screen.getByTestId('last').props.children).toBe('Son yedek: 3 gün önce (7 Ekim 2026)');
});
