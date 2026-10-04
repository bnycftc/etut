#!/usr/bin/env node
/**
 * npm run test:backend — supabase-js integration test against the LOCAL Supabase stack.
 *
 * 1. Docker must be running and the stack started (`npx supabase start`).
 * 2. The API URL and the public key are read from `npx supabase status -o json`.
 * 3. supabase/tests-ts/*.test.ts run with `node --test` (Node 24 runs TypeScript directly).
 *
 * Without Docker or a running stack the tests are SKIPPED and this says so loudly (exit 0);
 * pass --strict to fail instead (for CI).
 */

import { execSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');

function skip(reason) {
  const line = '='.repeat(72);
  console.log(`${line}\nATLANDI (SKIPPED): arka uç entegrasyon testleri çalıştırılmadı.\nNeden: ${reason}\n` +
    `Çalıştırmak için: Docker Desktop'ı açın, \`npx supabase start\`, sonra \`npm run test:backend\`.\n` +
    `Docker olmadan SQL testleri için: \`npm run test:db:pglite\`.\n${line}`);
  process.exit(strict ? 1 : 0);
}

try {
  execSync('docker info', { stdio: 'ignore', timeout: 20_000 });
} catch {
  skip('Docker çalışmıyor.');
}

let status;
try {
  status = JSON.parse(execSync('npx supabase status -o json', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 }));
} catch {
  skip('yerel Supabase yığını çalışmıyor (npx supabase start).');
}

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!url || !key) skip('`supabase status` API adresini ya da genel anahtarı vermedi.');

const dir = join(root, 'supabase', 'tests-ts');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts')).map((f) => join(dir, f));
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ETUT_TEST_SUPABASE_URL: url, ETUT_TEST_SUPABASE_KEY: key },
});
process.exit(result.status ?? 1);
