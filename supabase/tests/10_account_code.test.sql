-- Account code and deletion records (K-37; kvkk/07 A Yol 2, B5): the code is never stored in
-- plain text, a wrong code deletes nothing, every deletion on request writes a record that
-- outlives the account for 3 years, and anon can execute nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
create procedure tests.user_with_profile(p_id uuid, p_nick text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (p_id, p_nick, 'YKS', 'sozel', '18_plus');
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
-- Every column of every table in app and audit (any type, as text) that contains p_text.
create function tests.stored_anywhere(p_text text) returns text[] language plpgsql as $$
declare
  r record;
  n integer;
  out text[] := '{}';
begin
  for r in select c.table_schema, c.table_name, c.column_name from information_schema.columns c
             join information_schema.tables t using (table_schema, table_name)
            where c.table_schema in ('app', 'audit') and t.table_type = 'BASE TABLE' loop
    execute format('select count(*) from %I.%I where %I::text like $1', r.table_schema, r.table_name, r.column_name)
      into n using '%' || p_text || '%';
    if n > 0 then out := out || (r.table_schema || '.' || r.table_name || '.' || r.column_name); end if;
  end loop;
  return out;
end
$$;
create temp table codes (who text, code text, created_at timestamptz);
grant all on codes to authenticated;

call tests.user_with_profile('aaaaaaaa-0000-0000-0000-00000000000a', 'Kodlu');
call tests.user_with_profile('aaaaaaaa-0000-0000-0000-00000000000b', 'Ikinci');
call tests.user_with_profile('aaaaaaaa-0000-0000-0000-00000000000c', 'Ucuncu');

-- ---------------------------------------------------------------- grants
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app', 'audit') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon cannot execute any function in public, app or audit');
select ok(has_function_privilege('authenticated', 'public.my_account_code(boolean)', 'execute'), 'clients get their own code');
select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), 'clients can still delete their account');
select ok(not has_function_privilege('authenticated', 'app.delete_by_account_code(text, timestamptz)', 'execute'),
  'clients cannot delete by code');
select ok(not has_function_privilege('authenticated', 'app.delete_account(uuid, text, timestamptz)', 'execute'),
  'clients cannot call the deletion helper');
select ok(not has_function_privilege('authenticated', 'app.account_code_hash(text)', 'execute'), 'clients cannot hash codes');
select ok(not has_function_privilege('authenticated', 'app.purge_deletion_records()', 'execute'), 'clients cannot purge');
select is(
  (select count(*)::int from information_schema.role_table_grants
    where (table_schema, table_name) in (('app', 'account_codes'), ('audit', 'deletion_records'))
      and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0, 'no client grant on the code or the deletion records');

-- ---------------------------------------------------------------- the code
call tests.act_as('aaaaaaaa-0000-0000-0000-00000000000a');
insert into codes select 'a', * from public.my_account_code();
select matches((select code from codes where who = 'a'), '^[A-HJ-NP-Z2-9]{12}$', 'the first call returns a 12-character code');
insert into codes select 'a again', * from public.my_account_code();
select is((select code from codes where who = 'a again'), null, 'later calls do not return it again');
select is((select created_at from codes where who = 'a again'), (select created_at from codes where who = 'a'),
  'but say when it was made');
reset role;
call tests.act_as('aaaaaaaa-0000-0000-0000-00000000000b');
insert into codes select 'b', * from public.my_account_code();
reset role;
call tests.act_as('aaaaaaaa-0000-0000-0000-00000000000c');
insert into codes select 'c old', * from public.my_account_code();
insert into codes select 'c', * from public.my_account_code(true);
reset role;
select isnt((select code from codes where who = 'c'), (select code from codes where who = 'c old'), 'renewing gives a new code');
select is((select count(*)::int from app.account_codes), 3, 'one code per account');
select isnt((select code from codes where who = 'a'), (select code from codes where who = 'b'), 'codes differ between accounts');

-- Never in plain text: the table holds only the hash, and the code is in no column anywhere.
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
    where table_schema = 'app' and table_name = 'account_codes'),
  array['code_hash', 'created_at', 'user_id'], 'app.account_codes has no code column');
