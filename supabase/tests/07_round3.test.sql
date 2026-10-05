-- Third review round: uploads only with a purpose, a system "no" is not the founder's "no",
-- founders can block and report requesters, parent notices when a link ends on the student's side.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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
grant execute on procedure tests.act_as(uuid) to authenticated;
create temp table g (group_id uuid, invite_code text, invite_expires_at timestamptz);
create temp table pc (code text, expires_at timestamptz);
create temp table req (request_id uuid, nickname text, created_at timestamptz);
grant all on g, pc, req to authenticated;

-- F founds a group; S is a 15-17 student; R asks to join; P is S's parent; X is unrelated.
call tests.user_with_profile('77777777-0000-0000-0000-00000000000f', 'Kurucu', '18_plus');
call tests.user_with_profile('77777777-0000-0000-0000-00000000000a', 'Öğrenci', '15_17');
call tests.user_with_profile('77777777-0000-0000-0000-00000000000b', 'İstekçi', '18_plus');
call tests.user_with_profile('77777777-0000-0000-0000-00000000000c', 'Yabancı', '18_plus');
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at)
values ('77777777-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now());

call tests.act_as('77777777-0000-0000-0000-00000000000f');
insert into g select * from public.create_group('Üçüncü Tur');
reset role;

-- ---------------------------------------------------------------- 1. uploads only with a purpose
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select is(public.submit_session('bbbbbbbb-0000-0000-0000-000000000001', null, null,
  now() - interval '2 hours', now() - interval '1 hour', 3600, 'timer'), 'ignored',
  'no group, no request, no parent: the session is not stored (KVKK m.4/2-ç)');
select is((select count(*)::int from app.study_sessions), 0, 'nothing stored');
select is(public.request_join((select invite_code from g)), 'requested', 'S asks to join');
select is(public.submit_session('bbbbbbbb-0000-0000-0000-000000000001', null, null,
  now() - interval '2 hours', now() - interval '1 hour', 3600, 'timer'), 'accepted',
  'with a pending request the session counts (it will show once approved)');
reset role;
delete from app.join_requests where user_id = '77777777-0000-0000-0000-00000000000a';

-- A linked parent is a reason on its own: the weekly summary must not stay at 0 without a group.
call tests.act_as('77777777-0000-0000-0000-00000000000a');
insert into pc select * from public.create_parent_code();
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select status from public.claim_parent_code((select code from pc))), 'linked', 'P links to S');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select is(public.submit_session('bbbbbbbb-0000-0000-0000-000000000002', null, null,
  now() - interval '50 minutes', now() - interval '20 minutes', 1800, 'manual'), 'accepted',
  'in no group but with a linked parent the session is stored');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select sum(seconds)::int from public.parent_weekly_summary('77777777-0000-0000-0000-00000000000a')), 5400,
  'the parent sees the time of a student who is in no group');
reset role;

-- ---------------------------------------------------------------- 2. a system "no" is not a rejection
-- S asks again; P turns groups off before F decides.
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select is(public.request_join((select invite_code from g)), 'requested', 'S asks to join again');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select lives_ok($$ select public.parent_set_controls('77777777-0000-0000-0000-00000000000a', true, false, null) $$,
  'P turns groups off');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000f');
insert into req select * from public.list_join_requests((select group_id from g));
select is(public.decide_join_request((select request_id from req), true), 'not_allowed', 'F says yes, but S is locked');
reset role;
select is((select count(*)::int from app.join_requests where user_id = '77777777-0000-0000-0000-00000000000a'), 0,
  'the request is dropped, not marked as rejected');
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select lives_ok($$ select public.parent_set_controls('77777777-0000-0000-0000-00000000000a', false, false, null) $$,
  'P turns groups on again');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select is(public.request_join((select invite_code from g)), 'requested',
  'S may ask again right away (no 30-day wait after a lock)');
reset role;
delete from req;

-- The founder's own "no" still counts for 30 days.
call tests.act_as('77777777-0000-0000-0000-00000000000f');
insert into req select * from public.list_join_requests((select group_id from g));
select is(public.decide_join_request((select request_id from req), false), 'rejected', 'F rejects S');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select is(public.request_join((select invite_code from g)), 'invalid_code', 'after the founder''s no: 30 days wait');
reset role;
delete from req;

