-- KVKK applications (K-31, K-38; kvkk/07 C2, C5, C6): own requests only, 30-day deadline, the
-- answer is written once and never changes, proof of delivery, 3-year retention, data export.
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
create temp table ra (request_id uuid, ref text, created_at timestamptz, due_at timestamptz);
create temp table rb (request_id uuid, ref text, created_at timestamptz, due_at timestamptz);
create temp table seen (at timestamptz);
create temp table ex (who text, data jsonb);
grant all on ra, rb, seen, ex to authenticated;

-- A and B are students; P is a parent account without a profile.
call tests.user_with_profile('88888888-0000-0000-0000-00000000000a', 'Başvuran', '18_plus');
call tests.user_with_profile('88888888-0000-0000-0000-00000000000b', 'Diğeri', '15_17');
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at)
values ('88888888-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now());

-- ---------------------------------------------------------------- schema and grants
select ok((select c.relrowsecurity from pg_class c where c.oid = 'app.dsr_requests'::regclass), 'RLS is on');
select ok(not has_function_privilege('anon', 'public.submit_request(text, text, text)', 'execute'), 'anon cannot submit');
select ok(not has_function_privilege('anon', 'public.my_requests()', 'execute'), 'anon cannot list');
select ok(not has_function_privilege('anon', 'public.mark_request_seen(uuid)', 'execute'), 'anon cannot mark seen');
select ok(not has_function_privilege('anon', 'public.export_my_data()', 'execute'), 'anon cannot export');
select ok(has_function_privilege('authenticated', 'public.submit_request(text, text, text)', 'execute'), 'authenticated can submit');
select ok(not has_function_privilege('authenticated', 'app.answer_request(text, text, text)', 'execute'),
  'clients cannot answer (operator only)');
select ok(not has_function_privilege('authenticated', 'app.purge_requests()', 'execute'), 'clients cannot purge');
select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'app' and table_name = 'dsr_requests'
              and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type <> 'SELECT'), 0,
  'no client write grant on requests');
select is((select count(*)::int from information_schema.column_privileges
            where table_schema = 'app' and table_name = 'dsr_requests'
              and grantee = 'authenticated' and column_name = 'user_id'), 0,
  'the account id column is not granted');

-- ---------------------------------------------------------------- submit
call tests.act_as('88888888-0000-0000-0000-00000000000a');
insert into ra select * from public.submit_request('info', 'self', '  Hangi verilerim tutuluyor?  ');
select matches((select ref from ra), '^[A-HJ-NP-Z2-9]{8}$', 'A gets an 8-character application number');
select is((select due_at - created_at from ra), interval '30 days', 'the deadline is 30 days after the submission');
select is((select body from public.my_requests()), 'Hangi verilerim tutuluyor?', 'the text is trimmed');
select throws_ok($$ select * from public.submit_request('complaint', 'self', '   ') $$, 'P0001', 'invalid_input',
  'a complaint needs a text');
select throws_ok($$ select * from public.submit_request('other', 'self', null) $$, 'P0001', 'invalid_input',
  '"diğer" needs a text');
select throws_ok($$ select * from public.submit_request('nope', 'self', 'x') $$, 'P0001', 'invalid_input',
  'unknown kind');
select throws_ok($$ select * from public.submit_request('info', 'someone', null) $$, 'P0001', 'invalid_input',
  'unknown applicant');
select throws_ok($$ select * from public.submit_request('other', 'self', repeat('a', 2001)) $$, 'P0001', 'invalid_input',
  'at most 2000 characters');
select lives_ok($$ select * from public.submit_request('other', 'self', repeat('a', 2000)) $$, '2000 characters are fine');
select lives_ok($$ select * from public.submit_request('deletion', 'self', null) $$, 'a deletion request needs no text');
select is((select count(*)::int from public.my_requests()), 3, 'A sees three own requests');
select is((select kind from public.my_requests() limit 1), 'deletion', 'newest first');
reset role;

