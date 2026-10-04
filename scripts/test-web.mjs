#!/usr/bin/env node
/**
 * Web smoke test (`npm run test:web`).
 *
 * Starts its own Expo web dev server, drives the real app in headless Chromium (Playwright) and
 * stops the server again. Same app code, same SQLite schema and migrations as on iOS (expo-sqlite
 * web = wa-sqlite in a worker, stored in the browser's origin private file system).
 *
 * Checks: page is cross-origin isolated, no console errors / uncaught exceptions, onboarding →
 * timer (start, pause, resume, finish) → reload keeps the profile → mock exam with the right net →
 * reload keeps the exam → "delete all data" returns to onboarding.
 *
 * Environment:
 *   WEB_TEST_PORT     first port to try (default 8090; the next free port is used if busy)
 *   WEB_TEST_CHANNEL  Playwright browser channel ("chrome", "msedge"). Default: Playwright's own
 *                     Chromium if installed, otherwise installed Chrome, then Edge.
 *   WEB_TEST_HEADED=1 show the browser window
 * Screenshots and the dev server log go to test-results/web/.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'test-results', 'web');
const EXPO_CLI = path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli');
const FIRST_PORT = Number(process.env.WEB_TEST_PORT ?? 8090);
const SERVER_START_TIMEOUT_MS = 180_000;
/** The first web bundle is built on demand and can take a while on a cold Metro cache. */
const FIRST_SCREEN_TIMEOUT_MS = 240_000;
const STEP_TIMEOUT_MS = 15_000;