select is((select code_hash from app.account_codes where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  extensions.digest('etut-account-code:' || (select code from codes where who = 'a'), 'sha256'), 'only the SHA-256 is stored');
select is(tests.stored_anywhere('Ucuncu'), array['app.profiles.nickname'], 'the scan finds text that is stored');
select is(tests.stored_anywhere((select code from codes where who = 'a')), '{}'::text[], 'the code is stored nowhere in plain text');
select is(tests.stored_anywhere((select code from codes where who = 'c')), '{}'::text[], 'neither is a renewed code');

-- ---------------------------------------------------------------- wrong codes delete nothing
create temp table before as select (select count(*) from auth.users) as users, (select count(*) from audit.deletion_records) as records;
select is(app.delete_by_account_code('ABCDEFGHJKLM'), null, 'an unknown code deletes nothing');
select is(app.delete_by_account_code((select code from codes where who = 'c old')), null, 'a replaced code deletes nothing');
select is(app.delete_by_account_code(''), null, 'an empty code deletes nothing');
select is(app.delete_by_account_code(null), null, 'no code deletes nothing');
select is(app.delete_by_account_code(left((select code from codes where who = 'a'), 11)), null, 'part of a code deletes nothing');
select is((select count(*) from auth.users), (select users from before), 'every account is still there');
select is((select count(*) from audit.deletion_records), (select records from before), 'and no deletion record was written');

-- ---------------------------------------------------------------- deletion by code
select is(
  app.delete_by_account_code(
    lower(substr((select code from codes where who = 'a'), 1, 4)) || '-' || substr((select code from codes where who = 'a'), 5, 4)
      || ' ' || substr((select code from codes where who = 'a'), 9),
    now() - interval '2 days'),
  'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'the code deletes its account (case, dashes and spaces ignored)');
select is((select count(*)::int from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0, 'the account is gone');
select is((select count(*)::int from app.profiles where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0, 'with its profile');
select is((select count(*)::int from app.account_codes where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0, 'and its code');
select is((select count(*)::int from auth.users where id in ('aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000c')),
  2, 'other accounts stay');
select results_eq(
  $$ select account_id, method, requested_at::date, deleted_at::date from audit.deletion_records $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'account_code'::text, (now() - interval '2 days')::date, now()::date) $$,
  'the deletion record: account id, when it was asked for, when it was done, how');
select ok(exists (select 1 from audit.events where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and action = 'account_deleted'),
  'the audit trail has the deletion, as for a deletion in the app');
select ok(exists (select 1 from audit.destruction_log where category = 'account_on_request'), 'and the destruction log');
select is(app.delete_by_account_code((select code from codes where who = 'a')), null, 'the same code does nothing a second time');
select is((select count(*)::int from audit.deletion_records), 1, 'one record per deletion');

-- ---------------------------------------------------------------- deletion in the app
call tests.act_as('aaaaaaaa-0000-0000-0000-00000000000b');
select lives_ok($$ select public.delete_my_account() $$, 'B deletes the account in the app');
reset role;
select is((select count(*)::int from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000000b'), 0, 'B is gone');
select results_eq(
  $$ select method, requested_at = deleted_at from audit.deletion_records where account_id = 'aaaaaaaa-0000-0000-0000-00000000000b' $$,
  $$ values ('in_app'::text, true) $$,
  'an in-app deletion writes a record too (asked for and done at once)');
select is(app.delete_by_account_code((select code from codes where who = 'b')), null, 'the code of a deleted account deletes nothing');
select is(app.delete_account('aaaaaaaa-0000-0000-0000-0000000000ff', 'in_app'), false, 'deleting a missing account writes no record');
select is((select count(*)::int from audit.deletion_records), 2, 'still two records');
select throws_ok($$ select app.delete_account(null, 'in_app') $$, 'P0001', null, 'the helper needs an account');
select throws_ok($$ select app.delete_by_account_code((select code from codes where who = 'c'), now() + interval '1 day') $$,
  '23514', null, 'a request cannot come after the deletion');
select is((select count(*)::int from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000000c'), 1, 'so C is still there');

-- ---------------------------------------------------------------- records: append only, 3 years
select throws_ok($$ update audit.deletion_records set method = 'x' $$, 'P0001', 'audit_append_only', 'records cannot be changed');
select throws_ok($$ delete from audit.deletion_records $$, 'P0001', 'audit_append_only', 'records cannot be deleted');
call tests.act_as('aaaaaaaa-0000-0000-0000-00000000000c');
select throws_ok($$ select * from audit.deletion_records $$, '42501', null, 'clients cannot read the records');
select throws_ok($$ select * from app.account_codes $$, '42501', null, 'clients cannot read the codes');
reset role;
insert into audit.deletion_records (account_id, requested_at, deleted_at, method) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', now() - interval '3 years 2 days', now() - interval '3 years 1 day', 'in_app'),
  ('aaaaaaaa-0000-0000-0000-0000000000d2', now() - interval '3 years', now() - interval '2 years 364 days', 'account_code');
do $$ begin perform app.purge_expired(); end $$;
select is((select count(*)::int from audit.deletion_records where account_id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 0,
  'the daily purge removes records older than 3 years');
select is((select count(*)::int from audit.deletion_records), 3, 'younger records stay');
select ok(exists (select 1 from audit.destruction_log where category = 'deletion_records' and rows_deleted = 1),
  'the purge is in the destruction log');
select ok(exists (select 1 from cron.job where jobname = 'etut-purge' and command = 'select app.purge_expired()'),
  'the daily job still calls app.purge_expired()');

select * from finish();
rollback;
