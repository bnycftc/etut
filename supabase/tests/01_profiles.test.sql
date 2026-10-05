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

do $$ begin perform tests.new_user('11111111-0000-0000-0000-000000000001'); end $$; -- U1
do $$ begin perform tests.new_user('11111111-0000-0000-0000-000000000002'); end $$; -- U2

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
-- No false positives: the -(y)arak suffix, words joined across spaces, prefixes.
select is(app.check_name('Okuyarak Kazan', 'group'), null, 'no false positive: okuyarak');
select is(app.check_name('Planlayarak Calis', 'group'), null, 'no false positive: planlayarak');
select is(app.check_name('Tekrarlayarak', 'group'), null, 'no false positive: tekrarlayarak');
select is(app.check_name('Anlayarak Öğren', 'group'), null, 'no false positive: anlayarak');
select is(app.check_name('Hazırlayarak', 'nickname'), null, 'no false positive: hazırlayarak');
select is(app.check_name('Sakal Takımı', 'group'), null, 'no false positive across words: sakal takımı');
select is(app.check_name('Ekibin Stajı', 'group'), null, 'no false positive across words: ekibin stajı');
select is(app.check_name('Dickens', 'nickname'), null, 'no false positive: Dickens');
select is(app.check_name('Sık Çalış', 'group'), null, 'no false positive: sık');
select is(app.check_name('Sıkışık Program', 'group'), null, 'no false positive: sıkışık');
select is(app.check_name('Amin Ali', 'nickname'), null, 'no false positive across words: amin ali');
select is(app.check_name('Fen Takımı', 'group'), null, 'no false positive: fen');
select is(app.check_name('Lise Sınavı', 'group'), null, 'no false positive: lise sınavı');
select is(app.check_name('Gece Etüdü', 'group'), null, 'no false positive: etüdü');
select is(app.check_name('Kilise Yolu', 'group'), null, 'no false positive: kilise is not Kilis');
select is(app.check_name('Karşı Takım', 'group'), null, 'no false positive: karşı is not Kars');
select is(app.check_name('Sırt Çantası', 'group'), null, 'no false positive: sırt is not Siirt');
select is(app.check_name('Yalnız Kurt', 'nickname'), null, 'an everyday word as the last word is fine');
-- Dotless ı spellings and two-word forms.
select is(app.check_name('amına koyim', 'nickname'), 'name_banned', 'dotless ı: amına');
select is(app.check_name('amınakoyim', 'nickname'), 'name_banned', 'dotless ı: amınakoyim');
select is(app.check_name('Amcık Ekip', 'group'), 'name_banned', 'dotless ı: amcık');
select is(app.check_name('s ı k e r ı m', 'nickname'), 'name_banned', 'dotless ı, spaced');
select is(app.check_name('ı b n e', 'nickname'), 'name_banned', 'dotless ı, short root spaced');
select is(app.check_name('Piç Kurusu', 'nickname'), 'name_banned', 'two-word profanity');
select is(app.check_name('Yarrak', 'nickname'), 'name_banned', 'yarak is still refused as a word');
-- Capitals typed on an English keyboard: ASCII I becomes ı, which is folded back to i.
select is(app.check_name('AMCIK', 'nickname'), 'name_banned', 'ASCII capitals: AMCIK');
select is(app.check_name('Amına', 'nickname'), 'name_banned', 'dotless ı, capitalised');
select is(app.check_name('IBNE', 'nickname'), 'name_banned', 'ASCII capitals: IBNE');
select is(app.check_name('Ibne', 'nickname'), 'name_banned', 'ASCII capital I: Ibne');
select is(app.check_name('PIÇ', 'nickname'), 'name_banned', 'ASCII capitals: PIÇ');
select is(app.check_name('SIKTIR GIT', 'group'), 'name_banned', 'ASCII capitals: SIKTIR GIT');
select is(app.check_name('SEREFSIZ', 'group'), 'name_banned', 'ASCII capitals: SEREFSIZ');
select is(app.check_name('FAHISE', 'group'), 'name_banned', 'ASCII capitals: FAHISE');
select is(app.check_name('SIKERIM', 'group'), 'name_banned', 'ASCII capitals: SIKERIM');
select is(app.check_name('Şerefsız', 'group'), 'name_banned', 'mixed ı/i spelling');
select is(app.check_name('SIKI CALISAN', 'nickname'), null, 'no false positive in capitals: SIKI');
select is(app.check_name('SIKINTI YOK', 'nickname'), null, 'no false positive in capitals: SIKINTI');
-- K-27: school, province, real name, social media.
select is(app.check_name('Kadıköy Anadolu Lisesi', 'group'), 'name_personal', 'school name');
select is(app.check_name('Ankara Fen Lisesi 12A', 'group'), 'name_personal', 'school name with class');
select is(app.check_name('Bornova Koleji 11-B', 'group'), 'name_personal', 'college name');
select is(app.check_name('Kadıköy İmam Hatip', 'group'), 'name_personal', 'school type across words');
select is(app.check_name('Izmirli Ekip', 'group'), 'name_personal', 'province with a suffix');
select is(app.check_name('Siirt Grubu', 'group'), 'name_personal', 'province with a double letter');
select is(app.check_name('Elif Kaya Izmir', 'nickname'), 'name_personal', 'province in a nickname');
select is(app.check_name('Ahmet Yılmaz', 'nickname'), 'name_personal', 'first name + common surname');
select is(app.check_name('ig ahmet.yilmaz', 'nickname'), 'name_personal', 'ig handle');
select is(app.check_name('Tik Tok Ekibi', 'group'), 'name_personal', 'platform name across words');
select is(app.check_name('kizilay dershane', 'group'), 'name_personal', 'a dershane');
select is(app.check_name('Izmir Koleji YKS', 'group'), 'name_personal', 'college in capitals');

