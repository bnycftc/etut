-- Etüt backend, step 7: fixes from the second review round (additive or CREATE OR REPLACE;
-- earlier migrations stay untouched).
--
--   1. Age band over time (K-17, K-22): the year a 15–17 band was declared is kept. 15–17 → 18+
--      is accepted from the next calendar year on (the earliest a 17-year-old can be 18); then
--      the parent links end by themselves. Before that the server refuses it, linked or not.
--   2. A parent lock (groups off, K-22 a) also stops the founder functions: new code, requests,
--      decisions, removing members, the group list. Leaving and revoking stay possible.
--   3. Removed and rejected people cannot ask again for 30 days; blocked people never; a
--      founder can block someone who only sent a request (K-08, K-28).
--   4. Sessions on the server keep no subject and no topic: nothing reads them (KVKK m.4/2-ç).
--      Offline timer sessions follow the same 7-day window as "elle" entries.
--   5. Name filter: "dershane" (K-27).

-- ---------------------------------------------------------------------------------------------
-- 1. Age band
-- ---------------------------------------------------------------------------------------------

create or replace function app.istanbul_year(p_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from app.istanbul_day(p_at))::integer
$$;

-- Year (Istanbul) in which the current band was declared. Only meaningful for '15_17'.
alter table app.profiles
  add column band_year smallint not null default extract(year from (now() at time zone 'Europe/Istanbul'))::smallint;
update app.profiles p set band_year = app.istanbul_year(p.created_at);