function log(message) {
  console.log(`[test:web] ${message}`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function findFreePort(start) {
  for (let port = start; port < start + 50; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`no free port in ${start}-${start + 49}`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Starts `expo start --web` as a direct child process (no shell), so it can be stopped reliably. */
function startDevServer(port) {
  const output = [];
  const child = spawn(
    process.execPath,
    [EXPO_CLI, 'start', '--web', '--port', String(port), '--offline'],
    {
      cwd: ROOT,
      env: { ...process.env, CI: '1', BROWSER: 'none', EXPO_NO_TELEMETRY: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));
  let exited = false;
  const exitPromise = new Promise((resolve) => child.once('exit', () => resolve()));
  child.once('exit', () => {
    exited = true;
  });

  return {
    output,
    hasExited: () => exited,
    async stop() {
      if (!exited) {
        child.kill();
        await Promise.race([exitPromise, delay(10_000)]);
      }
      writeFileSync(path.join(OUT_DIR, 'expo-dev-server.log'), output.join(''));
    },
  };
}

async function waitForServer(server, url) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.hasExited()) throw new Error('Expo dev server exited:\n' + server.output.join(''));
    try {
      const response = await fetch(url);
      if (response.ok) {
        const coop = response.headers.get('cross-origin-opener-policy');
        const coep = response.headers.get('cross-origin-embedder-policy');
        log(`dev server ready (COOP=${coop}, COEP=${coep})`);
        return;
      }
    } catch {
      // not listening yet
    }
    await delay(1000);
  }
  throw new Error('Expo dev server did not start in time:\n' + server.output.join(''));
}

async function launchBrowser() {
  const headless = process.env.WEB_TEST_HEADED !== '1';
  const channels = process.env.WEB_TEST_CHANNEL
    ? [process.env.WEB_TEST_CHANNEL]
    : [undefined, 'chrome', 'msedge'];
  const failures = [];
  for (const channel of channels) {
    try {
      const browser = await chromium.launch({ channel, headless });
      log(`browser: ${channel ?? 'playwright chromium'} ${browser.version()}`);
      return browser;
    } catch (error) {
      failures.push(`${channel ?? 'playwright chromium'}: ${String(error).split('\n')[0]}`);
    }
  }
  throw new Error(
    'No Chromium-based browser found. Run `npx playwright install chromium` or install Chrome/Edge.\n' +
      failures.join('\n'),
  );
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** Polls `read()` until `predicate` holds; returns the last value. */
async function waitUntil(read, predicate, description, timeout = STEP_TIMEOUT_MS) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await delay(200);
  }
  throw new Error(`timed out waiting for ${description} (last value: ${JSON.stringify(value)})`);
}

async function runScenario(page, baseUrl) {
  let shot = 0;
  const screenshot = async (name) => {
    shot += 1;
    await page.screenshot({ path: path.join(OUT_DIR, `${String(shot).padStart(2, '0')}-${name}.png`) });
  };
  const byId = (id) => page.getByTestId(id, { exact: true });
  const visible = (id, timeout = STEP_TIMEOUT_MS) => byId(id).waitFor({ state: 'visible', timeout });
  const text = async (id) => ((await byId(id).textContent()) ?? '').trim();

  // 1. First launch: onboarding, nothing pre-selected.
  log('step: onboarding');
  await page.goto(baseUrl);
  await visible('onboarding-start', FIRST_SCREEN_TIMEOUT_MS);
  check(await page.getByText('Doğum yılın').isVisible(), 'onboarding title is missing');
  check(await page.evaluate(() => self.crossOriginIsolated), 'page is not cross-origin isolated');
  check(
    (await byId('onboarding-start').getAttribute('aria-disabled')) === 'true',
    'start button must be disabled before answering',
  );
  await screenshot('onboarding');

  const birthYear = new Date().getFullYear() - 20;
  await byId(`birth-year-${birthYear}`).click();
  await byId('exam-type-YKS').click();
  await visible('yks-area-sayisal');
  await byId('yks-area-sayisal').click();
  await byId('onboarding-start').click();

  // 2. Timer: start, runs, pause, resume, finish.
  log('step: timer');
  await visible('timer-start');
  check(await byId('tab-groups').isVisible(), 'a 15+ profile must see the groups tab');
  await screenshot('timer-idle');
  await byId('subject-fizik').click();
  await byId('timer-start').click();
  await visible('timer-clock');
  check((await text('timer-subject')) === 'Fizik', 'running subject should be Fizik');
  const seconds = (clock) => clock.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  await waitUntil(() => text('timer-clock'), (clock) => seconds(clock) >= 2, 'clock to reach 0:02');
  await screenshot('timer-running');
  await byId('timer-pause').click();
  await waitUntil(() => text('timer-status'), (s) => s === 'Moladasın', 'paused status');
  await byId('timer-resume').click();
  await waitUntil(() => text('timer-status'), (s) => s === 'Çalışıyorsun', 'running status');
  await byId('timer-finish').click();
  await visible('timer-saved');
  check((await text('timer-saved')).startsWith('Kaydedildi'), 'finished session was not saved');
  await screenshot('timer-finished');

  // 2b. The group module is off (src/config/features.ts): the tab stays "Yakında" and no request
  //     ever leaves the dev server (checked for the whole run in main()).
  log('step: groups tab (module off)');
  await byId('tab-groups').click();
  await page.getByText('Yakında').waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
  check(!(await byId('groups-intro').isVisible()), 'the group module must stay off');
  await screenshot('groups-off');
  await byId('tab-timer').click();
  await visible('timer-start');

  // 3. Reload: the profile comes back from the kv-store (no onboarding).
  log('step: reload keeps profile');
  await page.reload();
  await visible('timer-start', FIRST_SCREEN_TIMEOUT_MS);
  check(!(await byId('onboarding-start').isVisible()), 'onboarding shown again after reload');

  // 4. Mock exam: TYT, Türkçe 10 doğru 4 yanlış (= 9 net), Matematik 20 doğru 8 yanlış (= 18 net).
  log('step: mock exam');
  await byId('tab-exams').click();
  await visible('exams-add');
  await byId('exams-add').click();
  await visible('exam-correct-turkce');
  await byId('exam-correct-turkce').fill('10');
  await byId('exam-wrong-turkce').fill('4');
  await waitUntil(() => text('exam-net-turkce'), (v) => v === '9', 'Türkçe net 9');
  await byId('exam-correct-matematik').fill('20');
  await byId('exam-wrong-matematik').fill('8');
  await waitUntil(() => text('exam-total-net'), (v) => v === '27', 'total net 27');
  await screenshot('exam-form');
  await byId('exam-save').click();
  await visible('exam-item-0-net');
  check((await text('exam-item-0-net')) === '27 net', 'saved exam should show 27 net');
  check((await text('exam-item-0-kind')) === 'TYT', 'saved exam should be TYT');
  await screenshot('exam-list');

  // 5. Reload: the exam comes back from SQLite.
  log('step: reload keeps exam');
  await page.goto(baseUrl + 'denemeler');
  await visible('exam-item-0-net', FIRST_SCREEN_TIMEOUT_MS);
  check((await text('exam-item-0-net')) === '27 net', 'exam lost after reload');

  // 6. Settings → delete all data → onboarding.
  log('step: delete all data');
  await byId('tab-settings').click();
  await visible('settings-delete-all');
  await byId('settings-delete-all').click();
  await byId('settings-delete-all-confirm').click();
  await visible('onboarding-start');
  await screenshot('after-delete-all');
  await page.reload();
  await visible('onboarding-start', FIRST_SCREEN_TIMEOUT_MS);
}

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const port = await findFreePort(FIRST_PORT);
  if (port !== FIRST_PORT) log(`port ${FIRST_PORT} is busy, using ${port}`);
  const baseUrl = `http://localhost:${port}/`;
  log(`starting Expo web dev server on ${baseUrl}`);
  const server = startDevServer(port);

  const problems = [];
  let browser;
  try {
    await waitForServer(server, baseUrl);
    browser = await launchBrowser();
    const context = await browser.newContext({
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul',
      viewport: { width: 430, height: 932 },
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`uncaught: ${error.stack ?? error}`));
    // No network access besides the dev server itself (v0: data stays on the device).
    const devHost = new URL(baseUrl).host;
    const external = new Set();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.host !== devHost) external.add(url.origin);
    });

    await runScenario(page, baseUrl);
    if (external.size > 0) problems.push(`requests outside the dev server: ${[...external].join(', ')}`);
    await context.close();
  } catch (error) {
    problems.unshift(`scenario failed: ${error instanceof Error ? error.message : error}`);
  } finally {
    await browser?.close();
    await server.stop();
    log(`dev server stopped (log: ${path.relative(ROOT, path.join(OUT_DIR, 'expo-dev-server.log'))})`);
  }

  if (problems.length > 0) {
    console.error('[test:web] FAILED');
    for (const problem of problems) console.error(' - ' + problem);
    process.exit(1);
  }
  log(`PASSED (screenshots: ${path.relative(ROOT, OUT_DIR)})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
