-- Study sessions: idempotent append-only upload, server time, plausibility rules (≤10 h a
-- session, ≤16 h a day, no overlap), "manual" label, offline = unverified, Istanbul days.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
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
-- Two days ago, 10:00 Istanbul: independent of the time of day the test runs.
create function tests.t(p_offset interval) returns timestamptz language sql stable security definer as $$
  select app.istanbul_midnight(app.istanbul_day(now()) - 2) + interval '10 hours' + p_offset
$$;
create function tests.day(p_days_ago integer) returns date language sql stable security definer as $$
  select app.istanbul_day(now()) - p_days_ago
$$;
grant execute on function tests.t(interval) to authenticated;
grant execute on function tests.day(integer) to authenticated;
create function tests.midnight(p_days_ago integer) returns timestamptz language sql stable security definer as $$
  select app.istanbul_midnight(app.istanbul_day(now()) - p_days_ago)
$$;
grant execute on function tests.midnight(integer) to authenticated;

call tests.user_with_profile('44444444-0000-0000-0000-00000000000a', 'Çalışkan');
call tests.user_with_profile('44444444-0000-0000-0000-00000000000b', 'Başkası');
call tests.user_with_profile('44444444-0000-0000-0000-00000000000c', 'Yalnız');
call tests.user_with_profile('44444444-0000-0000-0000-00000000000d', 'Geç Gönderen');
-- The live status is kept only for people in a group (nobody else could see it).
insert into app.groups (id, name) values ('44444444-9999-0000-0000-000000000001', 'Oturum Grubu');
insert into app.memberships (group_id, user_id, role) values
  ('44444444-9999-0000-0000-000000000001', '44444444-0000-0000-0000-00000000000a', 'owner'),
  ('44444444-9999-0000-0000-000000000001', '44444444-0000-0000-0000-00000000000d', 'member');

-- ---------------------------------------------------------------- live session: heartbeat + verified
call tests.act_as('44444444-0000-0000-0000-00000000000a');
select is(public.beat('aaaaaaaa-0000-0000-0000-000000000001', 'fizik', false), 'ok', 'first heartbeat starts the live status');
select is(public.beat('aaaaaaaa-0000-0000-0000-000000000001', 'fizik', false), 'throttled', 'a second beat within 30 s is ignored');
select is((select started_at from app.presence), now(), 'the server clock marks the start');
select is((select count(*)::int from app.presence), 1, 'one presence row per user');
select is(public.beat('aaaaaaaa-0000-0000-0000-000000000009', 'kimya', false), 'ok', 'a new session replaces the row');
select is((select count(*)::int from app.presence), 1, 'still one row (updated in place)');
select is((select session_client_id from app.presence), 'aaaaaaaa-0000-0000-0000-000000000009'::uuid, 'row holds the new session');
select is(public.beat('aaaaaaaa-0000-0000-0000-000000000001', 'fizik', false), 'ok', 'back to the first session');
select throws_ok($$ select public.beat('aaaaaaaa-0000-0000-0000-000000000001', 'insta: ali.0532 yaz', false) $$,
  'P0001', 'invalid_input', 'the subject is an id from the fixed list, never free text (K-09)');
reset role;
-- 30 minutes have passed on the server, last beat 1 minute ago.
update app.presence set started_at = now() - interval '30 minutes', last_beat_at = now() - interval '1 minute';

call tests.act_as('44444444-0000-0000-0000-00000000000a');
-- The device reports 29 minutes of active time: the server saw all of it.
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000001', 'fizik', null,
  now() - interval '3 hours', now(), 1740, 'timer'), 'accepted', 'live session is accepted');
select is((select verified from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true,
  'live session is verified');
select is((select duration_s from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1740,
  'verified duration is the active time');
select is((select started_at from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  now() - interval '30 minutes', 'start is server time, not the device time');
select is((select ended_at from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  now() - interval '1 minute', 'end is the last time the server saw it (start + active time ≤ last beat)');
select is((select count(*)::int from app.presence), 0, 'finishing ends the live status');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000001', 'fizik', null,
  now() - interval '3 hours', now(), 1740, 'timer'), 'duplicate', 'resending the same uuid is idempotent');
select is((select count(*)::int from app.study_sessions), 1, 'still one row');
select is((select sum(seconds)::int from app.daily_totals), 1740, 'daily total counted once');

-- ---------------------------------------------------------------- live, but the server saw only part of it
-- The first beats were lost (started offline): the server saw 10 of the 40 minutes. The session is
-- kept with the device times, unverified, instead of being cut to 10 minutes.
select is(public.beat('aaaaaaaa-0000-0000-0000-0000000000e1', 'kimya', false), 'ok', 'late first beat');
reset role;
update app.presence set started_at = now() - interval '10 minutes', last_beat_at = now() - interval '1 minute';
call tests.act_as('44444444-0000-0000-0000-00000000000a');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-0000000000e1', 'kimya', null,
  tests.midnight(5) + interval '3 hours', tests.midnight(5) + interval '3 hours 40 minutes', 2400, 'timer'), 'accepted',
  'partly observed session is accepted');
