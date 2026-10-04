-- Live board and "görünmez çalış" (K-12), group ranking without outsiders (K-06), reactions only
-- for the recipient with a 3-a-day limit (K-07, K-08), report and block (K-28).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
create procedure tests.user_with_profile(p_id uuid, p_nick text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (p_id, p_nick, 'YKS', 'sayisal', '15_17');
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
create function tests.today() returns date language sql stable security definer as $$
  select app.istanbul_day(now())
$$;
grant execute on function tests.today() to authenticated;

-- Group G: O (founder), A, B. Group H: X (founder), Y. X and Y never share a group with O/A/B.
call tests.user_with_profile('55555555-0000-0000-0000-00000000000a', 'Ozan');
call tests.user_with_profile('55555555-0000-0000-0000-00000000000b', 'Aslı');
call tests.user_with_profile('55555555-0000-0000-0000-00000000000c', 'Barış');
call tests.user_with_profile('55555555-0000-0000-0000-00000000000d', 'Xenon');
call tests.user_with_profile('55555555-0000-0000-0000-00000000000e', 'Yağmur');
insert into app.groups (id, name) values
  ('66666666-0000-0000-0000-000000000001', 'Grup G'),
  ('66666666-0000-0000-0000-000000000002', 'Grup H');
insert into app.memberships (group_id, user_id, role, joined_at) values
  ('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000a', 'owner', now() - interval '3 days'),
  ('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'member', now() - interval '2 days'),
  ('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000c', 'member', now() - interval '1 day'),
  ('66666666-0000-0000-0000-000000000002', '55555555-0000-0000-0000-00000000000d', 'owner', now()),
  ('66666666-0000-0000-0000-000000000002', '55555555-0000-0000-0000-00000000000e', 'member', now());

-- ---------------------------------------------------------------- live board (K-12)
call tests.act_as('55555555-0000-0000-0000-00000000000b');
select is(public.beat('bbbbbbbb-0000-0000-0000-000000000001', 'kimya', false), 'ok', 'A starts studying');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000d');
select is(public.beat('bbbbbbbb-0000-0000-0000-000000000002', 'fizik', false), 'ok', 'X (other group) studies too');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is((select studying from public.group_board('66666666-0000-0000-0000-000000000001')
            where user_id = '55555555-0000-0000-0000-00000000000b'), true, 'O sees A studying');
select is((select subject_id from public.group_board('66666666-0000-0000-0000-000000000001')
            where user_id = '55555555-0000-0000-0000-00000000000b'), 'kimya', 'with the subject');
select is((select count(*)::int from public.group_board('66666666-0000-0000-0000-000000000001')
            where user_id = '55555555-0000-0000-0000-00000000000d'), 0, 'X never appears on the board of G');
select throws_ok($$ select * from public.group_board('66666666-0000-0000-0000-000000000002') $$,
  'P0001', 'not_member', 'O cannot read the board of H');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000b');
select lives_ok($$ select public.set_preferences(true, null) $$, 'A turns on "görünmez çalış"');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is((select studying::text || coalesce(subject_id, '-') from public.group_board('66666666-0000-0000-0000-000000000001')
            where user_id = '55555555-0000-0000-0000-00000000000b'), 'false-', 'invisible A is not shown as studying');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000b');
select is((select studying from public.group_board('66666666-0000-0000-0000-000000000001') where is_me), true,
  'A still sees the own status');
select lives_ok($$ select public.set_preferences(false, null) $$, 'A becomes visible again');
reset role;
update app.presence set last_beat_at = now() - interval '8 minutes' where user_id = '55555555-0000-0000-0000-00000000000b';
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is((select studying from public.group_board('66666666-0000-0000-0000-000000000001')
            where user_id = '55555555-0000-0000-0000-00000000000b'), false, 'no heartbeat for 7+ minutes = not studying');

-- ---------------------------------------------------------------- ranking (K-06)
reset role;
insert into app.daily_totals (user_id, day, seconds) values
  ('55555555-0000-0000-0000-00000000000a', app.istanbul_day(now()), 3600),
  ('55555555-0000-0000-0000-00000000000b', app.istanbul_day(now()), 7200),
  ('55555555-0000-0000-0000-00000000000d', app.istanbul_day(now()), 99999 % 57600);
select app.refresh_leaderboards() is null as refreshed;
select is((select count(*)::int from app.leaderboard_cache where group_id = '66666666-0000-0000-0000-000000000001'
            and user_id not in (select user_id from app.memberships where group_id = '66666666-0000-0000-0000-000000000001')), 0,
  'the cache of G holds members only');
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is((select array_agg(nickname order by rank, nickname)
             from public.group_leaderboard('66666666-0000-0000-0000-000000000001', 'day')),
  array['Aslı', 'Ozan', 'Barış'], 'daily ranking: members only, by time');
select is((select seconds from public.group_leaderboard('66666666-0000-0000-0000-000000000001', 'week') where is_me), 3600,
  'weekly ranking includes today');
select is((select count(*)::int from app.leaderboard_cache where user_id = '55555555-0000-0000-0000-00000000000d'), 0,
  'O cannot read cache rows about X');
select throws_ok($$ select * from public.group_leaderboard('66666666-0000-0000-0000-000000000001', 'all') $$,
  'P0001', 'invalid_input', 'there is no other period (no global ranking)');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000d');
select is((select count(*)::int from app.leaderboard_cache where group_id = '66666666-0000-0000-0000-000000000001'), 0,
  'X cannot read the cache of G');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000c');
select lives_ok($$ select public.leave_group('66666666-0000-0000-0000-000000000001') $$, 'B leaves G');
reset role;
select is((select count(*)::int from app.leaderboard_cache where user_id = '55555555-0000-0000-0000-00000000000c'), 0,
  'a leaver disappears from the cache at once');
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.group_leaderboard('66666666-0000-0000-0000-000000000001', 'day')), 2,
  'and from the ranking before the next refresh');

