-- Groups: invite code (72 h, revocable), founder approval (K-03), no visibility from outside
-- (K-04, K-12), 30-member limit as a database constraint (K-05), leaving and removing (K-28).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
-- Signed-in user with a 15+ profile, created directly (the profile RPC is tested in 01).
create procedure tests.user_with_profile(p_id uuid, p_nick text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (p_id, p_nick, 'YKS', 'sayisal', '18_plus');
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
-- Ids returned by RPCs, kept for later steps (written as postgres only).
create table tests.ids (key text primary key, id uuid, code text);
grant select on tests.ids to authenticated;

call tests.user_with_profile('22222222-0000-0000-0000-00000000000a', 'Kurucu');   -- owner
call tests.user_with_profile('22222222-0000-0000-0000-00000000000b', 'Üye Bir');  -- member
call tests.user_with_profile('22222222-0000-0000-0000-00000000000c', 'Dışarıda'); -- outsider
call tests.user_with_profile('22222222-0000-0000-0000-00000000000d', 'İstekçi');  -- requester

-- ---------------------------------------------------------------- create
call tests.act_as('22222222-0000-0000-0000-00000000000a');
create temp table created on commit drop as select * from public.create_group('Sayısal Ekip');
reset role;
insert into tests.ids select 'g1', group_id, invite_code from created;

select matches((select code from tests.ids where key = 'g1'), '^[A-HJ-NP-Z2-9]{8}$', 'invite code has 8 unambiguous characters');
select is((select invite_expires_at from app.groups where id = (select id from tests.ids where key = 'g1')),
  now() + interval '72 hours', 'invite code is valid for 72 hours');
select is((select member_count from app.groups where id = (select id from tests.ids where key = 'g1')), 1,
  'founder is the first member');
select is((select role from app.memberships where user_id = '22222222-0000-0000-0000-00000000000a'), 'owner',
  'founder has the owner role');

call tests.act_as('22222222-0000-0000-0000-00000000000a');
select throws_ok($$ select public.create_group('orospu') $$, 'P0001', 'name_banned', 'group name filter');
select is((select invite_code from public.my_groups() where group_id = (select id from tests.ids where key = 'g1')),
  (select code from tests.ids where key = 'g1'), 'founder sees the code');

-- ---------------------------------------------------------------- join request + approval (K-03)
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000b');
select is(public.request_join(lower((select code from tests.ids where key = 'g1'))), 'requested',
  'a code (case-insensitive) creates a join request');
select is(public.request_join((select code from tests.ids where key = 'g1')), 'already_pending',
  'only one pending request');
select is((select count(*)::int from app.memberships), 0, 'a request alone does not add a member');
select is((select role from public.my_groups()), 'pending', 'requester sees the pending request');
select is((select invite_code from public.my_groups()), null, 'requester never sees the code');
select throws_ok($$ select public.group_board((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_member', 'requester cannot see the group yet');

reset role;
insert into tests.ids select 'r1', id, null from app.join_requests where user_id = '22222222-0000-0000-0000-00000000000b';

call tests.act_as('22222222-0000-0000-0000-00000000000b');
select throws_ok($$ select public.decide_join_request((select id from tests.ids where key = 'r1'), true) $$,
  'P0001', 'not_owner', 'the requester cannot approve themselves');
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000c');
select throws_ok($$ select public.decide_join_request((select id from tests.ids where key = 'r1'), true) $$,
  'P0001', 'not_owner', 'an outsider cannot approve');
select throws_ok($$ select * from public.list_join_requests((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_member', 'an outsider cannot list requests');

reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000a');
select is((select nickname from public.list_join_requests((select id from tests.ids where key = 'g1'))), 'Üye Bir',
  'founder sees the pending request');
select is(public.decide_join_request((select id from tests.ids where key = 'r1'), true), 'approved',
  'founder approves');
select throws_ok($$ select public.decide_join_request((select id from tests.ids where key = 'r1'), true) $$,
  'P0001', 'not_pending', 'a request is decided once');
select is((select member_count from public.my_groups()), 2, 'member count follows');

-- ---------------------------------------------------------------- outsiders see nothing (K-04, K-12)
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000c');
select throws_ok($$ select * from public.group_board((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_member', 'outsider cannot read the live board');
select throws_ok($$ select * from public.group_leaderboard((select id from tests.ids where key = 'g1'), 'day') $$,
  'P0001', 'not_member', 'outsider cannot read the ranking');
select is((select count(*)::int from app.groups), 0, 'outsider sees no group row');
select is((select count(*)::int from app.memberships), 0, 'outsider sees no membership row');
select is((select count(*)::int from app.profiles where user_id <> '22222222-0000-0000-0000-00000000000c'), 0,
  'outsider sees no member profile');
select is((select count(*)::int from app.join_requests), 0, 'outsider sees no join request');
select is((select count(*)::int from public.my_groups()), 0, 'outsider has no groups');
select throws_ok($$ select invite_code from app.groups $$, '42501', null, 'invite code column is never readable');

reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000b');
select is((select count(*)::int from app.profiles), 2, 'members see each other''s nickname');
select is((select count(*)::int from public.group_board((select id from tests.ids where key = 'g1'))), 2,
  'members see the board');
select is((select invite_code from public.my_groups()), null, 'a member (not founder) does not see the code');
select throws_ok($$ select * from public.rotate_invite((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_owner', 'only the founder rotates the code');
select throws_ok($$ select public.revoke_invite((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_owner', 'only the founder revokes the code');
select throws_ok($$ select public.remove_member((select id from tests.ids where key = 'g1'), '22222222-0000-0000-0000-00000000000a') $$,
  'P0001', 'not_owner', 'only the founder removes members');

-- ---------------------------------------------------------------- expired and revoked codes
reset role;
update app.groups set invite_expires_at = now() - interval '1 second' where id = (select id from tests.ids where key = 'g1');
call tests.act_as('22222222-0000-0000-0000-00000000000d');
select is(public.request_join((select code from tests.ids where key = 'g1')), 'invalid_code', 'an expired code does not work');
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000a');
select is((select invite_code from public.my_groups()), null, 'an expired code is not shown');
create temp table rotated on commit drop as select * from public.rotate_invite((select id from tests.ids where key = 'g1'));
select isnt((select invite_code from rotated), (select code from tests.ids where key = 'g1'), 'rotation gives a new code');
select lives_ok($$ select public.revoke_invite((select id from tests.ids where key = 'g1')) $$, 'founder revokes the code');
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000d');
select is(public.request_join((select invite_code from rotated)), 'invalid_code', 'a revoked code does not work');

-- ---------------------------------------------------------------- brute-force limit on codes
select is(public.request_join('AAAAAAA' || n::text), 'invalid_code', 'wrong code ' || n) from generate_series(3, 9) n; -- 2 earlier: expired, revoked
select is(public.request_join('BBBBBBBB'), 'invalid_code', 'wrong code 10');
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000a');
create temp table rotated2 on commit drop as select * from public.rotate_invite((select id from tests.ids where key = 'g1'));
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000d');
select is(public.request_join((select invite_code from rotated2)), 'rate_limited',
  'after 10 wrong codes in an hour even a valid code is refused');
reset role;
delete from app.rate_events where user_id = '22222222-0000-0000-0000-00000000000d';

-- ---------------------------------------------------------------- 30 members (K-05)
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at)
select ('33333333-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', true, now()
  from generate_series(1, 30) n;
insert into app.profiles (user_id, nickname, exam_type, age_band)
select ('33333333-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'Kişi ' || n, 'DIGER', '18_plus'
  from generate_series(1, 30) n;
call tests.act_as('22222222-0000-0000-0000-00000000000d');
select is(public.request_join((select invite_code from rotated2)), 'requested', 'requester asks again');
reset role;
-- Fill the group up to 30 directly (2 members already).
insert into app.memberships (group_id, user_id, role)
select (select id from tests.ids where key = 'g1'), ('33333333-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'member'
  from generate_series(1, 28) n;
select is((select member_count from app.groups where id = (select id from tests.ids where key = 'g1')), 30,
  'group has 30 members');
select throws_ok($$ insert into app.memberships (group_id, user_id, role)
  values ((select id from tests.ids where key = 'g1'), '33333333-0000-0000-0000-000000000029', 'member') $$,
  '23514', null, 'the database refuses the 31st member even for a direct insert');
call tests.act_as('22222222-0000-0000-0000-00000000000a');
select is(public.decide_join_request(
  (select id from app.join_requests where status = 'pending' and user_id = '22222222-0000-0000-0000-00000000000d'), true),
  'group_full', 'approving the 31st member is refused');
reset role;
call tests.act_as('33333333-0000-0000-0000-000000000030');
select is(public.request_join((select invite_code from rotated2)), 'group_full', 'a full group takes no new requests');

-- ---------------------------------------------------------------- remove, leave, hand over
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000a');
select lives_ok($$ select public.remove_member((select id from tests.ids where key = 'g1'), '33333333-0000-0000-0000-000000000001') $$,
  'founder removes a member');
select is((select member_count from public.my_groups()), 29, 'count drops after removal');
reset role;
call tests.act_as('33333333-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.group_board((select id from tests.ids where key = 'g1')) $$,
  'P0001', 'not_member', 'a removed member loses access');
reset role;
call tests.act_as('22222222-0000-0000-0000-00000000000a');
select lives_ok($$ select public.leave_group((select id from tests.ids where key = 'g1')) $$, 'founder leaves');
reset role;
select is((select user_id from app.memberships where group_id = (select id from tests.ids where key = 'g1') and role = 'owner'),
  '22222222-0000-0000-0000-00000000000b'::uuid, 'the longest-standing member becomes the founder');
-- A group whose last member leaves is removed.
call tests.act_as('22222222-0000-0000-0000-00000000000c');
create temp table solo on commit drop as select * from public.create_group('Tek Kişilik');
select lives_ok($$ select public.leave_group((select group_id from solo)) $$, 'last member leaves');
reset role;
select is((select count(*)::int from app.groups where id = (select group_id from solo)), 0, 'empty group is removed');

-- No search or listing function exists (K-04).
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname ilike '%search%' or p.proname ilike '%all_groups%'
                                            or p.proname ilike '%public_group%')), 0,
  'there is no group search or listing RPC');

select * from finish();
rollback;
