-- K-23 minor policy (20261020120400_etut_minor_policy.sql): what a 15–17 account may do before a
-- parent approves, in every policy ('closed' default, 'strict', 'basic', 'open'); the parent's
-- approval (evidence in audit) and objection (deletes the account, deletion record); and how it
-- sits with the existing parent locks. anon can execute nothing.
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
  values (p_id, p_nick, 'YKS', 'sayisal', p_band);
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;
create procedure tests.policy(p_policy text) language sql as $$
  update app.settings set minor_policy = p_policy;
$$;
-- Runs one statement as the current role: its text result, 'ok' for no result, or the error.
create function tests.try(p_sql text) returns text language plpgsql as $$
declare
  r text;
begin
  execute p_sql into r;
  return coalesce(nullif(r, ''), 'ok');
exception when others then
  return sqlerrm;
end
$$;
-- The permission table of the caller (a 15–17 member of p_group, next to the adult p_peer).
create function tests.actions(p_nick text, p_group uuid, p_peer uuid, p_code text) returns text language plpgsql as $$
declare
  out text[] := '{}';
begin
  out := out || ('profile=' || tests.try(format($q$select public.save_profile(%L, 'YKS', 'sayisal', '15_17')$q$, p_nick)));
  out := out || ('parent_code=' || tests.try($q$select 'ok' from public.create_parent_code()$q$));
  out := out || ('groups=' || tests.try($q$select 'ok' from public.my_groups() limit 1$q$));
  out := out || ('board=' || tests.try(format($q$select 'ok' from public.group_board(%L) limit 1$q$, p_group)));
  out := out || ('join=' || tests.try(format($q$select public.request_join(%L)$q$, p_code)));
  out := out || ('create=' || tests.try($q$select 'ok' from public.create_group('Yeni Grup')$q$));
  out := out || ('visible=' || tests.try($q$select public.set_preferences(false, null)$q$));
  out := out || ('beat=' || tests.try($q$select public.beat(gen_random_uuid(), 'fizik', false)$q$));
  out := out || ('react=' || tests.try(format($q$select public.send_reaction(%L, %L, 'hadi')$q$, p_group, p_peer)));
  return array_to_string(out, ' ');
end
$$;
-- What the adult p_peer sees of p_minor in p_group, and whether a reaction reaches them.
create function tests.peer_view(p_group uuid, p_minor uuid) returns text language plpgsql as $$
begin
  return 'seen=' || coalesce((select b.studying::text from public.group_board(p_group) b where b.user_id = p_minor), 'hidden')
      || ' to=' || tests.try(format($q$select public.send_reaction(%L, %L, 'tebrik')$q$, p_group, p_minor));
end
$$;
grant execute on function tests.try(text) to authenticated;
grant execute on function tests.actions(text, uuid, uuid, text) to authenticated;
grant execute on function tests.peer_view(uuid, uuid) to authenticated;
create temp table stamps (key text primary key, at timestamptz);
grant all on stamps to authenticated;

-- Adult founder A; groups G (everyone is a member), J1/J2/J3 (to ask to join, by code).
call tests.user('12000000-0000-0000-0000-0000000000a1');
call tests.profile('12000000-0000-0000-0000-0000000000a1', 'Kurucu', '18_plus');
insert into app.groups (id, name) values ('12000000-0000-0000-0000-000000000901', 'Ortak Grup');
insert into app.groups (id, name, invite_code, invite_expires_at) values
  ('12000000-0000-0000-0000-000000000902', 'Birinci Ekip', 'JRNXQWT2', now() + interval '1 day'),
  ('12000000-0000-0000-0000-000000000903', 'Ikinci Ekip', 'JRNXQWT3', now() + interval '1 day'),
  ('12000000-0000-0000-0000-000000000904', 'Ucuncu Ekip', 'JRNXQWT4', now() + interval '1 day');
