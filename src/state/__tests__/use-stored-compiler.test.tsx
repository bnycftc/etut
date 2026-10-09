/// <reference types="node" />
/**
 * `useStored` (state/app-state.tsx) as the app really runs it: app.json turns on the React
 * Compiler (`experiments.reactCompiler`), which the device and web bundles apply but Jest's
 * transform does not. Every other test therefore sees the hand-written hook.
 *
 * Compiled, the compiler memoised the `load()` call inside the "key changed" branch on `load`
 * alone. A loader with a stable identity (a module function such as `loadKeepAwake`, or an inline
 * closure the compiler itself memoised) was then read only on the first key change; every later
 * change returned that first value ([0, 10, 10, 10]). Seen on web: Denemeler showed only the first
 * of three exams saved in a row until a reload. `useStored` now opts out with 'use no memo'; this
 * file compiles the real source with the compiler and proves the bundles read storage every time.
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
  // The compiler ran over the source and left the hook alone because of 'use no memo': no memo
  // cache was added. (Without the directive it imports react/compiler-runtime here.)
  expect(compiled).toContain('use no memo');
  expect(compiled).not.toContain('react/compiler-runtime');
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

// The compiled module loads and renders, so the check below tests behaviour, not a compile error.
it('the React Compiler output of useStored renders', () => {
  const useStored = compiledUseStored();
  const { result } = renderHook(() => useStored('k', () => 7));
  expect(result.current).toBe(7);
});

// Regression: with the compiler applied, only the first key change used to read storage again.
it('compiled useStored reads storage again on every key change (React Compiler, as shipped)', () => {
  expect(scenario(compiledUseStored())).toEqual([0, 10, 20, 30]);
});