call tests.act_as('11111111-0000-0000-0000-000000000001');
select throws_ok($$ select public.save_profile('0r0spu', 'YKS', 'sayisal', '15_17') $$,
  'P0001', 'name_banned', 'save_profile applies the filter');
select is((select nickname from public.get_me()), 'Gece Kuşu', 'refused change kept the old nickname');
-- K-17: a 15-17 band declared this year cannot become 18+ this year (the earliest a 17-year-old
-- is 18 is next year), with or without a parent.
select throws_ok($$ select public.save_profile('Gece Kuşu', 'YKS', 'sayisal', '18_plus') $$,
  'P0001', 'not_allowed', '15-17 cannot declare 18+ in the same year');
select is((select age_band from public.get_me()), '15_17', 'the band stays');
reset role;
update app.profiles set band_year = band_year - 1 where user_id = '11111111-0000-0000-0000-000000000001';
call tests.act_as('11111111-0000-0000-0000-000000000001');
select lives_ok($$ select public.save_profile('  Gece   Kuşu  ', 'KPSS', null, '18_plus') $$,
  'whitespace is normalised; a year later the band can be raised');
select is((select nickname || '/' || age_band from public.get_me()), 'Gece Kuşu/18_plus', 'stored in canonical form, 18+');
select lives_ok($$ select public.save_profile('Gece Kuşu', 'KPSS', null, '15_17') $$, 'lowering the band is always allowed');
select throws_ok($$ select public.save_profile('Gece Kuşu', 'KPSS', null, '18_plus') $$,
  'P0001', 'not_allowed', 'and a lowered band counts from this year again');
-- LGS candidates are typically 13-14: not a group profile (K-17 lower age wins, K-45).
select throws_ok($$ select public.save_profile('Sekizinci', 'LGS', null, '15_17') $$,
  'P0001', 'invalid_input', 'LGS is not accepted for a group profile');
-- The exam type is checked but not stored: nothing on the server reads it (KVKK m.4/2-ç).
select is((select exam_type from public.get_me()), null, 'the exam type is not stored');
reset role;
select is((select count(*)::int from app.profiles where exam_type is not null or yks_area is not null), 0,
  'no profile keeps an exam type or YKS area');

select * from finish();
rollback;