insert into app.memberships (group_id, user_id, role) values
  ('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'owner'),
  ('12000000-0000-0000-0000-000000000902', '12000000-0000-0000-0000-0000000000a1', 'owner'),
  ('12000000-0000-0000-0000-000000000903', '12000000-0000-0000-0000-0000000000a1', 'owner'),
  ('12000000-0000-0000-0000-000000000904', '12000000-0000-0000-0000-0000000000a1', 'owner');
-- 15–17 members of G, one per policy run: C closed, S strict, B basic, O open, X objection.
call tests.user('12000000-0000-0000-0000-00000000000c');
call tests.profile('12000000-0000-0000-0000-00000000000c', 'Kapali Genc', '15_17');
call tests.user('12000000-0000-0000-0000-000000000005');
call tests.profile('12000000-0000-0000-0000-000000000005', 'Siki Genc', '15_17');
call tests.user('12000000-0000-0000-0000-00000000000b');
call tests.profile('12000000-0000-0000-0000-00000000000b', 'Temel Genc', '15_17');
call tests.user('12000000-0000-0000-0000-000000000000');
call tests.profile('12000000-0000-0000-0000-000000000000', 'Acik Genc', '15_17');
call tests.user('12000000-0000-0000-0000-0000000000e1');
call tests.profile('12000000-0000-0000-0000-0000000000e1', 'Itiraz Genc', '15_17');
insert into app.memberships (group_id, user_id, role)
select '12000000-0000-0000-0000-000000000901', id, 'member' from (values
  ('12000000-0000-0000-0000-00000000000c'::uuid), ('12000000-0000-0000-0000-000000000005'),
  ('12000000-0000-0000-0000-00000000000b'), ('12000000-0000-0000-0000-000000000000'),
  ('12000000-0000-0000-0000-0000000000e1')) v (id);
-- Parents (no profile of their own): P5 and P5b of S, Pb of B, Px1 and Px2 of X. N: new user.
-- Z: a stranger.
call tests.user('12000000-0000-0000-0000-0000000000f5');
call tests.user('12000000-0000-0000-0000-0000000005f5');
call tests.user('12000000-0000-0000-0000-0000000000fb');
call tests.user('12000000-0000-0000-0000-0000000001f1');
call tests.user('12000000-0000-0000-0000-0000000002f1');
call tests.user('12000000-0000-0000-0000-0000000000dd');
call tests.user('12000000-0000-0000-0000-0000000000ff');
insert into app.parent_links (child_id, parent_id) values
  ('12000000-0000-0000-0000-00000000000b', '12000000-0000-0000-0000-0000000000fb'),
  ('12000000-0000-0000-0000-0000000000e1', '12000000-0000-0000-0000-0000000001f1'),
  ('12000000-0000-0000-0000-0000000000e1', '12000000-0000-0000-0000-0000000002f1');

-- ---------------------------------------------------------------- grants and the setting
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app', 'audit') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon cannot execute any function in public, app or audit');
select ok(has_function_privilege('authenticated', 'public.my_minor_status()', 'execute'), 'clients read their own standing');
select ok(has_function_privilege('authenticated', 'public.parent_approvals()', 'execute'), 'parents read their approvals');
select ok(has_function_privilege('authenticated', 'public.parent_approve(uuid)', 'execute'), 'parents can approve');
select ok(has_function_privilege('authenticated', 'public.parent_object(uuid)', 'execute'), 'parents can object');
select ok(not has_function_privilege('authenticated', 'app.minor_policy()', 'execute'), 'clients cannot call the policy reader');
select ok(not has_function_privilege('authenticated', 'app.minor_restriction(uuid)', 'execute'), 'nor the restriction helper');
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'app' and table_name = 'settings' and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0, 'no client grant on app.settings');
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select * from app.settings $$, '42501', null, 'clients cannot read the setting');
select throws_ok($$ select approved_at from app.parent_links $$, '42501', null, 'nor the approval column');
reset role;

