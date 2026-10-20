#!/usr/bin/env node
/**
 * postinstall: patches expo-sqlite's web worker channel (node_modules/expo-sqlite/web/WorkerChannel.ts).
 * Only the web build uses that file, and only the web smoke test (`npm run test:web`) and
 * `npm run web` run the web build. The iOS app does not use it.
 *
 * 1. Timeout. invokeWorkerSync() blocks the main thread until the SQLite worker replies. It gave up
 *    after 1_000_000 Atomics.pause() spins. In Chromium that is about 0.1-0.2 s, not a fixed time:
 *    a cold worker start (`open`: worker bundle, wasm, OPFS) or a slow OPFS write took longer, threw
 *    "Sync operation timeout" and made the CI web smoke test flaky. The patch uses a 10 s wall-clock
 *    deadline. A worker that never replies still throws.
 * 2. Result length. sendWorkerResult() wrote the length with
 *    `resultArray.set(new Uint32Array([length]), 0)` into a Uint8Array, which keeps only
 *    `length % 256`. A synchronous result of 256 bytes or more came back truncated and failed in
 *    JSON.parse. Upstream fixed this in expo/expo#51330 (not released for SDK 57, expo-sqlite 57.0.4).
 *
 * The script stops with an error if expo-sqlite changed, so that an upgrade checks this patch again.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'node_modules', 'expo-sqlite', 'web', 'WorkerChannel.ts');
const MARKER = '[etut patch]';

const REPLACEMENTS = [
  {
    from: `    resultArray.set(new Uint32Array([length]), 0);\n`,
    to:
      `    // ${MARKER} a Uint32 view, so the length is not cut to its low byte (expo/expo#51330).\n` +
      `    new Uint32Array(resultBuffer, 0, 1)[0] = length;\n`,
  },
  {
    from: `  let i = 0;
  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
  const useAtomicsPause = typeof Atomics.pause === 'function';
  while (Atomics.load(lock, 0) === PENDING) {
    ++i;

    if (useAtomicsPause) {
      if (i > 1_000_000) {
        throw new Error('Sync operation timeout');
      }
      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
      Atomics.pause();
    } else {
      // NOTE(kudo): Unfortunate for the busy loop,
      // because we don't have a way for main thread to yield its execution to other callbacks.
      if (i > 1000_000_000) {
        throw new Error('Sync operation timeout');
      }
    }
  }
`,
    to: `  // ${MARKER} a wall-clock deadline instead of 1_000_000 Atomics.pause() spins (~0.1-0.2 s).
  const timeoutMs = 10_000;
  const deadline = performance.now() + timeoutMs;
  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
  const useAtomicsPause = typeof Atomics.pause === 'function';
  while (Atomics.load(lock, 0) === PENDING) {
    if (performance.now() > deadline) {
      throw new Error(\`Sync operation timeout: no reply to "\${type}" from the SQLite worker in \${timeoutMs} ms\`);
    }
    if (useAtomicsPause) {
      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
      Atomics.pause();
    }
  }
`,
  },
];

if (!existsSync(FILE)) {
  // npm ci --omit=dev or a partial install: nothing to patch.
  console.log(`[patch-expo-sqlite-web] ${path.relative(ROOT, FILE)} not found, skipped`);
  process.exit(0);
}

const original = readFileSync(FILE, 'utf8');
if (original.includes(MARKER)) {
  console.log('[patch-expo-sqlite-web] already patched');
  process.exit(0);
}

// A Windows checkout (core.autocrlf) gives this script CRLF lines; the npm file has LF.
const lf = (text) => text.replace(/\r\n/g, '\n');
let patched = original;
for (const { from: rawFrom, to: rawTo } of REPLACEMENTS) {
  const [from, to] = [lf(rawFrom), lf(rawTo)];
  const count = patched.split(from).length - 1;
  if (count !== 1) {
    console.error(
      `[patch-expo-sqlite-web] expo-sqlite/web/WorkerChannel.ts changed (expected 1 match, found ${count}):\n` +
        from +
        '\nCheck whether the new expo-sqlite still needs this patch, then update or remove ' +
        'scripts/patch-expo-sqlite-web.mjs.',
    );
    process.exit(1);
  }
  patched = patched.replace(from, to);
}
writeFileSync(FILE, patched);
console.log('[patch-expo-sqlite-web] patched expo-sqlite/web/WorkerChannel.ts (sync timeout, result length)');
