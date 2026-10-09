/// <reference types="node" />
/**
 * `useStored` (state/app-state.tsx) as the app really runs it: app.json turns on the React
 * Compiler (`experiments.reactCompiler`), which the device and web bundles apply but Jest's
 * transform does not. Every other test therefore sees the hand-written hook.
 *
 * The compiler memoises the `load()` call inside the "key changed" branch on `load` alone. A
 * loader with a stable identity (a module function such as `loadKeepAwake`, or an inline closure
 * the compiler itself memoised) is then read only on the first key change; every later change
 * returns that first value. Seen on web: Denemeler shows only the first of three exams saved in a
 * row until a reload; Ayarlar → "Sayaç çalışırken" no longer follows a tap after the exam area
 * was saved on the same screen (scripts/test-web.mjs works around it, see there).
 *
 * `it.failing` documents the bug: it turns red once `useStored` is fixed (then make it `it`).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { renderHook } from '@testing-library/react-native';

import { useStored as handWritten } from '../app-state';

type UseStored = typeof handWritten;

/** The source of `useStored`, compiled with babel-plugin-react-compiler like the app bundles. */
function compiledUseStored(): UseStored {
  const babel = require('@babel/core') as typeof import('@babel/core');
  const source = readFileSync(path.join(__dirname, '..', 'app-state.tsx'), 'utf8').replace(/\r\n/g, '\n');
  // From its declaration to the first closing brace at the start of a line.
  const match = /export function useStored[\s\S]*?\n\}\n/.exec(source);
  expect(match).not.toBeNull();
  const code = `import { useState } from 'react';\n${match![0]}`;
  const out = babel.transformSync(code, {
    filename: 'use-stored.tsx',
    babelrc: false,
    configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('babel-plugin-react-compiler'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const compiled = out?.code ?? '';
  // The compiler did run (it adds its memo cache) on the whole hook.
  expect(compiled).toContain('react/compiler-runtime');
  expect(compiled).toContain('setCache');
  const module = { exports: {} as { useStored?: UseStored } };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  return module.exports.useStored!;
}

/** A stored value read by a stable loader (like `loadKeepAwake`), changed between renders. */
function scenario(useStored: UseStored): number[] {
  let stored = 0;
  const load = () => stored;
  const { result, rerender } = renderHook(({ version }: { version: number }) => useStored(`k|${version}`, load), {
    initialProps: { version: 0 },
  });
  const seen = [result.current];
  for (let version = 1; version <= 3; version++) {
    stored = version * 10;
    rerender({ version });
    seen.push(result.current);
  }
  return seen;
}

it('hand-written useStored reads storage again on every key change', () => {
  expect(scenario(handWritten)).toEqual([0, 10, 20, 30]);
});

// Guards the it.failing below: it must fail on the assertion, not because compiling broke.
it('the React Compiler compiles useStored and the result renders', () => {
  const useStored = compiledUseStored();
  const { result } = renderHook(() => useStored('k', () => 7));
  expect(result.current).toBe(7);
});

// BUG: with the React Compiler only the first key change reads storage again ([0, 10, 10, 10]).
it.failing('compiled useStored reads storage again on every key change (React Compiler, as shipped)', () => {
  expect(scenario(compiledUseStored())).toEqual([0, 10, 20, 30]);
});