select is(app.minor_policy(), 'closed', 'the policy is closed by default (18+ beta)');
select ok((select column_default from information_schema.columns
            where table_schema = 'app' and table_name = 'settings' and column_name = 'minor_policy') like '%closed%',
  'and a fresh row defaults to closed');
select throws_ok($$ update app.settings set minor_policy = 'maybe' $$, '23514', null, 'only the four policies');
select throws_ok($$ insert into app.settings (id) values (false) $$, '23514', null, 'one row only');
call tests.policy('strict');
select ok(exists (select 1 from audit.events where user_id is null and action = 'minor_policy:strict'),
  'a policy change is written to the audit trail');
delete from app.settings;
select is(app.minor_policy(), 'closed', 'without the row the policy counts as closed');
insert into app.settings (id, minor_policy) values (true, 'closed');

-- ---------------------------------------------------------------- closed: profiles
call tests.act_as('12000000-0000-0000-0000-0000000000dd');
select throws_ok($$ select public.save_profile('Yeni Genc', 'YKS', 'sayisal', '15_17') $$, 'P0001', 'minor_closed',
  'closed: no new 15-17 profile');
select is((select policy || '/' || coalesce(band, '-') || '/' || linked || '/' || approved || '/' || coalesce(days_since_signup::text, '-')
             from public.my_minor_status()),
  'closed/-/false/false/-', 'my_minor_status without a profile');
select lives_ok($$ select public.save_profile('Yeni Kisi', 'YKS', 'sayisal', '18_plus') $$, 'closed: 18+ is fine');
select throws_ok($$ select public.save_profile('Yeni Kisi', 'YKS', 'sayisal', '15_17') $$, 'P0001', 'minor_closed',
  'closed: an 18+ profile cannot change to 15-17');
reset role;
call tests.policy('strict');
call tests.act_as('12000000-0000-0000-0000-0000000000dd');
select lives_ok($$ select public.save_profile('Yeni Kisi', 'YKS', 'sayisal', '15_17') $$, 'strict: changing to 15-17 is allowed');
select is((select band || '/' || days_since_signup from public.my_minor_status()), '15_17/0', 'band and days since signup');
reset role;
update app.profiles set created_at = now() - interval '14 days' where user_id = '12000000-0000-0000-0000-0000000000dd';
call tests.act_as('12000000-0000-0000-0000-0000000000dd');
select is((select days_since_signup from public.my_minor_status()), 14, 'day 14 for the reminder');
reset role;

