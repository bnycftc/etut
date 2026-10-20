-- Demo group for App Review (20261020120300_etut_demo.sql): seeded by the operator only, joined
-- without the founder, code never expires, adults only, real members leave after 7 days, and
-- joining it opens nothing else. No client path sets the flag.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The demo group's own adults-only rule, without the K-23 minor policy (tested in 12_minor_policy);
-- rolled back at the end.
update app.settings set minor_policy = 'open';

create schema tests;
grant usage on schema tests to authenticated;
create procedure tests.user_with_profile(p_id uuid, p_nick text, p_band text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (p_id, p_nick, 'YKS', 'sayisal', p_band);
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
-- Back to the operator (after `reset role`): postgres without a signed-in request, like psql on
-- the server or a pg_cron job.
create procedure tests.as_operator() language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
create table tests.ids (key text primary key, id uuid, code text);
grant select on tests.ids to authenticated;
create temp table created (group_id uuid, invite_code text, invite_expires_at timestamptz);
grant all on created to authenticated;

call tests.user_with_profile('33333333-0000-0000-0000-00000000000a', 'Kurucu', '18_plus');  -- founder of a normal group
call tests.user_with_profile('33333333-0000-0000-0000-00000000000b', 'Üye Bir', '18_plus'); -- member of it
call tests.user_with_profile('33333333-0000-0000-0000-00000000000d', 'İnceleme', '18_plus'); -- reviewer
call tests.user_with_profile('33333333-0000-0000-0000-00000000000e', 'Genç Bir', '15_17');  -- 15-17
call tests.user_with_profile('33333333-0000-0000-0000-00000000000f', 'İkinci', '18_plus');  -- another adult

-- ---------------------------------------------------------------- schema and grants
select col_not_null('app', 'groups', 'is_demo', 'groups.is_demo is not null');
select col_default_is('app', 'groups', 'is_demo', 'false', 'groups.is_demo defaults to false');
select ok(not has_column_privilege('authenticated', 'app.groups', 'is_demo', 'select'), 'clients cannot read is_demo');
select ok(not has_column_privilege('authenticated', 'app.groups', 'is_demo', 'update'), 'clients cannot update is_demo');
select ok(not has_column_privilege('authenticated', 'app.groups', 'is_demo', 'insert'), 'clients cannot insert is_demo');
select ok(not has_table_privilege('authenticated', 'app.demo_accounts', 'select'), 'clients cannot read demo_accounts');
select ok(not has_function_privilege('authenticated', 'app.demo_seed(boolean)', 'execute'), 'authenticated cannot seed');
select ok(not has_function_privilege('anon', 'app.demo_seed(boolean)', 'execute'), 'anon cannot seed');
select ok(has_function_privilege('authenticated', 'public.request_join(text)', 'execute'), 'authenticated can still request_join');
select ok(not has_function_privilege('anon', 'public.request_join(text)', 'execute'), 'anon cannot request_join');
select has_trigger('app', 'groups', 'groups_demo_guard', 'guard trigger on app.groups');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ilike '%is_demo%' and p.proname <> 'request_join'),
  0, 'no RPC but request_join mentions is_demo (and it only reads it)');

-- ---------------------------------------------------------------- seeding (operator)
insert into tests.ids select 'demo_code', null, app.demo_seed();
update tests.ids set id = (select id from app.groups where is_demo) where key = 'demo_code';

select matches((select code from tests.ids where key = 'demo_code'), '^[A-HJ-NP-Z2-9]{8}$', 'seed returns an invite code');
select is((select count(*)::int from app.groups where is_demo), 1, 'one demo group');
select is((select invite_expires_at from app.groups where is_demo), 'infinity'::timestamptz, 'the demo code never expires');
select is((select member_count from app.groups where is_demo), 5, 'five seeded members');
select is((select user_id from app.memberships m join app.groups g on g.id = m.group_id where g.is_demo and m.role = 'owner'),
  'de000000-0000-4000-8000-000000000001'::uuid, 'the founder is a seeded account');
select is(
  (select count(*)::int from app.memberships m join app.groups g on g.id = m.group_id
    where g.is_demo and m.user_id not in (select user_id from app.demo_accounts)),
  0, 'all members are seeded accounts');
select is((select count(*)::int from app.demo_accounts), 5, 'five demo accounts');
select is((select count(*)::int from app.profiles p join app.demo_accounts d using (user_id)
            where p.age_band = '18_plus' and p.nickname like 'Demo %'), 5, 'demo profiles are adults named "Demo …"');
select is((select count(*)::int from app.leaderboard_cache c join app.groups g on g.id = c.group_id where g.is_demo), 10,
  'the ranking is filled (5 members x day and week)');
select ok((select bool_and(seconds > 0) from app.leaderboard_cache c join app.groups g on g.id = c.group_id where g.is_demo),
  'every seeded member has study time');
