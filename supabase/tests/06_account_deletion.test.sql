-- Account deletion (KVKK m.7, K-37): no trace of the person in app.*, groups handed over, the
-- 5651 audit trail is the documented exception. Retention purge (kvkk/09) and audit integrity.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
create procedure tests.user_with_profile(p_id uuid, p_nick text, p_band text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (p_id, p_nick, 'YKS', 'sozel', p_band);
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
create temp table g1 (group_id uuid, invite_code text, invite_expires_at timestamptz);
create temp table g2 (group_id uuid, invite_code text, invite_expires_at timestamptz);
create temp table pc (code text, expires_at timestamptz);
grant all on g1, g2, pc to authenticated;
-- Every uuid column of every table in `app` that still holds the given id.
create function tests.traces(p_id uuid) returns text[] language plpgsql as $$
declare
  r record;
  n integer;
  out text[] := '{}';
begin
  for r in select c.table_name, c.column_name from information_schema.columns c
            where c.table_schema = 'app' and c.data_type = 'uuid' loop
    execute format('select count(*) from app.%I where %I = $1', r.table_name, r.column_name) into n using p_id;
    if n > 0 then out := out || (r.table_name || '.' || r.column_name); end if;
  end loop;
  return out;
end
$$;

-- U (to be deleted, 15-17, linked parent P), V and W share groups with U.
call tests.user_with_profile('99999999-0000-0000-0000-00000000000a', 'Silinecek', '15_17');
call tests.user_with_profile('99999999-0000-0000-0000-00000000000b', 'Kalan', '18_plus');
call tests.user_with_profile('99999999-0000-0000-0000-00000000000c', 'Üçüncü', '18_plus');
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at)
values ('99999999-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now());

-- Groups: G1 founded by U with V; G2 founded by U alone; G3 founded by V with U and W.
call tests.act_as('99999999-0000-0000-0000-00000000000a');
insert into g1 select * from public.create_group('Grup Bir');
insert into g2 select * from public.create_group('Grup İki');
reset role;
insert into app.groups (id, name) values ('aaaaaaaa-1111-0000-0000-000000000003', 'Grup Üç');
insert into app.memberships (group_id, user_id, role, joined_at) values
  ((select group_id from g1), '99999999-0000-0000-0000-00000000000b', 'member', now() + interval '1 minute'),
  ('aaaaaaaa-1111-0000-0000-000000000003', '99999999-0000-0000-0000-00000000000b', 'owner', now()),
  ('aaaaaaaa-1111-0000-0000-000000000003', '99999999-0000-0000-0000-00000000000a', 'member', now()),
  ('aaaaaaaa-1111-0000-0000-000000000003', '99999999-0000-0000-0000-00000000000c', 'member', now());

-- U's data everywhere.
call tests.act_as('99999999-0000-0000-0000-00000000000a');
select is(public.beat('dddddddd-0000-0000-0000-000000000001', 'edebiyat', false), 'ok', 'U is studying');
select is(public.submit_session('dddddddd-0000-0000-0000-000000000002', 'edebiyat', null,
  now() - interval '3 hours', now() - interval '2 hours', 3600, 'timer'), 'accepted', 'U has a session');
select is(public.send_reaction((select group_id from g1), '99999999-0000-0000-0000-00000000000b', 'tebrik'), 'sent', 'U sent a reaction');
select is(public.report('99999999-0000-0000-0000-00000000000c', null, 'nickname'), 'reported', 'U reported W');
select lives_ok($$ select public.block_user('99999999-0000-0000-0000-00000000000c') $$, 'U blocked W');
insert into pc select * from public.create_parent_code();
reset role;
call tests.act_as('99999999-0000-0000-0000-0000000000a1');
select is((select status from public.claim_parent_code((select code from pc))), 'linked', 'parent linked');
select lives_ok($$ select public.parent_set_controls('99999999-0000-0000-0000-00000000000a', false, false, 90) $$, 'parent controls set');
reset role;
call tests.act_as('99999999-0000-0000-0000-00000000000b');
select is(public.send_reaction((select group_id from g1), '99999999-0000-0000-0000-00000000000a', 'hadi'), 'sent', 'U received a reaction');
select is(public.report('99999999-0000-0000-0000-00000000000a', null, 'harassment'), 'reported', 'V reported U');
reset role;
do $$ begin perform app.refresh_leaderboards(); end $$;
select ok(array_length(tests.traces('99999999-0000-0000-0000-00000000000a'), 1) >= 10, 'U has data in many tables before deletion');

-- ---------------------------------------------------------------- delete
call tests.act_as('99999999-0000-0000-0000-00000000000a');
select lives_ok($$ select public.delete_my_account() $$, 'U deletes the account');
select is((select count(*)::int from public.get_me()), 0, 'no profile any more');
reset role;
select is(tests.traces('99999999-0000-0000-0000-00000000000a'), '{}'::text[], 'no trace of U in any app table');
select is((select count(*)::int from auth.users where id = '99999999-0000-0000-0000-00000000000a'), 0, 'auth user removed');
select is((select user_id from app.memberships where group_id = (select group_id from g1) and role = 'owner'),
  '99999999-0000-0000-0000-00000000000b'::uuid, 'G1 is handed to the remaining member');
select is((select member_count from app.groups where id = (select group_id from g1)), 1, 'member count follows');
select is((select count(*)::int from app.groups where id = (select group_id from g2)), 0, 'U''s empty group is removed');
select is((select member_count from app.groups where id = 'aaaaaaaa-1111-0000-0000-000000000003'), 2, 'U left G3');
select is((select count(*)::int from app.reports where target_user_id is null and reason = 'harassment'), 1,
  'the report about U stays as an anonymous moderation record');
select is((select count(*)::int from app.parent_links), 0, 'parent link removed');
select ok(exists (select 1 from audit.events where user_id = '99999999-0000-0000-0000-00000000000a' and action = 'account_deleted'),
  'the audit trail keeps the deletion (5651 exception)');
select ok(exists (select 1 from audit.destruction_log where category = 'account_on_request'), 'the deletion is in the destruction log');

-- ---------------------------------------------------------------- audit integrity
select throws_ok($$ delete from audit.events $$, 'P0001', 'audit_append_only', 'audit rows cannot be deleted');
select throws_ok($$ update audit.events set action = 'x' $$, 'P0001', 'audit_append_only', 'audit rows cannot be changed');
call tests.act_as('99999999-0000-0000-0000-00000000000b');
select throws_ok($$ select * from audit.events $$, '42501', null, 'clients cannot read the audit trail');
reset role;

-- ---------------------------------------------------------------- retention purge
-- The parent is now an anonymous user without profile or link: removed after a day.
update auth.users set created_at = now() - interval '2 days' where id = '99999999-0000-0000-0000-0000000000a1';
update app.profiles set last_active_at = now() - interval '7 months' where user_id = '99999999-0000-0000-0000-00000000000c';
select throws_ok($$ insert into app.reactions (group_id, from_user, to_user, kind) values
  ((select group_id from g1), '99999999-0000-0000-0000-00000000000b', '99999999-0000-0000-0000-00000000000b', 'hadi') $$,
  '23514', null, 'nobody reacts to themselves');
insert into app.reactions (group_id, from_user, to_user, kind, created_at)
values ('aaaaaaaa-1111-0000-0000-000000000003', '99999999-0000-0000-0000-00000000000c', '99999999-0000-0000-0000-00000000000b', 'hadi',
        now() - interval '91 days');
insert into audit.events (user_id, action, at) values (null, 'old', now() - interval '400 days');
do $$ begin perform app.purge_expired(); end $$;
select is((select count(*)::int from auth.users where id = '99999999-0000-0000-0000-0000000000a1'), 0,
  'an account without profile is purged after a day');
select is((select count(*)::int from auth.users where id = '99999999-0000-0000-0000-00000000000c'), 0,
  'an anonymous account unused for 6 months is purged');
select is((select count(*)::int from app.reactions where created_at < now() - interval '90 days'), 0, 'reactions older than 90 days are purged');
select is((select count(*)::int from audit.events where action = 'old'), 0, 'audit records older than 395 days are purged');
select ok(exists (select 1 from audit.events where action = 'account_deleted'), 'recent audit records stay');
select ok((select count(*) from audit.destruction_log) >= 3, 'every purge is written to the destruction log');

select * from finish();
rollback;