-- ---------------------------------------------------------------- the permission table
-- closed: an existing 15-17 account (made under another policy) keeps the account and the link.
call tests.policy('closed');
call tests.act_as('12000000-0000-0000-0000-00000000000c');
select is(tests.actions('Kapali Genc', '12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'JRNXQWT2'),
  'profile=ok parent_code=ok groups=minor_closed board=minor_closed join=minor_closed create=minor_closed visible=ok beat=ignored react=minor_closed',
  'closed: account and parent link only');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(tests.peer_view('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-00000000000c'),
  'seen=hidden to=not_allowed', 'closed: hidden from the group, no reactions to them');
select lives_ok($$ select 'x' from public.create_group('Yetiskin Grubu') $$, 'closed: an adult is not affected');
reset role;

-- strict, not approved.
call tests.policy('strict');
call tests.act_as('12000000-0000-0000-0000-000000000005');
select is(tests.actions('Siki Genc', '12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'JRNXQWT2'),
  'profile=ok parent_code=ok groups=minor_pending board=minor_pending join=minor_pending create=minor_pending visible=ok beat=ignored react=minor_pending',
  'strict before approval: account and parent link only');
select is((select linked::text || '/' || approved from public.my_minor_status()), 'false/false', 'not linked yet');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(tests.peer_view('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-000000000005'),
  'seen=hidden to=not_allowed', 'strict before approval: hidden, no reactions to them');
reset role;

-- basic, not approved.
call tests.policy('basic');
call tests.act_as('12000000-0000-0000-0000-00000000000b');
select is(tests.actions('Temel Genc', '12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'JRNXQWT2'),
  'profile=ok parent_code=ok groups=ok board=ok join=requested create=minor_pending visible=minor_pending beat=ok react=minor_pending',
  'basic before approval: may join, no new group, no reactions, cannot turn visibility on');
select is((select invisible from public.get_me()), true, 'basic before approval: always invisible');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(tests.peer_view('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-00000000000b'),
  'seen=false to=not_allowed', 'basic before approval: a member, but never seen studying, no reactions to them');
select is(public.decide_join_request((select id from app.join_requests where user_id = '12000000-0000-0000-0000-00000000000b'), true),
  'approved', 'basic: the founder can let them in');
reset role;

-- open.
call tests.policy('open');
call tests.act_as('12000000-0000-0000-0000-000000000000');
select is(tests.actions('Acik Genc', '12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'JRNXQWT2'),
  'profile=ok parent_code=ok groups=ok board=ok join=requested create=ok visible=ok beat=ok react=sent',
  'open: no restriction');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(tests.peer_view('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-000000000000'),
  'seen=true to=sent', 'open: seen studying, reactions reach them');
reset role;

-- Side paths: reactions waiting from before are dropped unseen, and study time of a member that
-- nobody can see any more is not stored.
call tests.policy('basic');
call tests.act_as('12000000-0000-0000-0000-000000000000');
select is((select count(*)::int from public.take_reactions()), 0, 'basic: a reaction sent while open is not shown');
reset role;
select is((select count(*)::int from app.reactions where to_user = '12000000-0000-0000-0000-000000000000' and delivered_at is null),
  0, 'it is dropped, not kept for later');
call tests.policy('strict');
call tests.act_as('12000000-0000-0000-0000-000000000000');
select is(public.submit_session(gen_random_uuid(), null, null, now() - interval '2 hours', now() - interval '90 minutes', 1800, 'manual'),
  'ignored', 'strict, no parent: a hidden membership does not make uploads wanted');
reset role;
call tests.policy('open');
call tests.act_as('12000000-0000-0000-0000-000000000000');
select is(public.submit_session(gen_random_uuid(), null, null, now() - interval '2 hours', now() - interval '90 minutes', 1800, 'manual'),
  'accepted', 'open: stored as before');
reset role;

-- ---------------------------------------------------------------- approval
call tests.policy('strict');
-- S links two parents (code typed on the parents' devices).
create temp table c1 (code text, expires_at timestamptz);
grant all on c1 to authenticated;
call tests.act_as('12000000-0000-0000-0000-000000000005');
insert into c1 select * from public.create_parent_code();
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000f5');
select is((select status from public.claim_parent_code((select code from c1))), 'linked', 'the parent links');
select results_eq($$ select child_id, approved_at, approved, policy from public.parent_approvals() $$,
  $$ values ('12000000-0000-0000-0000-000000000005'::uuid, null::timestamptz, false, 'strict'::text) $$,
  'the parent sees that no approval was given yet');
reset role;
delete from c1;
call tests.act_as('12000000-0000-0000-0000-000000000005');
insert into c1 select * from public.create_parent_code();
select is((select linked::text || '/' || approved from public.my_minor_status()), 'true/false', 'linked, not approved');
select throws_ok($$ select * from public.group_board('12000000-0000-0000-0000-000000000901') $$, 'P0001', 'minor_pending',
  'a link alone opens nothing');
select throws_ok($$ select public.parent_approve('12000000-0000-0000-0000-000000000005') $$, 'P0001', 'not_parent',
  'the student cannot approve for themselves');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000005f5');
select is((select status from public.claim_parent_code((select code from c1))), 'linked', 'a second parent links');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000ff');
select throws_ok($$ select public.parent_approve('12000000-0000-0000-0000-000000000005') $$, 'P0001', 'not_parent',
  'a stranger cannot approve');
reset role;

create temp table before_approval as select count(*) as n from audit.events;
call tests.act_as('12000000-0000-0000-0000-0000000000f5');
insert into stamps select 'approved', public.parent_approve('12000000-0000-0000-0000-000000000005');
select is((select at from stamps where key = 'approved'), now(), 'parent_approve returns the time of the approval');
reset role;
select is((select approved_at from app.parent_links
            where child_id = '12000000-0000-0000-0000-000000000005' and parent_id = '12000000-0000-0000-0000-0000000000f5'),
  now(), 'the approval is on the parent''s link');
-- (One transaction: now() does not move. Date the approval back to see that it is kept.)
update app.parent_links set approved_at = now() - interval '1 hour'
 where child_id = '12000000-0000-0000-0000-000000000005' and parent_id = '12000000-0000-0000-0000-0000000000f5';
call tests.act_as('12000000-0000-0000-0000-0000000000f5');
insert into stamps select 'again', public.parent_approve('12000000-0000-0000-0000-000000000005');
reset role;
select is((select at from stamps where key = 'again'), now() - interval '1 hour', 'approving again keeps the first time');
select results_eq(
  $$ select user_id, action from audit.events where at = now() and action in ('parent_approved', 'approved_by_parent') order by action $$,
  $$ values ('12000000-0000-0000-0000-000000000005'::uuid, 'approved_by_parent'::text),
            ('12000000-0000-0000-0000-0000000000f5'::uuid, 'parent_approved'::text) $$,
  'the approval is evidence in audit: the parent''s action and the student''s account, same time');
select is((select count(*) from audit.events) - (select n from before_approval), 2::bigint, 'written once, not on the second call');
call tests.act_as('12000000-0000-0000-0000-0000000005f5');
select results_eq($$ select approved_at, approved from public.parent_approvals() $$,
  $$ values (null::timestamptz, true) $$, 'the other parent sees the approval (not as their own)');
reset role;

call tests.act_as('12000000-0000-0000-0000-000000000005');
select is((select approved from public.my_minor_status()), true, 'the student sees the approval');
select is(tests.actions('Siki Genc', '12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'JRNXQWT3'),
  'profile=ok parent_code=parent_limit groups=ok board=ok join=requested create=ok visible=ok beat=ok react=sent',
  'strict after approval: everything opens (two parents: no new code)');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(tests.peer_view('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-000000000005'),
  'seen=true to=sent', 'strict after approval: seen, reactions reach them');
reset role;

call tests.policy('basic');
call tests.act_as('12000000-0000-0000-0000-0000000000fb');
select lives_ok($$ select public.parent_approve('12000000-0000-0000-0000-00000000000b') $$, 'basic: the parent approves');
reset role;
call tests.act_as('12000000-0000-0000-0000-00000000000b');
select is(tests.actions('Temel Genc', '12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-0000000000a1', 'JRNXQWT3'),
  'profile=ok parent_code=ok groups=ok board=ok join=requested create=ok visible=ok beat=ok react=sent',
  'basic after approval: everything opens');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(tests.peer_view('12000000-0000-0000-0000-000000000901', '12000000-0000-0000-0000-00000000000b'),
  'seen=true to=sent', 'basic after approval: seen, reactions reach them');
reset role;

-- closed wins over an approval.
call tests.policy('closed');
call tests.act_as('12000000-0000-0000-0000-000000000005');
select throws_ok($$ select * from public.group_board('12000000-0000-0000-0000-000000000901') $$, 'P0001', 'minor_closed',
  'closed: an approval does not reopen groups');
reset role;

-- ---------------------------------------------------------------- with the existing locks
call tests.policy('strict');
call tests.act_as('12000000-0000-0000-0000-0000000000f5');
select lives_ok($$ select public.parent_set_controls('12000000-0000-0000-0000-000000000005', true, false, null) $$,
  'an approving parent can still turn groups off');
reset role;
call tests.act_as('12000000-0000-0000-0000-000000000005');
select throws_ok($$ select * from public.group_board('12000000-0000-0000-0000-000000000901') $$, 'P0001', 'parent_locked',
  'approval does not lift the parent lock');
select is(public.beat(gen_random_uuid(), 'fizik', false), 'ignored', 'no live status under the lock');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000f5');
select lives_ok($$ select public.parent_set_controls('12000000-0000-0000-0000-000000000005', false, true, null) $$,
  'lock off, "görünmez çalış" forced');
reset role;
call tests.act_as('12000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.set_preferences(false, null) $$, 'P0001', 'parent_locked', 'the forced invisibility stays');
select is(public.beat(gen_random_uuid(), 'fizik', false), 'ok', 'the student studies');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is((select studying from public.group_board('12000000-0000-0000-0000-000000000901')
            where user_id = '12000000-0000-0000-0000-000000000005'), false, 'and is not seen');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000f5');
select lives_ok($$ select public.parent_set_controls('12000000-0000-0000-0000-000000000005', false, false, null) $$,
  'all locks off');
reset role;

-- A join request from before the policy changed: the founder's yes cannot be carried out.
call tests.policy('basic');
call tests.user('12000000-0000-0000-0000-0000000000b2');
call tests.profile('12000000-0000-0000-0000-0000000000b2', 'Bekleyen Genc', '15_17');
call tests.act_as('12000000-0000-0000-0000-0000000000b2');
select is(public.request_join('JRNXQWT4'), 'requested', 'basic: a request before approval');
reset role;
call tests.policy('strict');
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select is(public.decide_join_request((select id from app.join_requests where user_id = '12000000-0000-0000-0000-0000000000b2'), true),
  'not_allowed', 'strict: the founder''s yes is not carried out');
reset role;

-- The approval ends with its link.
call tests.policy('basic');
call tests.act_as('12000000-0000-0000-0000-0000000000fb');
select lives_ok($$ select public.parent_unlink('12000000-0000-0000-0000-00000000000b') $$, 'the parent of B unlinks');
reset role;
call tests.act_as('12000000-0000-0000-0000-00000000000b');
select is((select linked::text || '/' || approved from public.my_minor_status()), 'false/false', 'the approval went with the link');
select throws_ok($$ select 'x' from public.create_group('Bir Grup Daha') $$, 'P0001', 'minor_pending', 'basic rules again');
reset role;
call tests.policy('strict');
call tests.act_as('12000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.child_unlink_parents() $$, 'S removes both parent links');
select is((select approved from public.my_minor_status()), false, 'no approval left');
select throws_ok($$ select * from public.my_groups() $$, 'P0001', 'minor_pending', 'strict rules again');
select lives_ok($$ select public.leave_group('12000000-0000-0000-0000-000000000901') $$, 'leaving a group always works');
reset role;

-- ---------------------------------------------------------------- objection
call tests.act_as('12000000-0000-0000-0000-0000000002f1');
select lives_ok($$ select public.parent_approve('12000000-0000-0000-0000-0000000000e1') $$, 'one parent of X approves');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000ff');
select throws_ok($$ select public.parent_object('12000000-0000-0000-0000-0000000000e1') $$, 'P0001', 'not_parent',
  'a stranger cannot object');
reset role;
call tests.act_as('12000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select public.parent_object('12000000-0000-0000-0000-0000000000e1') $$, 'P0001', 'not_parent',
  'the student cannot object for a parent');
reset role;
select is((select count(*)::int from auth.users where id = '12000000-0000-0000-0000-0000000000e1'), 1, 'so X is still there');

call tests.act_as('12000000-0000-0000-0000-0000000001f1');
select lives_ok($$ select public.parent_object('12000000-0000-0000-0000-0000000000e1') $$,
  'the other parent objects (after the first one approved)');
select is((select count(*)::int from public.parent_children()), 0, 'the child is gone from the parent screen');
select is((select count(*)::int from public.parent_notices()), 0, 'the objecting parent gets no notice');
select throws_ok($$ select public.parent_object('12000000-0000-0000-0000-0000000000e1') $$, 'P0001', 'not_parent',
  'objecting again does nothing');
reset role;
select is((select count(*)::int from auth.users where id = '12000000-0000-0000-0000-0000000000e1'), 0, 'the account is deleted');
select is((select count(*)::int from app.profiles where user_id = '12000000-0000-0000-0000-0000000000e1'), 0, 'with its profile');
select is((select count(*)::int from app.memberships where user_id = '12000000-0000-0000-0000-0000000000e1'), 0, 'and memberships');
select is((select count(*)::int from app.parent_links where child_id = '12000000-0000-0000-0000-0000000000e1'), 0, 'and links');
select results_eq(
  $$ select account_id, method, requested_at = deleted_at from audit.deletion_records $$,
  $$ values ('12000000-0000-0000-0000-0000000000e1'::uuid, 'parent_objection'::text, true) $$,
  'a deletion record names the objection');
select ok(exists (select 1 from audit.events where user_id = '12000000-0000-0000-0000-0000000001f1' and action = 'parent_objected'),
  'the objection is in the audit trail under the parent''s account');
select ok(exists (select 1 from audit.events where user_id = '12000000-0000-0000-0000-0000000000e1' and action = 'account_deleted'),
  'and the deletion under the student''s');
call tests.act_as('12000000-0000-0000-0000-0000000002f1');
select results_eq($$ select kind from public.parent_notices() $$, $$ values ('link_ended'::text) $$,
  'the approving parent is told the link ended');
reset role;
select is((select count(*)::int from auth.users where id in ('12000000-0000-0000-0000-0000000001f1', '12000000-0000-0000-0000-0000000002f1')),
  2, 'both parent accounts stay');

-- ---------------------------------------------------------------- founder hand-over
-- Under 'basic' a restricted 15–17 member who joined first does not become the founder while an
-- unrestricted member is there.
call tests.policy('basic');
call tests.user('12000000-0000-0000-0000-0000000000a3');
call tests.profile('12000000-0000-0000-0000-0000000000a3', 'Yetiskin Uye', '18_plus');
insert into app.groups (id, name) values ('12000000-0000-0000-0000-000000000905', 'Devir Grubu');
insert into app.memberships (group_id, user_id, role, joined_at) values
  ('12000000-0000-0000-0000-000000000905', '12000000-0000-0000-0000-0000000000a1', 'owner', now() - interval '3 days'),
  ('12000000-0000-0000-0000-000000000905', '12000000-0000-0000-0000-0000000000b2', 'member', now() - interval '2 days'),
  ('12000000-0000-0000-0000-000000000905', '12000000-0000-0000-0000-0000000000a3', 'member', now() - interval '1 day');
call tests.act_as('12000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.leave_group('12000000-0000-0000-0000-000000000905') $$, 'the founder leaves');
reset role;
select is((select user_id from app.memberships where group_id = '12000000-0000-0000-0000-000000000905' and role = 'owner'),
  '12000000-0000-0000-0000-0000000000a3'::uuid, 'the adult becomes the founder, not the restricted student who joined first');
call tests.act_as('12000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select public.leave_group('12000000-0000-0000-0000-000000000905') $$, 'the new founder leaves too');
reset role;
select is((select user_id from app.memberships where group_id = '12000000-0000-0000-0000-000000000905' and role = 'owner'),
  '12000000-0000-0000-0000-0000000000b2'::uuid, 'with nobody else left the group still has a founder');

select * from finish();
rollback;
