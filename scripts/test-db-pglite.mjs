#!/usr/bin/env node
/**
 * Docker-free check of the backend SQL: applies supabase/migrations to PGlite (Postgres 17 in
 * WebAssembly) and runs the pgTAP files in supabase/tests.
 *
 * The real check is `npx supabase test db` against the local Supabase stack (Docker). This
 * runner exists for machines where Docker is not running. It stubs the few Supabase pieces the
 * migrations rely on (roles anon/authenticated/service_role, auth.users, auth.uid(), the
 * `extensions` schema, the cron.schedule() function); everything else is the same SQL.
 *
 * Usage: node scripts/test-db-pglite.mjs [filter]   (filter = part of a test file name)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pgtap } from '@electric-sql/pglite-pgtap';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2] ?? '';

const SUPABASE_SHIM = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  is_anonymous boolean not null default false,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz,
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
`;

function listSql(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(join(dir, f), 'utf8') }));
}

function tapLines(results) {
  const lines = [];
  for (const r of results) {
    for (const row of r.rows ?? []) {
      const values = Object.values(row);
      if (values.length === 1 && typeof values[0] === 'string') lines.push(...values[0].split('\n'));
    }
  }
  return lines;
}

async function freshDatabase() {
  const db = await PGlite.create({ extensions: { pgcrypto, btree_gist, pgtap } });
  await db.exec(SUPABASE_SHIM);
  for (const m of listSql(join(root, 'supabase', 'migrations'))) {
    try {
      await db.exec(m.sql);
    } catch (error) {
      throw new Error(`migration ${m.name} failed: ${error.message}`);
    }
  }
  await db.exec('set search_path to public, extensions;');
  return db;
}

let failed = 0;
let passed = 0;
const tests = listSql(join(root, 'supabase', 'tests')).filter((t) => t.name.includes(filter));
for (const test of tests) {
  // A fresh database per file, like separate pg_prove runs (each file rolls back anyway).
  const db = await freshDatabase();
  let lines;
  try {
    lines = tapLines(await db.exec(test.sql));
  } catch (error) {
    failed += 1;
    console.log(`not ok - ${test.name}: ${error.message}`);
    await db.close();
    continue;
  }
  const plan = lines.find((l) => /^1\.\.\d+/.test(l));
  const bad = lines.filter((l) => l.startsWith('not ok'));
  const good = lines.filter((l) => l.startsWith('ok'));
  const planned = plan ? Number(plan.slice(3)) : NaN;
  const ok = bad.length === 0 && good.length === planned;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? 'ok' : 'not ok'} - ${test.name} (${good.length}/${planned})`);
  if (!ok) for (const l of lines.filter((x) => x.startsWith('not ok') || x.startsWith('#'))) console.log(`    ${l}`);
  await db.close();
}
console.log(`\n${passed} file(s) passed, ${failed} failed`);
process.exit(failed === 0 && tests.length > 0 ? 0 : 1);
