/// <reference types="node" />
/**
 * @jest-environment node
 *
 * expo-sqlite's web worker channel as patched by scripts/patch-expo-sqlite-web.mjs (postinstall).
 * invokeWorkerSync() blocks until the SQLite worker writes its reply into shared memory. Here a
 * real thread (worker_threads) stands in for the web worker: it answers after a delay, as a cold
 * worker start or a slow OPFS write did on CI. Unpatched, a reply later than ~0.1-0.2 s threw
 * "Sync operation timeout" and a reply of 256 bytes or more came back cut short.
 */

import { Worker } from 'node:worker_threads';

// `web/` is the TypeScript source that Metro bundles for the web build (not in the package exports).
const { invokeWorkerSync, sendWorkerResult } = require('../../../node_modules/expo-sqlite/web/WorkerChannel');

/** A thread that waits `delayMs`, then writes `{ result }` the way expo-sqlite's worker does. */
const THREAD = `
const { parentPort } = require('node:worker_threads');
parentPort.on('message', ({ lockBuffer, resultBuffer, delayMs, result }) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
  const bytes = new TextEncoder().encode(JSON.stringify({ result }));
  new Uint32Array(resultBuffer, 0, 1)[0] = bytes.length;
  new Uint8Array(resultBuffer).set(bytes, 4);
  Atomics.store(new Int32Array(lockBuffer), 0, 2);
});
`;

let thread: Worker;

beforeAll(() => {
  thread = new Worker(THREAD, { eval: true });
});

afterAll(async () => {
  await thread.terminate();
});

beforeEach(() => {
  // invokeWorkerSync warns once in __DEV__ about sync calls on web.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The web Worker that invokeWorkerSync posts to, forwarding to the thread with a reply delay. */
function workerReplyingAfter(delayMs: number, result: unknown) {
  return {
    postMessage: (message: { lockBuffer: SharedArrayBuffer; resultBuffer: SharedArrayBuffer }) =>
      thread.postMessage({ ...message, delayMs, result }),
  };
}

test('waits for a worker that needs a second to reply', () => {
  const started = Date.now();
  const result = invokeWorkerSync(workerReplyingAfter(1000, { changes: 1 }), 'run', {});
  expect(result).toEqual({ changes: 1 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(900);
});

test('returns a synchronous result of 256 bytes and more in full', () => {
  const value = 'x'.repeat(300);
  // The reply comes from expo-sqlite's own sendWorkerResult (the worker side of the channel).
  const worker = {
    postMessage: ({ id, lockBuffer, resultBuffer }: { id: number; lockBuffer: SharedArrayBuffer; resultBuffer: SharedArrayBuffer }) =>
      sendWorkerResult({ id, result: value, error: null, syncTrait: { lockBuffer, resultBuffer } }),
  };
  expect(invokeWorkerSync(worker, 'getColumnNames', {})).toBe(value);
});