select is((select duration_s::text || '/' || verified::text from app.study_sessions
            where client_id = 'aaaaaaaa-0000-0000-0000-0000000000e1'), '2400/false',
  'full device duration, marked unverified (not cut to what the server saw)');
select is((select count(*)::int from app.presence), 0, 'the upload ends the live status in this case too');

-- ---------------------------------------------------------------- late retry of a verified session
-- A ended 4 minutes ago (last beat 5 minutes ago); the first upload failed and the outbox sends it
-- now. B was studied offline right after A. A must end when it ended, not now.
reset role;
call tests.act_as('44444444-0000-0000-0000-00000000000d');
select is(public.beat('aaaaaaaa-0000-0000-0000-0000000000a1', 'tarih', false), 'ok', 'A is live');
reset role;
update app.presence set started_at = now() - interval '34 minutes', last_beat_at = now() - interval '5 minutes';
call tests.act_as('44444444-0000-0000-0000-00000000000d');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-0000000000a1', 'tarih', null,
  now() - interval '34 minutes', now() - interval '4 minutes', 1800, 'timer'), 'accepted', 'late upload of A');
select is((select verified::text || '/' || (ended_at = now() - interval '4 minutes')::text from app.study_sessions
            where client_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'true/true',
  'A is verified and ends at start + active time, not at the time of sending');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-0000000000b1', 'tarih', null,
  now() - interval '3 minutes 30 seconds', now() - interval '1 minute 30 seconds', 120, 'timer'), 'accepted',
  'B right after A is not an overlap');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-0000000000b2', 'tarih', null,
  now() - interval '1 minute', now() - interval '10 seconds', 50, 'manual'), 'accepted',
  'neither is a manual entry after it');

-- ---------------------------------------------------------------- no group: no live status
reset role;
call tests.act_as('44444444-0000-0000-0000-00000000000c');
select is(public.beat('aaaaaaaa-0000-0000-0000-0000000000c1', 'fizik', false), 'ignored',
  'without a group the heartbeat is not stored (KVKK m.4)');
select is((select count(*)::int from app.presence), 0, 'no presence row');
reset role;
call tests.act_as('44444444-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------- offline session: unverified
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000002', 'matematik', 'tyt.matematik.problemler',
  tests.t('0 hours'), tests.t('1 hour'), 3000, 'timer'), 'accepted', 'offline session is accepted');
select is((select verified from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000002'), false,
  'offline session is unverified');
select is((select started_at from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  tests.t('0 hours'), 'offline session keeps the device times');
select is((select seconds from app.daily_totals where day = tests.day(2)), 3000, 'counted on its Istanbul day');
select is((select verified_seconds from app.daily_totals where day = tests.day(2)), 0, 'not counted as verified');

-- ---------------------------------------------------------------- overlap
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000003', 'matematik', null,
  tests.t('30 minutes'), tests.t('90 minutes'), 1800, 'timer'), 'overlap', 'overlapping session is refused');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000004', 'kimya', null,
  tests.t('59 minutes'), tests.t('2 hours'), 3000, 'timer'), 'accepted', 'a 1-minute clock overlap at the start is cut');
select is((select started_at from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  tests.t('1 hour'), 'start moved to the end of the previous session');
select is((select duration_s from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000004'), 3000,
  'duration still fits the shortened span');

-- ---------------------------------------------------------------- implausible values
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000005', 'fizik', null,
  tests.t('3 hours'), tests.t('14 hours'), 36001, 'timer'), 'too_long', 'over 10 hours is refused');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000006', 'fizik', null,
  tests.t('3 hours'), tests.t('4 hours'), 4000, 'timer'), 'invalid', 'duration longer than the span is refused');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000007', 'fizik', null,
  now() + interval '1 hour', now() + interval '2 hours', 600, 'timer'), 'future', 'a future session is refused');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000008', 'fizik', null,
  now() - interval '40 days', now() - interval '40 days' + interval '1 hour', 600, 'timer'), 'too_old',
  'a very old offline session is refused');
select is(public.submit_session(null, 'fizik', null, tests.t('3 hours'), tests.t('4 hours'), 600, 'timer'), 'invalid',
  'a session needs a client uuid');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000010', 'fizik', null,
  tests.t('3 hours'), tests.t('4 hours'), 600, 'sensor'), 'invalid', 'unknown source is refused');

-- ---------------------------------------------------------------- manual ("elle")
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000011', 'tarih', null,
  tests.t('3 hours'), tests.t('4 hours'), 3600, 'manual'), 'accepted', 'manual session is accepted');