-- A parent account (no profile) can apply too, for the child.
call tests.act_as('88888888-0000-0000-0000-0000000000e1');
select lives_ok($$ select * from public.submit_request('complaint', 'parent', 'Çocuğumun grubunda rahatsız edici bir ad var.') $$,
  'a parent account without profile can apply');
select is((select applicant from public.my_requests()), 'parent', 'on behalf of the child');
reset role;

call tests.act_as('88888888-0000-0000-0000-00000000000b');
insert into rb select * from public.submit_request('complaint', 'self', 'Bir grup üyesi beni rahatsız ediyor.');
-- ---------------------------------------------------------------- nobody sees another's request
select is((select count(*)::int from public.my_requests()), 1, 'B sees only the own request');
select is((select count(*)::int from public.my_requests() where ref = (select ref from ra)), 0, 'B does not see A''s request');
select is((select count(*)::int from app.dsr_requests), 1, 'RLS: B reads only the own row from the table');
select is((select count(*)::int from app.dsr_requests where ref = (select ref from ra)), 0, 'RLS: not A''s row');
select throws_ok($$ update app.dsr_requests set body = 'x' $$, '42501', null, 'clients cannot update requests');
select throws_ok($$ delete from app.dsr_requests $$, '42501', null, 'clients cannot delete requests');
select throws_ok($$ insert into app.dsr_requests (ref, kind, due_at) values ('ABCDEFGH', 'info', now()) $$, '42501', null,
  'clients cannot insert directly');
reset role;

-- Rate limit: 5 a day per account (B has used 1).
call tests.act_as('88888888-0000-0000-0000-00000000000b');
select lives_ok($$ select * from public.submit_request('info', 'self', null) $$, 'B second');
select lives_ok($$ select * from public.submit_request('info', 'self', null) $$, 'B third');
select lives_ok($$ select * from public.submit_request('info', 'self', null) $$, 'B fourth');
select lives_ok($$ select * from public.submit_request('info', 'self', null) $$, 'B fifth');
select throws_ok($$ select * from public.submit_request('info', 'self', null) $$, 'P0001', 'rate_limited',
  'the sixth in a day is refused');
reset role;

-- ---------------------------------------------------------------- answer and proof of delivery
call tests.act_as('88888888-0000-0000-0000-00000000000a');
insert into seen select public.mark_request_seen((select request_id from ra));
select is((select at from seen), null, 'nothing to mark before the answer');
select is((select seen_at from public.my_requests() where ref = (select ref from ra)), null, 'seen_at stays empty');
reset role;

select lives_ok($$ select app.answer_request(lower((select ref from ra)), 'accepted', 'Tutulan verilerin listesi ektedir.') $$,
  'the operator answers (the number is normalised)');
select throws_ok($$ select app.answer_request((select ref from ra), 'rejected', 'Başka bir cevap.') $$, 'P0001', null,
  'a second answer is refused');
select throws_ok($$ select app.answer_request((select ref from rb), 'maybe', 'x') $$, 'P0001', null, 'unknown result');
select throws_ok($$ select app.answer_request((select ref from rb), 'accepted', '  ') $$, 'P0001', null, 'an empty answer');
-- Even the owner of the table (operator in psql) cannot change it afterwards.
select throws_ok($$ update app.dsr_requests set answer_text = 'Değişti.' where ref = (select ref from ra) $$,
  'P0001', 'dsr_immutable', 'the answer text cannot be changed');
select throws_ok($$ update app.dsr_requests set answer_result = 'rejected' where ref = (select ref from ra) $$,
  'P0001', 'dsr_immutable', 'the result cannot be changed');
select throws_ok($$ update app.dsr_requests set answered_at = now() - interval '1 day' where ref = (select ref from ra) $$,
  'P0001', 'dsr_immutable', 'the answer time cannot be changed');
select throws_ok($$ update app.dsr_requests set answer_text = null, answer_result = null, answered_at = null
                    where ref = (select ref from ra) $$,
  'P0001', 'dsr_immutable', 'the answer cannot be withdrawn');
select throws_ok($$ update app.dsr_requests set body = 'Başka' where ref = (select ref from rb) $$,
  'P0001', 'dsr_immutable', 'the application text cannot be changed');
