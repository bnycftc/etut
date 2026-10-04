-- Profiles: 15+ only (K-16), age never shown (K-20), nickname filter (K-26, K-27).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.new_user(p_id uuid) returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now())
  returning id
$$;
create procedure tests.act_as(p_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
grant execute on procedure tests.act_as(uuid) to authenticated;

select tests.new_user('11111111-0000-0000-0000-000000000001') is not null as setup; -- U1
select tests.new_user('11111111-0000-0000-0000-000000000002') is not null as setup; -- U2

-- ---------------------------------------------------------------- under 15 refused (K-16)
call tests.act_as('11111111-0000-0000-0000-000000000001');
select throws_ok($$ select public.save_profile('Deneme', 'YKS', 'sayisal', 'under_15') $$,
  'P0001', 'under_15', 'under-15 declaration cannot open a server account');
select throws_ok($$ select public.save_profile('Deneme', 'YKS', 'sayisal', null) $$,
  'P0001', 'under_15', 'a missing age band is refused like under 15');
select is((select count(*)::int from public.get_me()), 0, 'no profile was created');
select throws_ok($$ select public.save_profile('Deneme', 'YKS', null, '15_17') $$,
  'P0001', 'invalid_input', 'YKS requires an area');
select lives_ok($$ select public.save_profile('Gece Kuşu', 'YKS', 'sayisal', '15_17') $$,
  '15-17 profile is accepted');
select is((select age_band from public.get_me()), '15_17', 'own age band is visible to the owner via get_me');
select is((select invisible from public.get_me()), false, 'visible by default');

-- K-20: no direct read of the age band, not even the own one.
select throws_ok($$ select age_band from app.profiles $$, '42501', null,
  'age_band column is not readable');
select is((select count(*)::int from app.profiles), 1, 'own profile row is readable (nickname)');
-- Clients cannot write tables directly.
select throws_ok($$ insert into app.profiles (user_id, nickname, exam_type, age_band)
  values ('11111111-0000-0000-0000-000000000001', 'x', 'YKS', '18_plus') $$, '42501', null,
  'direct insert is denied');
select throws_ok($$ update app.profiles set nickname = 'Yeni Ad' $$, '42501', null,
  'direct update is denied');

-- Another user without a shared group sees nothing.
reset role;
call tests.act_as('11111111-0000-0000-0000-000000000002');
select is((select count(*)::int from app.profiles), 0, 'a stranger cannot read the profile');
select throws_ok($$ select * from public.my_groups() $$, 'P0001', 'no_profile',
  'group functions need a profile');

-- anon (not signed in) cannot call anything.
reset role;
set local role anon;
select throws_ok($$ select public.save_profile('Deneme', 'YKS', 'sayisal', '18_plus') $$, '42501', null,
  'anon cannot execute RPCs');
reset role;

-- ---------------------------------------------------------------- name filter (K-26, K-27)
select is(app.check_name('Gece Kuşu', 'nickname'), null, 'ordinary nickname passes');
select is(app.check_name('Sıkı Çalışan', 'nickname'), null, 'no false positive: sıkı');
select is(app.check_name('Sıkıntı Yok', 'nickname'), null, 'no false positive: sıkıntı');
select is(app.check_name('Seksen Net', 'nickname'), null, 'no false positive: seksen');
select is(app.check_name('Amine Ece', 'nickname'), null, 'no false positive across words');
select is(app.check_name('Al', 'nickname'), 'name_length', 'too short');
select is(app.check_name('Çok Uzun Bir Takma Adım', 'nickname'), 'name_length', 'over 20 characters');
select is(app.check_name('Bu Grup Adı Yirmi Dört Harfi Aşar', 'group'), 'name_length', 'group name over 24');
select is(app.check_name('Ali 😀', 'nickname'), 'name_chars', 'emoji is refused');
select is(app.check_name('ali@kaya', 'nickname'), 'name_chars', '@ handle is refused');
select is(app.check_name('0532 123 45 67', 'nickname'), 'name_personal', 'phone number is refused');
select is(app.check_name('ali.com', 'nickname'), 'name_personal', 'web address is refused');
select is(app.check_name('www ali', 'nickname'), 'name_personal', 'www is refused');
select is(app.check_name('insta alikaya', 'nickname'), 'name_personal', 'social media handle is refused');
select is(app.check_name('Ali2009', 'nickname'), 'name_personal', 'birth year in a nickname is refused (K-20)');
select is(app.check_name('YKS 2027 Sayısal', 'group'), null, 'a year is fine in a group name');
select is(app.check_name('orospu', 'nickname'), 'name_banned', 'profanity is refused');
select is(app.check_name('0r0spu', 'nickname'), 'name_banned', 'leet spelling is refused');
select is(app.check_name('o r o s p u', 'nickname'), 'name_banned', 'spaced spelling is refused');
select is(app.check_name('ORRROSPUUU', 'nickname'), 'name_banned', 'repeated letters are refused');
select is(app.check_name('Siktir Git', 'group'), 'name_banned', 'profanity in a group name');
select is(app.check_name('amk ekip', 'group'), 'name_banned', 'short root as a whole word');
select is(app.check_name('Admin', 'nickname'), 'name_banned', 'reserved nickname');
select is(app.check_name('Etüt Kampı', 'group'), null, 'app name is fine in a group name');

call tests.act_as('11111111-0000-0000-0000-000000000001');
select throws_ok($$ select public.save_profile('0r0spu', 'YKS', 'sayisal', '15_17') $$,
  'P0001', 'name_banned', 'save_profile applies the filter');
select is((select nickname from public.get_me()), 'Gece Kuşu', 'refused change kept the old nickname');
select lives_ok($$ select public.save_profile('  Gece   Kuşu  ', 'KPSS', null, '18_plus') $$,
  'whitespace is normalised, band can be raised without a parent link');
select is((select nickname from public.get_me()), 'Gece Kuşu', 'stored in canonical form');

select * from finish();
rollback;
