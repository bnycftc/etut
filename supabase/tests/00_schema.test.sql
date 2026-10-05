-- Schema-level guarantees: RLS everywhere, no client write grants, no birth year on the server,
-- hardened functions, jobs scheduled.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Every table in app and audit has row level security enabled.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'audit') and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS is enabled on every table in app and audit');

select ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r') >= 17,
  'all app tables exist');

-- No table in the public schema (the Data API only sees RPC functions).
select is(
  (select count(*)::int from pg_tables where schemaname = 'public'),
  0, 'no tables in the exposed public schema');

-- Clients never get INSERT/UPDATE/DELETE/TRUNCATE on any table.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema in ('app', 'audit', 'public')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0, 'no write privilege for client roles on any table');
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema in ('app', 'audit')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
      and privilege_type in ('INSERT', 'UPDATE')),
  0, 'no column write privilege for client roles');

-- anon cannot read anything in app or audit.
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema in ('app', 'audit') and grantee in ('anon', 'PUBLIC')),
  0, 'anon has no column privilege at all');

-- K-16/K-19/K-33: the birth year (or a full birth date) is not stored anywhere on the server.
select is(
  (select count(*)::int from information_schema.columns
    where table_schema in ('app', 'audit', 'public')
      and (column_name ilike '%birth%' or column_name ilike '%dogum%' or column_name ilike '%email%'
           or column_name ilike '%phone%' or column_name ilike '%telefon%')),
  0, 'no birth year, e-mail or phone column');

-- K-20: the age band and the invite code are not readable through table grants.
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'app' and grantee = 'authenticated'
      and column_name in ('age_band', 'band_year', 'invite_code', 'invite_expires_at', 'last_active_at')),
  0, 'age band and invite code are not granted to clients');

-- Every RPC in public is SECURITY DEFINER with a fixed search_path.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and (not p.prosecdef or p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))),
  0, 'every public function is security definer with search_path set');

-- Every function in app/audit has a fixed search_path.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'audit') and p.prokind = 'f'
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))),
  0, 'every app/audit function has search_path set');

-- anon may not execute any public function; authenticated may execute the RPCs.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon cannot execute any public function');
select ok(
  has_function_privilege('authenticated', 'public.submit_session(uuid, text, text, timestamptz, timestamptz, integer, text)', 'execute'),
  'authenticated can execute submit_session');

select ok(
  (select count(*) from cron.job where jobname in ('etut-leaderboards', 'etut-purge')) = 2,
  'leaderboard and purge jobs are scheduled');

select * from finish();
rollback;
