-- Parent link (K-22): short-lived code typed on the parent's device, locks (group module off,
-- forced "görünmez çalış"), daily limit, weekly summary; brute-force limit on codes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
create procedure tests.user(p_id uuid) language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
$$;
create procedure tests.profile(p_id uuid, p_nick text, p_band text) language sql as $$
  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (p_id, p_nick, 'YKS', 'esit_agirlik', p_band);
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
create table tests.codes (key text primary key, code text);
grant select on tests.codes to authenticated;
create temp table c1 (code text, expires_at timestamptz);
create temp table c2 (code text, expires_at timestamptz);
grant all on c1, c2 to authenticated;

call tests.user('77777777-0000-0000-0000-00000000000c'); -- child, 15-17
call tests.profile('77777777-0000-0000-0000-00000000000c', 'Öğrenci', '15_17');
call tests.user('77777777-0000-0000-0000-00000000000d'); -- adult student
call tests.profile('77777777-0000-0000-0000-00000000000d', 'Yetişkin', '18_plus');
call tests.user('77777777-0000-0000-0000-00000000000e'); -- another 15-17 student
call tests.profile('77777777-0000-0000-0000-00000000000e', 'Başka Genç', '15_17');
call tests.user('77777777-0000-0000-0000-0000000000a1'); -- parent (no student profile)
call tests.user('77777777-0000-0000-0000-0000000000a2'); -- guesser
call tests.user('77777777-0000-0000-0000-0000000000a3'); -- stranger
-- Child and adult share a group, so locks can be seen from the outside.
insert into app.groups (id, name) values ('88888888-0000-0000-0000-000000000001', 'Ortak Grup');
insert into app.memberships (group_id, user_id, role) values
  ('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-00000000000d', 'owner'),
  ('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-00000000000c', 'member');

-- ---------------------------------------------------------------- code
call tests.act_as('77777777-0000-0000-0000-00000000000d');
select throws_ok($$ select * from public.create_parent_code() $$, 'P0001', 'not_allowed',
  'an 18+ account has no parent link');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
insert into c1 select * from public.create_parent_code();
reset role;
insert into tests.codes select 'c1', code from c1;
select is((select expires_at from c1), now() + interval '10 minutes', 'the code is valid for 10 minutes');

call tests.act_as('77777777-0000-0000-0000-0000000000a2');
select is((select status from public.claim_parent_code('WRONG' || n::text)), 'invalid_code', 'wrong code ' || n)
  from generate_series(100, 109) n;
select is((select status from public.claim_parent_code((select code from tests.codes where key = 'c1'))), 'rate_limited',
  'after 10 wrong codes in an hour even the right code is refused');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000e');
select is((select status from public.claim_parent_code((select code from tests.codes where key = 'c1'))), 'not_allowed',
  'a 15-17 student cannot become a parent');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
select is((select status from public.claim_parent_code((select code from tests.codes where key = 'c1'))), 'not_allowed',
  'the student cannot claim the own code');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000a1');
select is((select status || ':' || child_nickname from public.claim_parent_code(lower((select code from tests.codes where key = 'c1')))),
  'linked:Öğrenci', 'the parent links with the code');
select is((select count(*)::int from public.parent_children()), 1, 'the parent sees the child');
select is((select status from public.claim_parent_code((select code from tests.codes where key = 'c1'))), 'invalid_code',
  'a code is used once');
reset role;
-- Expired code.
call tests.act_as('77777777-0000-0000-0000-00000000000c');
insert into c2 select * from public.create_parent_code();
reset role;
update app.parent_link_codes set expires_at = now() - interval '1 second';
call tests.act_as('77777777-0000-0000-0000-0000000000a3');
select is((select status from public.claim_parent_code((select code from c2))), 'invalid_code', 'an expired code does not work');
select is((select count(*)::int from app.parent_controls), 0, 'a stranger cannot read the controls');
select throws_ok($$ select * from public.parent_weekly_summary('77777777-0000-0000-0000-00000000000c') $$,
  'P0001', 'not_parent', 'a stranger cannot read the weekly summary');