-- ---------------------------------------------------------------- 3. block and report a requester
call tests.act_as('77777777-0000-0000-0000-00000000000b');
select is(public.request_join((select invite_code from g)), 'requested', 'R asks to join');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000f');
insert into req select * from public.list_join_requests((select group_id from g));
select is((select count(*)::int from req), 1, 'F sees the request');
reset role;

call tests.act_as('77777777-0000-0000-0000-00000000000c');
select is(public.report_join_request((select request_id from req), 'nickname'), 'invalid',
  'someone else cannot report through the request');
select throws_ok($$ select public.block_join_request((select request_id from req)) $$, 'P0001', 'invalid_input',
  'someone else cannot block through the request');
reset role;

call tests.act_as('77777777-0000-0000-0000-00000000000f');
select is(public.report_join_request((select request_id from req), 'group_name'), 'invalid',
  'a request has no group name to report');
select is(public.report_join_request((select request_id from req), 'nickname'), 'reported',
  'F reports the requester''s nickname (K-28)');
select is((select count(*)::int from req), 1, 'reporting leaves the request for F to decide');
select lives_ok($$ select public.block_join_request((select request_id from req)) $$, 'F blocks the requester');
reset role;
select is((select count(*)::int from app.reports
            where target_user_id = '77777777-0000-0000-0000-00000000000b' and reason = 'nickname'
              and group_id = (select group_id from g)), 1, 'the report names the requester and the group');
select is((select count(*)::int from app.blocks
            where blocker_id = '77777777-0000-0000-0000-00000000000f' and blocked_id = '77777777-0000-0000-0000-00000000000b'), 1,
  'the block is stored');
select is((select status from app.join_requests where user_id = '77777777-0000-0000-0000-00000000000b'), 'rejected',
  'the pending request is turned down');
call tests.act_as('77777777-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.list_join_requests((select group_id from g))), 0, 'F no longer sees it');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000b');
select is(public.request_join((select invite_code from g)), 'invalid_code', 'a blocked person cannot ask again');
reset role;

-- ---------------------------------------------------------------- 4. parent notices (K-22)
-- The parent's own unlink leaves no notice.
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.parent_notices()), 0, 'no notice yet');
reset role;

-- The student removes the link: the parent is told.
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select lives_ok($$ select public.child_unlink_parents() $$, 'S removes the parent link');
select is((select parent_count from public.get_me()), 0, 'no parent linked any more');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.parent_children()), 0, 'P no longer sees S');
select is((select kind from public.parent_notices()), 'child_unlinked', 'P sees that S removed the link');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.parent_notices()), 0, 'nobody else sees the notice');
select throws_ok($$ select * from app.parent_notices $$, '42501', null, 'the notice table is not readable directly');
reset role;

-- Linked again; the parent unlinks: no notice for their own action.
delete from app.parent_notices;
call tests.act_as('77777777-0000-0000-0000-00000000000a');
delete from pc;
insert into pc select * from public.create_parent_code();
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select status from public.claim_parent_code((select code from pc))), 'linked', 'P links again');
select lives_ok($$ select public.parent_unlink('77777777-0000-0000-0000-00000000000a') $$, 'P unlinks');
select is((select count(*)::int from public.parent_notices()), 0, 'the parent''s own unlink leaves no notice');
reset role;

-- Linked again; a year later the student declares 18+: the parent is told why the link ended.
call tests.act_as('77777777-0000-0000-0000-00000000000a');
delete from pc;
insert into pc select * from public.create_parent_code();
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select status from public.claim_parent_code((select code from pc))), 'linked', 'P links once more');
reset role;
update app.profiles set band_year = band_year - 1 where user_id = '77777777-0000-0000-0000-00000000000a';
call tests.act_as('77777777-0000-0000-0000-00000000000a');
select lives_ok($$ select public.save_profile('Öğrenci', 'YKS', 'sayisal', '18_plus') $$, 'S declares 18+ a year later');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000e1');
select is((select kind from public.parent_notices()), 'child_adult', 'P sees that the link ended with an 18+ declaration');
reset role;

-- Old notices go after 90 days.
update app.parent_notices set created_at = now() - interval '91 days';
do $$ begin perform app.purge_expired(); end $$;
select is((select count(*)::int from app.parent_notices), 0, 'notices are purged after 90 days');

select * from finish();
rollback;