select is((select source || '/' || verified::text from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000011'),
  'manual/false', 'manual session is labelled and never verified');
select is((select manual_seconds from app.daily_totals where day = tests.day(2)), 3600, 'manual time is counted separately');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000012', 'tarih', null,
  now() - interval '10 days', now() - interval '10 days' + interval '1 hour', 3600, 'manual'), 'too_old',
  'manual entries only for the last 7 days');

-- ---------------------------------------------------------------- 16 hours a day
reset role;
update app.daily_totals set seconds = 57000 where day = tests.day(2) and user_id = '44444444-0000-0000-0000-00000000000a';
call tests.act_as('44444444-0000-0000-0000-00000000000a');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000013', 'fizik', null,
  tests.t('5 hours'), tests.t('6 hours'), 1200, 'timer'), 'day_limit', 'more than 16 hours a day is refused');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000014', 'fizik', null,
  tests.t('5 hours'), tests.t('6 hours'), 600, 'timer'), 'accepted', 'up to 16 hours is fine');

-- ---------------------------------------------------------------- Istanbul midnight split
-- 23:30 four days ago – 00:30 three days ago (Istanbul): 30 minutes on each day.
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000015', 'biyoloji', null,
  tests.midnight(3) - interval '30 minutes', tests.midnight(3) + interval '30 minutes',
  3600, 'timer'), 'accepted', 'a session across midnight is accepted');
select is((select seconds from app.daily_totals where day = tests.day(4)), 1800, 'first half counts on the earlier day');
select is((select seconds from app.daily_totals where day = tests.day(3)), 1800, 'second half counts on the later day');

-- ---------------------------------------------------------------- append only, own rows only
select throws_ok($$ insert into app.study_sessions (user_id, client_id, subject_id, started_at, ended_at, duration_s, source, verified)
  values ('44444444-0000-0000-0000-00000000000a', gen_random_uuid(), 'x', now() - interval '1 hour', now(), 60, 'timer', true) $$,
  '42501', null, 'no direct insert');
select throws_ok($$ delete from app.study_sessions $$, '42501', null, 'no direct delete');
select throws_ok($$ select * from app.daily_totals for update $$, '42501', null, 'no row locks / updates');
select ok((select count(*) from app.study_sessions) >= 5, 'own sessions are readable');
reset role;
select throws_ok($$ update app.study_sessions set duration_s = 1 $$, 'P0001', 'append_only',
  'sessions cannot be changed even by the owner role');
select throws_ok($$ insert into app.study_sessions (user_id, client_id, subject_id, started_at, ended_at, duration_s, source, verified)
  values ('44444444-0000-0000-0000-00000000000a', gen_random_uuid(), 'x', tests.t('10 minutes'), tests.t('20 minutes'), 60, 'timer', false) $$,
  '23P01', null, 'the database itself refuses overlapping sessions');
call tests.act_as('44444444-0000-0000-0000-00000000000b');
select is((select count(*)::int from app.study_sessions), 0, 'another user sees none of the sessions');
select is((select count(*)::int from app.daily_totals), 0, 'another user sees none of the totals');
select is((select count(*)::int from app.presence), 0, 'another user sees no presence row');

-- ---------------------------------------------------------------- delete one session (KVKK m.7, kvkk/08 #4)
select is(public.delete_session('aaaaaaaa-0000-0000-0000-000000000011'), 'not_found', 'nobody deletes another user''s session');
reset role;
call tests.act_as('44444444-0000-0000-0000-00000000000a');
select is(public.delete_session('aaaaaaaa-0000-0000-0000-000000000011'), 'deleted', 'the owner deletes a manual entry');
select is((select count(*)::int from app.study_sessions where client_id = 'aaaaaaaa-0000-0000-0000-000000000011'), 0,
  'the session is gone');
select is((select manual_seconds from app.daily_totals where day = tests.day(2)), 0, 'the day total loses the manual part');
select is(public.delete_session('aaaaaaaa-0000-0000-0000-000000000015'), 'deleted', 'a session across midnight');
select is((select count(*)::int from app.daily_totals where day in (tests.day(3), tests.day(4))), 0,
  'both days lose exactly what the session added');
select is(public.delete_session('aaaaaaaa-0000-0000-0000-000000000015'), 'not_found', 'deleting twice is harmless');

-- ---------------------------------------------------------------- subjects and topics are ids
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000020', 'https://t.me/x', null,
  tests.t('20 hours'), tests.t('21 hours'), 600, 'timer'), 'invalid', 'an unknown subject is refused');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000021', 'fizik', 'Ali yaz bana',
  tests.t('20 hours'), tests.t('21 hours'), 600, 'timer'), 'invalid', 'a topic is an id, never free text');
select is(public.submit_session('aaaaaaaa-0000-0000-0000-000000000022', 'fizik', 'tyt.fizik.optik',
  tests.t('20 hours'), tests.t('21 hours'), 600, 'timer'), 'accepted', 'a curriculum topic id is fine');

select * from finish();
rollback;