select throws_ok($$ select public.parent_set_controls('77777777-0000-0000-0000-00000000000c', true, true, null) $$,
  'P0001', 'not_parent', 'a stranger cannot set controls');

-- ---------------------------------------------------------------- locks
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
select is((select parent_count from public.get_me()), 1, 'the child sees that a parent is linked');
select throws_ok($$ select public.save_profile('Öğrenci', 'YKS', 'esit_agirlik', '18_plus') $$, 'P0001', 'parent_locked',
  'a linked student cannot declare 18+ (K-17)');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.parent_set_controls('77777777-0000-0000-0000-00000000000c', false, false, 5) $$,
  'P0001', 'invalid_input', 'daily limit has a sensible range');
select lives_ok($$ select public.parent_set_controls('77777777-0000-0000-0000-00000000000c', false, true, 60) $$,
  'parent forces "görünmez çalış" and sets a 60-minute limit');
select is((select count(*)::int from app.parent_controls), 1, 'the parent can read the controls');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
select is((select force_invisible::text || '/' || invisible::text || '/' || daily_limit_minutes from public.get_me()),
  'true/true/60', 'the child sees the locks');
select throws_ok($$ select public.set_preferences(false, null) $$, 'P0001', 'parent_locked',
  'the child cannot turn visibility back on');
select is(public.beat('cccccccc-0000-0000-0000-000000000001', 'tarih', false), 'ok', 'the child studies');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000d');
select is((select studying from public.group_board('88888888-0000-0000-0000-000000000001')
            where user_id = '77777777-0000-0000-0000-00000000000c'), false, 'others do not see the child studying');
reset role;
call tests.act_as('77777777-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.parent_set_controls('77777777-0000-0000-0000-00000000000c', true, true, 60) $$,
  'parent turns the group module off');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
select throws_ok($$ select * from public.create_group('Yeni Grup') $$, 'P0001', 'parent_locked', 'no new group');
select throws_ok($$ select * from public.group_board('88888888-0000-0000-0000-000000000001') $$, 'P0001', 'parent_locked',
  'no group board');
select throws_ok($$ select public.request_join('ABCDEFGH') $$, 'P0001', 'parent_locked', 'no join request');
select is(public.beat('cccccccc-0000-0000-0000-000000000001', 'tarih', false), 'ignored', 'no live status');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.group_board('88888888-0000-0000-0000-000000000001')
            where user_id = '77777777-0000-0000-0000-00000000000c'), 0, 'the locked child is hidden from the group');
select is(public.send_reaction('88888888-0000-0000-0000-000000000001', '77777777-0000-0000-0000-00000000000c', 'hadi'),
  'not_allowed', 'and receives no reactions');

-- ---------------------------------------------------------------- weekly summary, unlink
reset role;
insert into app.daily_totals (user_id, day, seconds, manual_seconds) values
  ('77777777-0000-0000-0000-00000000000c', app.istanbul_day(now()), 5400, 600),
  ('77777777-0000-0000-0000-00000000000c', app.istanbul_day(now()) - 10, 9999, 0);
call tests.act_as('77777777-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.parent_weekly_summary('77777777-0000-0000-0000-00000000000c')), 7,
  'the summary has the last 7 days');
select is((select sum(seconds)::int from public.parent_weekly_summary('77777777-0000-0000-0000-00000000000c')), 5400,
  'only the last 7 days count');
select lives_ok($$ select public.parent_unlink('77777777-0000-0000-0000-00000000000c') $$, 'the parent unlinks');
reset role;
call tests.act_as('77777777-0000-0000-0000-00000000000c');
select is((select groups_disabled::text || parent_count from public.get_me()), 'false0', 'locks end with the last link');

select * from finish();
rollback;