select is(app.demo_seed(), (select code from tests.ids where key = 'demo_code'), 'seeding again keeps the code');
select is((select count(*)::int from app.groups where is_demo), 1, 'seeding again keeps one demo group');
select is((select member_count from app.groups where is_demo), 5, 'seeding again adds nobody');
insert into tests.ids values ('old_code', null, (select code from tests.ids where key = 'demo_code'));
update tests.ids set code = app.demo_seed(true) where key = 'demo_code';
select isnt((select code from tests.ids where key = 'demo_code'), (select code from tests.ids where key = 'old_code'),
  '--new-code gives a new code');

-- ---------------------------------------------------------------- a normal group next to it
call tests.act_as('33333333-0000-0000-0000-00000000000a');
insert into created select * from public.create_group('Sayısal Ekip');
reset role;
call tests.as_operator();
insert into tests.ids select 'g1', group_id, invite_code from created;
select is((select is_demo from app.groups where id = (select id from tests.ids where key = 'g1')), false,
  'create_group makes a normal group');
call tests.act_as('33333333-0000-0000-0000-00000000000b');
select is(public.request_join((select code from tests.ids where key = 'g1')), 'requested', 'normal group: request');
reset role;
call tests.as_operator();
call tests.act_as('33333333-0000-0000-0000-00000000000a');
select is(public.decide_join_request(
  (select id from app.join_requests where user_id = '33333333-0000-0000-0000-00000000000b'), true), 'approved',
  'normal group: the founder approves');
reset role;
call tests.as_operator();

-- ---------------------------------------------------------------- the flag cannot be set by a client
call tests.act_as('33333333-0000-0000-0000-00000000000a');
select throws_ok($$ update app.groups set is_demo = true where id = (select id from tests.ids where key = 'g1') $$,
  '42501', null, 'a client cannot update is_demo');
select throws_ok($$ insert into app.groups (name, is_demo) values ('Benim Demo', true) $$,
  '42501', null, 'a client cannot insert a demo group');
-- What a SECURITY DEFINER RPC would do: postgres, but inside a signed-in request.
reset role;
select throws_ok($$ update app.groups set is_demo = true where id = (select id from tests.ids where key = 'g1') $$,
  'P0001', 'demo_locked', 'inside a signed-in request even the table owner cannot set is_demo');
select throws_ok($$ insert into app.groups (name, is_demo) values ('Benim Demo', true) $$,
  'P0001', 'demo_locked', 'inside a signed-in request no demo group can be created');
select throws_ok($$ update app.groups set is_demo = false where is_demo $$,
  'P0001', 'demo_locked', 'inside a signed-in request the demo flag cannot be cleared');
select throws_ok($$ select app.demo_seed() $$, 'P0001', 'demo_locked', 'seeding refuses inside a signed-in request');
reset role;
call tests.as_operator();
call tests.act_as('de000000-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.rotate_invite((select id from tests.ids where key = 'demo_code')) $$,
  'P0001', 'demo_locked', 'the demo code cannot be rotated through the app');
select throws_ok($$ select public.revoke_invite((select id from tests.ids where key = 'demo_code')) $$,
  'P0001', 'demo_locked', 'the demo code cannot be revoked through the app');
reset role;
call tests.as_operator();
select is((select invite_code from app.groups where is_demo), (select code from tests.ids where key = 'demo_code'),
  'the demo code is unchanged');

-- ---------------------------------------------------------------- joining the demo group
call tests.act_as('33333333-0000-0000-0000-00000000000d');
select is(public.request_join((select code from tests.ids where key = 'old_code')), 'invalid_code', 'the replaced code no longer works');
select is(public.request_join(lower((select code from tests.ids where key = 'demo_code'))), 'requested',
  'a valid demo code (any case) is accepted');
reset role;
call tests.as_operator();
select is((select role from app.memberships where user_id = '33333333-0000-0000-0000-00000000000d'
            and group_id = (select id from tests.ids where key = 'demo_code')), 'member',
  'the joiner is a member at once, without the founder');
select is((select status from app.join_requests where user_id = '33333333-0000-0000-0000-00000000000d'
            and group_id = (select id from tests.ids where key = 'demo_code')), 'approved',
  'kept as an approved request');
select is((select member_count from app.groups where is_demo), 6, 'member count includes the joiner');

call tests.act_as('33333333-0000-0000-0000-00000000000d');
select is(public.request_join((select code from tests.ids where key = 'demo_code')), 'already_member', 'joining twice');
select is((select count(*)::int from public.my_groups()), 1, 'the joiner has the demo group only');
select is((select role from public.my_groups()), 'member', 'as a member, not the founder');
select is((select invite_code from public.my_groups()), null, 'a member never sees the code');
select is((select count(*)::int from public.group_leaderboard((select id from tests.ids where key = 'demo_code'), 'week')), 6,
  'the demo ranking shows the seeded members and the joiner');
select is((select count(*)::int from public.group_board((select id from tests.ids where key = 'demo_code'))), 6,
  'the demo board shows the seeded members and the joiner');