select throws_ok($$ update app.dsr_requests set due_at = due_at + interval '30 days' where ref = (select ref from rb) $$,
  'P0001', 'dsr_immutable', 'the deadline cannot be moved');
select throws_ok($$ update app.dsr_requests set user_id = '88888888-0000-0000-0000-00000000000a' where ref = (select ref from rb) $$,
  'P0001', 'dsr_immutable', 'a request cannot be moved to another account');
select throws_ok($$ delete from app.dsr_requests where ref = (select ref from ra) $$,
  'P0001', 'dsr_immutable', 'a request cannot be deleted outside the retention purge');
select throws_ok($$ update app.dsr_requests set seen_at = now() where ref = (select ref from rb) $$,
  '23514', null, 'no "seen" without an answer');
select ok(exists (select 1 from audit.events where action = 'request_answered'
                   and user_id = '88888888-0000-0000-0000-00000000000a'), 'the answer is in the audit trail');

call tests.act_as('88888888-0000-0000-0000-00000000000b');
truncate seen;
insert into seen select public.mark_request_seen((select request_id from ra));
select is((select at from seen), null, 'B cannot mark A''s answer as seen');
reset role;
select is((select seen_at from app.dsr_requests where ref = (select ref from ra)), null, 'A''s answer is still unseen');

call tests.act_as('88888888-0000-0000-0000-00000000000a');
truncate seen;
insert into seen select public.mark_request_seen((select request_id from ra));
select isnt((select at from seen), null, 'A opens the answer: the time is kept');
select is((select answer_text from public.my_requests() where ref = (select ref from ra)), 'Tutulan verilerin listesi ektedir.',
  'A reads the answer');
select is((select answer_result from public.my_requests() where ref = (select ref from ra)), 'accepted', 'with the result');
reset role;
select lives_ok($$ update app.dsr_requests set seen_at = seen_at where ref = (select ref from ra) $$, 'an update that changes nothing passes');
select throws_ok($$ update app.dsr_requests set seen_at = now() + interval '1 day' where ref = (select ref from ra) $$,
  'P0001', 'dsr_immutable', 'the first opening time cannot be changed');
call tests.act_as('88888888-0000-0000-0000-00000000000a');
select is(public.mark_request_seen((select request_id from ra)), (select at from seen), 'opening again keeps the first time');
reset role;

-- ---------------------------------------------------------------- 30-day maths
-- Inserted by the owner role with a wrong deadline: the trigger sets it from the submission.
insert into app.dsr_requests (ref, user_id, kind, created_at, due_at) values
  ('MATHTWAA', null, 'info', '2026-02-15 10:00:00+03', '2026-02-16 10:00:00+03'),
  ('MATHTWBB', null, 'info', '2026-12-20 23:30:00+03', now());
select is((select due_at from app.dsr_requests where ref = 'MATHTWAA'), '2026-03-17 10:00:00+03'::timestamptz,
  '15 Feb + 30 days = 17 Mar (February has 28 days in 2026)');
select is((select app.istanbul_day(due_at) from app.dsr_requests where ref = 'MATHTWBB'), '2027-01-19'::date,
  'late on 20 Dec (Istanbul) + 30 days = 19 Jan, across the year');
select is((select count(*)::int from app.dsr_requests where due_at <> created_at + interval '30 days'), 0,
  'every deadline is exactly 30 days');
-- Out of the way of the retention checks below (these dates would pass 3 years in 2029).
do $$ begin
  perform set_config('etut.purge', 'on', true);
  delete from app.dsr_requests where ref in ('MATHTWAA', 'MATHTWBB');
  perform set_config('etut.purge', 'off', true);
end $$;