create or replace function public.save_profile(
  p_nickname text,
  p_exam_type text,
  p_yks_area text,
  p_age_band text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_name text := app.clean_name(p_nickname);
  v_year integer := app.istanbul_year(now());
  v_error text;
  v_old app.profiles;
  v_exists boolean;
  v_linked boolean;
  v_adult_now boolean := false;
begin
  -- K-16: no server account below 15 ('under_15', NULL, ...).
  if p_age_band is null or p_age_band not in ('15_17', '18_plus') then
    perform app.fail('under_15');
  end if;
  -- LGS is not a 15+ group profile (K-17, K-45).
  if p_exam_type is null or p_exam_type not in ('YKS', 'KPSS', 'DIGER')
     or (p_exam_type = 'YKS') <> (p_yks_area is not null)
     or (p_yks_area is not null and p_yks_area not in ('sayisal', 'esit_agirlik', 'sozel', 'dil')) then
    perform app.fail('invalid_input');
  end if;
  v_error := app.check_name(v_name, 'nickname');
  if v_error is not null then
    perform app.fail(v_error);
  end if;
  select * into v_old from app.profiles where user_id = v_me;
  v_exists := found;
  v_linked := exists (select 1 from app.parent_links l where l.child_id = v_me);
  -- K-17: 15–17 → 18+ only once the calendar allows it. The app derives the band from the birth
  -- year on the device (lower bound of the age), so a 15–17 declared in year Y is 18+ at the
  -- earliest in Y + 1. Earlier, nobody can drop out of the band (and out of a parent's view).
  if v_exists and v_old.age_band = '15_17' and p_age_band = '18_plus' then
    if v_year < v_old.band_year + 1 then
      perform app.fail(case when v_linked then 'parent_locked' else 'not_allowed' end);
    end if;
    v_adult_now := true;
  end if;
  if app.rate_count(v_me, 'profile_save', now() - interval '1 day') >= 20 then
    perform app.fail('rate_limited');
  end if;
  perform app.rate_record(v_me, 'profile_save');

  insert into app.profiles as p (user_id, nickname, exam_type, yks_area, age_band, band_year)
  values (v_me, v_name, p_exam_type, p_yks_area, p_age_band, v_year)
  on conflict (user_id) do update
    set nickname = excluded.nickname,
        exam_type = excluded.exam_type,
        yks_area = excluded.yks_area,
        age_band = excluded.age_band,
        -- The band's year changes only when the band does.
        band_year = case when p.age_band = excluded.age_band then p.band_year else excluded.band_year end,
        updated_at = now(),
        last_active_at = now();

  -- 18+: a parent has no more say (K-22 is for 15–17 only, KVKK m.5). The links, and with them
  -- the parents' settings, end; a code still waiting is dropped.
  if v_adult_now then
    delete from app.parent_links l where l.child_id = v_me;
    delete from app.parent_link_codes c where c.child_id = v_me;
    if v_linked then
      perform app.log('parent_links_ended_adult');
    end if;
  end if;
  perform app.log(case when not v_exists then 'profile_created' else 'profile_updated' end);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Founder functions under a parent lock (K-22 a, ek 4(20)(a))
-- ---------------------------------------------------------------------------------------------

create or replace function public.rotate_invite(p_group uuid)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_code text;
  v_expires timestamptz := now() + interval '72 hours';
begin
  perform app.require_groups_allowed(v_me);
  if app.require_member(p_group, v_me) <> 'owner' then
    perform app.fail('not_owner');
  end if;
  loop
    v_code := app.random_code();
    exit when not exists (select 1 from app.groups g where g.invite_code = v_code);
  end loop;
  update app.groups g set invite_code = v_code, invite_expires_at = v_expires where g.id = p_group;
  perform app.log('invite_rotated');
  return query select v_code, v_expires;
end
$$;

create or replace function public.list_join_requests(p_group uuid)
returns table (request_id uuid, nickname text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  perform app.require_groups_allowed(v_me);
  if app.require_member(p_group, v_me) <> 'owner' then
    perform app.fail('not_owner');
  end if;
  return query
    select r.id, p.nickname, r.created_at
      from app.join_requests r
      join app.profiles p on p.user_id = r.user_id
     where r.group_id = p_group and r.status = 'pending'
       and not app.blocked_between(v_me, r.user_id)
     order by r.created_at;
end
$$;

create or replace function public.decide_join_request(p_request uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_req app.join_requests;
begin
  perform app.require_groups_allowed(v_me);
  select * into v_req from app.join_requests r where r.id = p_request;
  if not found or not exists (
       select 1 from app.memberships m
        where m.group_id = v_req.group_id and m.user_id = v_me and m.role = 'owner') then
    perform app.fail('not_owner');
  end if;
  if v_req.status <> 'pending' then
    perform app.fail('not_pending');
  end if;
  if not p_approve then
    update app.join_requests r set status = 'rejected', decided_at = now() where r.id = p_request;
    perform app.log('join_rejected');
    return 'rejected';
  end if;
  if app.groups_locked(v_req.user_id) or app.blocked_between(v_me, v_req.user_id)
     or not exists (select 1 from app.profiles p where p.user_id = v_req.user_id) then
    update app.join_requests r set status = 'rejected', decided_at = now() where r.id = p_request;
    return 'not_allowed';
  end if;
  begin
    insert into app.memberships (group_id, user_id, role) values (v_req.group_id, v_req.user_id, 'member');
  exception when check_violation then
    -- K-05: member_count would exceed 30.
    return 'group_full';
  end;
  update app.join_requests r set status = 'approved', decided_at = now() where r.id = p_request;
  perform app.log('join_approved');
  return 'approved';
end
$$;

-- Founder removes a member (K-28). The removal is kept like a rejected request (30 days, the
-- retention of join requests), so the same code does not bring the person straight back.
create or replace function public.remove_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  perform app.require_groups_allowed(v_me);
  if app.require_member(p_group, v_me) <> 'owner' then
    perform app.fail('not_owner');
  end if;
  if p_user = v_me then
    perform app.fail('invalid_input');
  end if;
  delete from app.memberships m where m.group_id = p_group and m.user_id = p_user;
  if not found then
    perform app.fail('not_member');
  end if;
  insert into app.join_requests (group_id, user_id, status, decided_at)
  values (p_group, p_user, 'rejected', now());
  perform app.log('member_removed');
end
$$;

create or replace function public.my_groups()
returns table (
  group_id uuid,
  name text,
  role text,
  member_count integer,
  invite_code text,
  invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  perform app.require_groups_allowed(v_me);
  return query
    select g.id, g.name, m.role, g.member_count,
           case when m.role = 'owner' and g.invite_expires_at > now() then g.invite_code end,
           case when m.role = 'owner' and g.invite_expires_at > now() then g.invite_expires_at end
      from app.memberships m
      join app.groups g on g.id = m.group_id
     where m.user_id = v_me
    union all
    select g.id, g.name, 'pending'::text, g.member_count, null::text, null::timestamptz
      from app.join_requests r
      join app.groups g on g.id = r.group_id
     where r.user_id = v_me and r.status = 'pending'
     order by 2;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Asking again after a "no"
-- ---------------------------------------------------------------------------------------------

-- Returns 'requested' | 'already_member' | 'already_pending' | 'invalid_code' | 'group_full'
-- | 'rate_limited'. Someone the founder rejected or removed in the last 30 days, or who is
-- blocked either way with the founder, gets 'invalid_code' (nothing tells them why).
create or replace function public.request_join(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_code text := app.normalize_code(p_code);
  v_group app.groups;
  v_owner uuid;
begin
  perform app.require_groups_allowed(v_me);
  -- Brute-force guard: 10 wrong codes per hour.
  if app.rate_count(v_me, 'code_fail', now() - interval '1 hour') >= 10 then
    return 'rate_limited';
  end if;
  select * into v_group from app.groups g
   where g.invite_code = v_code and g.invite_expires_at > now();
  if not found then
    perform app.rate_record(v_me, 'code_fail');
    return 'invalid_code';
  end if;
  if exists (select 1 from app.memberships m where m.group_id = v_group.id and m.user_id = v_me) then
    return 'already_member';
  end if;
  if exists (select 1 from app.join_requests r
              where r.group_id = v_group.id and r.user_id = v_me and r.status = 'pending') then
    return 'already_pending';
  end if;
  select m.user_id into v_owner from app.memberships m where m.group_id = v_group.id and m.role = 'owner';
  if (v_owner is not null and app.blocked_between(v_me, v_owner))
     or exists (select 1 from app.join_requests r
                 where r.group_id = v_group.id and r.user_id = v_me and r.status = 'rejected'
                   and r.decided_at > now() - interval '30 days') then
    return 'invalid_code';
  end if;
  if v_group.member_count >= 30 then
    return 'group_full';
  end if;
  if app.rate_count(v_me, 'join_request', now() - interval '1 day') >= 10 then
    return 'rate_limited';
  end if;
  perform app.rate_record(v_me, 'join_request', v_group.id);
  insert into app.join_requests (group_id, user_id) values (v_group.id, v_me);
  perform app.log('join_requested');
  return 'requested';
end
$$;

-- People from the own groups, and people who asked to join a group the caller founded (their
-- requests stay 30 days), can be blocked. A pending request of the blocked person is rejected.
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  if p_user is null or p_user = v_me
     or not (app.shares_group(p_user) or exists (
       select 1 from app.join_requests r
         join app.memberships m on m.group_id = r.group_id and m.user_id = v_me and m.role = 'owner'
        where r.user_id = p_user)) then
    perform app.fail('invalid_input');
  end if;
  insert into app.blocks (blocker_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  update app.join_requests r set status = 'rejected', decided_at = now()
   where r.user_id = p_user and r.status = 'pending'
     and exists (select 1 from app.memberships m
                  where m.group_id = r.group_id and m.user_id = v_me and m.role = 'owner');
  perform app.log('user_blocked');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Sessions: no subject or topic on the server; 7-day window for offline uploads
-- ---------------------------------------------------------------------------------------------

alter table app.study_sessions alter column subject_id drop not null;
-- Rows stored before this step (append only, so the trigger is set aside for this one update).
alter table app.study_sessions disable trigger study_sessions_append_only;
update app.study_sessions set subject_id = null, topic_id = null
 where subject_id is not null or topic_id is not null;
alter table app.study_sessions enable trigger study_sessions_append_only;
-- Not stored any more, so nothing can store it by mistake either.
alter table app.study_sessions
  add constraint study_sessions_no_subject check (subject_id is null and topic_id is null);

-- Same rules as step 6, except: p_subject / p_topic are optional, must still be ids when given
-- (a client cannot use them as a text channel), and are not stored. Offline ("timer" without a
-- live heartbeat) and "elle" sessions are accepted for today and the 6 days before.
create or replace function public.submit_session(
  p_client_id uuid,
  p_subject text,
  p_topic text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_s integer,
  p_source text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_presence app.presence;
  v_live boolean;
  v_start timestamptz;
  v_end timestamptz;
  v_duration integer;
  v_verified boolean := false;
  v_overlap_count integer;
  v_overlap_end timestamptz;
  v_overlap_start timestamptz;
  v_split record;
  v_days date[] := '{}';
  v_allocs integer[] := '{}';
  v_inserted integer;
begin
  if p_client_id is null or p_source is null or p_source not in ('timer', 'manual')
     or (p_subject is not null and not app.valid_subject(p_subject)) or not app.valid_topic(p_topic)
     or p_duration_s is null or p_duration_s < 1
     or p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    return 'invalid';
  end if;
  -- The live status of this session ends with its upload, whatever the answer.
  delete from app.presence pr
   where pr.user_id = v_me and pr.session_client_id = p_client_id
  returning * into v_presence;
  v_live := found and p_source = 'timer' and v_presence.last_beat_at > now() - interval '6 minutes';

  if exists (select 1 from app.study_sessions s where s.user_id = v_me and s.client_id = p_client_id) then
    return 'duplicate';
  end if;
  if p_duration_s > 36000 then
    return 'too_long';
  end if;

  if v_live then
    v_start := v_presence.started_at;
    v_end := least(now(), greatest(v_presence.last_beat_at, v_start + make_interval(secs => p_duration_s)));
    v_duration := least(p_duration_s, floor(extract(epoch from (v_end - v_start)))::integer);
    -- More than 2 minutes the server did not see: keep the device times, unverified.
    v_verified := v_duration >= 1 and v_duration >= p_duration_s - 120;
  end if;
  if not v_verified then
    v_start := p_started_at;
    v_end := p_ended_at;
    v_duration := p_duration_s;
    if v_end > now() + interval '5 minutes' then
      return 'future';
    end if;
    if app.istanbul_day(v_start) < app.istanbul_day(now()) - 6 then
      return 'too_old';
    end if;
    if v_duration > extract(epoch from (v_end - v_start)) + 60 then
      return 'invalid';
    end if;
  end if;
  if v_end - v_start > interval '24 hours' then
    return 'too_long';
  end if;

  -- "Çakışma yok": an overlap of up to 2 minutes at the start with one earlier session is cut.
  select count(*), max(s.ended_at), min(s.started_at)
    into v_overlap_count, v_overlap_end, v_overlap_start
    from app.study_sessions s
   where s.user_id = v_me and tstzrange(s.started_at, s.ended_at, '[)') && tstzrange(v_start, v_end, '[)');
  if v_overlap_count > 0 then
    if v_overlap_count = 1 and v_overlap_start <= v_start
       and v_overlap_end <= v_start + interval '2 minutes' and v_overlap_end < v_end then
      v_start := v_overlap_end;
    else
      return 'overlap';
    end if;
  end if;
  v_duration := least(v_duration, floor(extract(epoch from (v_end - v_start)))::integer);
  if v_duration < 1 then
    return 'invalid';
  end if;

  for v_split in select * from app.split_days(v_start, v_end, v_duration) loop
    if coalesce((select t.seconds from app.daily_totals t where t.user_id = v_me and t.day = v_split.day), 0)
       + v_split.seconds > 57600 then
      return 'day_limit';
    end if;
    v_days := v_days || v_split.day;
    v_allocs := v_allocs || v_split.seconds;
  end loop;

  begin
    insert into app.study_sessions
      (user_id, client_id, subject_id, topic_id, started_at, ended_at, duration_s, source, verified)
    values (v_me, p_client_id, null, null, v_start, v_end, v_duration, p_source, v_verified)
    on conflict (user_id, client_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return 'duplicate';
    end if;
    for i in 1 .. coalesce(array_length(v_days, 1), 0) loop
      insert into app.daily_totals as t (user_id, day, seconds, verified_seconds, manual_seconds)
      values (v_me, v_days[i], v_allocs[i],
              case when v_verified then v_allocs[i] else 0 end,
              case when p_source = 'manual' then v_allocs[i] else 0 end)
      on conflict (user_id, day) do update
        set seconds = t.seconds + excluded.seconds,
            verified_seconds = t.verified_seconds + excluded.verified_seconds,
            manual_seconds = t.manual_seconds + excluded.manual_seconds;
    end loop;
  exception
    when exclusion_violation then
      return 'overlap';
    when check_violation then
      return 'day_limit';
  end;
  return 'accepted';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Name filter
-- ---------------------------------------------------------------------------------------------

-- "Kızılay Dershane", "Dershanem": names a place where the student can be found (K-27).
insert into app.banned_terms (term, match, suffixes, reason) values ('dershane', 'word', true, 'personal')
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- Grants (see step 6, section 12)
-- ---------------------------------------------------------------------------------------------

revoke all on function app.istanbul_year(timestamptz) from public, anon, authenticated;
revoke all on all functions in schema public from public, anon;