select throws_ok($$ select * from public.list_join_requests((select id from tests.ids where key = 'demo_code')) $$,
  'P0001', 'not_owner', 'the joiner cannot manage the demo group');

-- No access to any other group.
select throws_ok($$ select * from public.group_board((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_member', 'no board of another group');
select throws_ok($$ select * from public.group_leaderboard((select id from tests.ids where key = 'g1'), 'week') $$,
  'P0001', 'not_member', 'no ranking of another group');
select is((select count(*)::int from app.groups), 1, 'RLS: only the demo group is visible');
select is((select count(*)::int from app.memberships), 6, 'RLS: only the demo memberships are visible');
select is((select count(*)::int from app.profiles where user_id in
            ('33333333-0000-0000-0000-00000000000a', '33333333-0000-0000-0000-00000000000b')), 0,
  'RLS: members of other groups stay invisible');
select is(public.request_join((select code from tests.ids where key = 'g1')), 'requested',
  'a normal group still needs the founder after a demo join');
reset role;
call tests.as_operator();
select is((select count(*)::int from app.memberships where user_id = '33333333-0000-0000-0000-00000000000d'), 1,
  'the joiner is in no other group');
select is(
  (select count(*)::int from app.memberships m join app.groups g on g.id = m.group_id
    where not g.is_demo and m.user_id in (select user_id from app.demo_accounts)),
  0, 'the seeded accounts are in no other group');

-- Adults only.
call tests.act_as('33333333-0000-0000-0000-00000000000e');
select is(public.request_join((select code from tests.ids where key = 'demo_code')), 'invalid_code',
  'a 15-17 account cannot join the demo group');
reset role;
call tests.as_operator();
select is((select count(*)::int from app.memberships where user_id = '33333333-0000-0000-0000-00000000000e'), 0,
  'and is not a member');

-- Real members leave after 7 days; the seeded accounts stay.
update app.memberships set joined_at = now() - interval '8 days'
 where user_id = '33333333-0000-0000-0000-00000000000d' and group_id = (select id from tests.ids where key = 'demo_code');
call tests.act_as('33333333-0000-0000-0000-00000000000f');
select is(public.request_join((select code from tests.ids where key = 'demo_code')), 'requested', 'another adult joins');
reset role;
call tests.as_operator();
select is((select count(*)::int from app.memberships where user_id = '33333333-0000-0000-0000-00000000000d'
            and group_id = (select id from tests.ids where key = 'demo_code')), 0,
  'a real member older than 7 days is taken out');
select is((select count(*)::int from app.memberships m join app.demo_accounts d using (user_id)
            where m.group_id = (select id from tests.ids where key = 'demo_code')), 5, 'the seeded members stay');
select is((select member_count from app.groups where is_demo), 6, 'member count after the swap');

-- The daily purge leaves the demo code alone.
do $$ begin perform app.purge_expired(); end $$;
select is((select invite_code from app.groups where is_demo), (select code from tests.ids where key = 'demo_code'),
  'the daily purge keeps the demo code');
select is((select count(*)::int from app.demo_accounts), 5, 'the daily purge keeps the seeded accounts');

-- Seeding again takes the real members out and keeps the code.
select is(app.demo_seed(), (select code from tests.ids where key = 'demo_code'), 'reseed keeps the code');
select is((select count(*)::int from app.memberships m join app.groups g on g.id = m.group_id
            where g.is_demo and m.user_id not in (select user_id from app.demo_accounts)), 0,
  'reseed takes the real members out');
select is((select member_count from app.groups where is_demo), 5, 'five members after reseed');

-- A real member the trigger promoted to founder (the seeded founder was deleted) steps down on reseed.
call tests.act_as('33333333-0000-0000-0000-00000000000f');
select is(public.request_join((select code from tests.ids where key = 'demo_code')), 'requested', 'adult joins again');
reset role;
call tests.as_operator();
update app.memberships set joined_at = timestamptz '2025-12-01 09:00+03'
 where user_id = '33333333-0000-0000-0000-00000000000f' and group_id = (select id from tests.ids where key = 'demo_code');
delete from auth.users where id = 'de000000-0000-4000-8000-000000000001';
select is((select user_id from app.memberships where role = 'owner' and group_id = (select id from tests.ids where key = 'demo_code')),
  '33333333-0000-0000-0000-00000000000f'::uuid, 'setup: the real member became founder');
select is(app.demo_seed(), (select code from tests.ids where key = 'demo_code'), 'reseed after that keeps the code');
select is((select user_id from app.memberships where role = 'owner' and group_id = (select id from tests.ids where key = 'demo_code')),
  'de000000-0000-4000-8000-000000000001'::uuid, 'the seeded founder is back');
select is((select count(*)::int from app.memberships where user_id = '33333333-0000-0000-0000-00000000000f'), 0,
  'the promoted real member is out');
select is((select member_count from app.groups where is_demo), 5, 'five members again');

select * from finish();
rollback;