-- ---------------------------------------------------------------- export only own data
call tests.act_as('88888888-0000-0000-0000-00000000000a');
select lives_ok($$ select * from public.create_group('Sayısal Ekip') $$, 'A founds a group');
select is(public.beat('cccccccc-0000-0000-0000-000000000001', 'fizik', false), 'ok', 'A has a live status');
insert into ex select 'a', public.export_my_data();
reset role;
call tests.act_as('88888888-0000-0000-0000-00000000000b');
insert into ex select 'b', public.export_my_data();
reset role;
select is((select data ->> 'format' from ex where who = 'a'), 'etut-sunucu-verileri', 'export format');
select is((select data -> 'account' ->> 'id' from ex where who = 'a'), '88888888-0000-0000-0000-00000000000a', 'A''s account');
select is((select data -> 'profile' ->> 'nickname' from ex where who = 'a'), 'Başvuran', 'A''s profile');
select is((select jsonb_array_length(data -> 'requests') from ex where who = 'a'), 3, 'A''s three requests');
select ok((select data -> 'requests' @> jsonb_build_array(jsonb_build_object('ref', (select ref from ra), 'answer_result', 'accepted'))
             from ex where who = 'a'), 'with the answer');
select ok((select data -> 'presence' is not null from ex where who = 'a'), 'and the live status');
select is((select data -> 'groups' -> 0 ->> 'name' from ex where who = 'a'), 'Sayısal Ekip', 'and the group');
select ok((select jsonb_array_length(data -> 'audit_events') > 0 from ex where who = 'a'), 'and the own audit actions');
select ok((select data::text not like '%88888888-0000-0000-0000-00000000000b%' from ex where who = 'a'), 'no trace of B''s id in A''s export');
select ok((select data::text not like '%Diğeri%' from ex where who = 'a'), 'nor B''s nickname');
select ok((select data::text not like '%' || (select ref from rb) || '%' from ex where who = 'a'), 'nor B''s request');
select is((select data -> 'profile' ->> 'nickname' from ex where who = 'b'), 'Diğeri', 'B''s export is B''s');
select ok((select data::text not like '%' || (select ref from ra) || '%' from ex where who = 'b'), 'without A''s request');
select ok((select data::text not like '%Başvuran%' from ex where who = 'b'), 'or A''s nickname');
select is((select jsonb_array_length(data -> 'requests') from ex where who = 'b'), 5, 'B''s five requests');
select ok(not exists (select 1 from ex, jsonb_array_elements(ex.data -> 'audit_events') e where e ? 'ip'),
  'no IP addresses in the export');

-- ---------------------------------------------------------------- account deletion keeps the record
call tests.act_as('88888888-0000-0000-0000-00000000000a');
select lives_ok($$ select public.delete_my_account() $$, 'A deletes the account');
reset role;
select is((select user_id from app.dsr_requests where ref = (select ref from ra)), null,
  'the application stays without the account id (proof, 3 years)');
select is((select answer_text from app.dsr_requests where ref = (select ref from ra)), 'Tutulan verilerin listesi ektedir.',
  'with the answer unchanged');

-- ---------------------------------------------------------------- 3-year retention
insert into app.dsr_requests (ref, kind, created_at, answered_at, answer_result, answer_text) values
  ('ESKCEVAP', 'info', now() - interval '4 years', now() - interval '3 years 1 day', 'accepted', 'Eski cevap.'),
  ('YAKCEVAP', 'info', now() - interval '4 years', now() - interval '2 years', 'accepted', 'Yakın cevap.'),
  ('ESKBEKLE', 'info', now() - interval '3 years 2 days', null, null, null);
do $$ begin perform app.purge_expired(); end $$;
select is((select count(*)::int from app.dsr_requests where ref in ('ESKCEVAP', 'ESKBEKLE')), 0,
  'the daily purge removes requests 3 years after the answer (or the submission)');
select is((select count(*)::int from app.dsr_requests where ref = 'YAKCEVAP'), 1, 'a request answered 2 years ago stays');
select is((select count(*)::int from app.dsr_requests where ref = (select ref from ra)), 1, 'recent requests stay');
select ok(exists (select 1 from audit.destruction_log where category = 'dsr_requests' and rows_deleted = 2),
  'the purge is in the destruction log');
select throws_ok($$ delete from app.dsr_requests where ref = 'YAKCEVAP' $$, 'P0001', 'dsr_immutable',
  'outside the purge nothing is deleted');

select * from finish();
rollback;