-- ---------------------------------------------------------------- reactions (K-07, K-08)
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'tebrik'),
  'sent', 'reaction 1 to A');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'hadi'),
  'sent', 'reaction 2 to A');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'helal'),
  'sent', 'reaction 3 to A');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'tebrik'),
  'limit', 'the 4th reaction to the same person on the same day is refused');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'kalp'),
  'invalid', 'only the fixed reaction set');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000d', 'tebrik'),
  'not_allowed', 'no reaction to someone outside the group');
select is((select count(*)::int from app.reactions), 0, 'the sender cannot read reactions back (no counter)');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000d');
select throws_ok($$ select public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'hadi') $$,
  'P0001', 'not_member', 'an outsider cannot send into the group');
select is((select count(*)::int from app.reactions), 0, 'an outsider sees no reaction');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000b');
select is((select count(*)::int from app.reactions), 3, 'the recipient sees the own reactions');
select is((select count(*)::int from public.take_reactions()), 3, 'the recipient gets them once');
select is((select count(*)::int from public.take_reactions()), 0, 'and not again');
select lives_ok($$ select public.set_preferences(null, false) $$, 'A turns reactions off');
reset role;
delete from app.rate_events;
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'hadi'),
  'not_allowed', 'reactions turned off by the recipient');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000b');
select lives_ok($$ select public.set_preferences(null, true) $$, 'A turns reactions on again');

-- ---------------------------------------------------------------- block and report (K-28)
select lives_ok($$ select public.block_user('55555555-0000-0000-0000-00000000000a') $$, 'A blocks O');
select throws_ok($$ select public.block_user('55555555-0000-0000-0000-00000000000d') $$, 'P0001', 'invalid_input',
  'only people from the own groups can be blocked');
select is((select count(*)::int from public.group_board('66666666-0000-0000-0000-000000000001')
            where user_id = '55555555-0000-0000-0000-00000000000a'), 0, 'a blocked person is hidden from the board');
select is((select count(*)::int from public.group_leaderboard('66666666-0000-0000-0000-000000000001', 'day')
            where user_id = '55555555-0000-0000-0000-00000000000a'), 0, 'and from the ranking');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is(public.send_reaction('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-00000000000b', 'hadi'),
  'not_allowed', 'a blocked person cannot send reactions');
select is((select count(*)::int from app.blocks), 0, 'blocks are visible only to the blocker');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000b');
select is(public.report('55555555-0000-0000-0000-00000000000a', '66666666-0000-0000-0000-000000000001', 'nickname'),
  'reported', 'A reports O');
select is(public.report('55555555-0000-0000-0000-00000000000d', null, 'harassment'),
  'invalid', 'only people from the own groups can be reported');
select is(public.report(null, '66666666-0000-0000-0000-000000000002', 'group_name'),
  'invalid', 'only the own groups can be reported');
select is(public.report(null, '66666666-0000-0000-0000-000000000001', 'free text'),
  'invalid', 'fixed reasons only');
select is(public.report('55555555-0000-0000-0000-00000000000a', null, 'other'), 'reported', 'report ' || n)
  from generate_series(2, 10) n;
select is(public.report('55555555-0000-0000-0000-00000000000a', null, 'other'), 'rate_limited', '10 reports a day');
select lives_ok($$ select public.unblock_user('55555555-0000-0000-0000-00000000000a') $$, 'A unblocks O');
reset role;
call tests.act_as('55555555-0000-0000-0000-00000000000a');
select is((select count(*)::int from app.reports), 0, 'reports are visible only to the reporter');

select * from finish();
rollback;
