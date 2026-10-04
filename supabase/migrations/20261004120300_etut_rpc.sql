-- Etüt backend, step 3b: the RPC functions the app calls (the only write path).
--
-- Every function: SECURITY DEFINER, `set search_path = ''`, fully qualified names, checks the
-- caller with auth.uid(). Errors are raised as P0001 with a short code in the message that the
-- app translates (src/sync/errors.ts). Functions whose failures must leave a trace (a wrong code
-- attempt has to count towards the rate limit even though nothing else happens) return a status
-- text instead of raising, because raising would roll the rate event back.

-- ---------------------------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------------------------

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
  v_error text;
  v_old app.profiles;
begin
  -- K-16: no server account below 15. The app never even signs in for an under-15 profile;
  -- this is the server-side refusal for any other value ('under_15', NULL, ...).
  if p_age_band is null or p_age_band not in ('15_17', '18_plus') then
    perform app.fail('under_15');
  end if;
  if p_exam_type is null or p_exam_type not in ('YKS', 'LGS', 'KPSS', 'DIGER')
     or (p_exam_type = 'YKS') <> (p_yks_area is not null)
     or (p_yks_area is not null and p_yks_area not in ('sayisal', 'esit_agirlik', 'sozel', 'dil')) then
    perform app.fail('invalid_input');
  end if;
  v_error := app.check_name(v_name, 'nickname');
  if v_error is not null then
    perform app.fail(v_error);
  end if;
  select * into v_old from app.profiles where user_id = v_me;
  -- K-17: while a parent is linked the student cannot declare themselves 18+.
  if found and v_old.age_band = '15_17' and p_age_band = '18_plus'
     and exists (select 1 from app.parent_links l where l.child_id = v_me) then
    perform app.fail('parent_locked');
  end if;
  if app.rate_count(v_me, 'profile_save', now() - interval '1 day') >= 20 then
    perform app.fail('rate_limited');
  end if;
  perform app.rate_record(v_me, 'profile_save');

  insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
  values (v_me, v_name, p_exam_type, p_yks_area, p_age_band)
  on conflict (user_id) do update
    set nickname = excluded.nickname,
        exam_type = excluded.exam_type,
        yks_area = excluded.yks_area,
        age_band = excluded.age_band,
        updated_at = now(),
        last_active_at = now();
  perform app.log(case when v_old.user_id is null then 'profile_created' else 'profile_updated' end);
end
$$;

-- The caller's own account view. No row = no profile yet.
create or replace function public.get_me()
returns table (
  nickname text,
  exam_type text,
  yks_area text,
  age_band text,
  invisible boolean,
  reactions_enabled boolean,
  groups_disabled boolean,
  force_invisible boolean,
  daily_limit_minutes integer,
  parent_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  update app.profiles p set last_active_at = now()
   where p.user_id = v_me and p.last_active_at < now() - interval '1 day';
  return query
    select p.nickname, p.exam_type, p.yks_area, p.age_band,
           app.effective_invisible(p.user_id), p.reactions_enabled,
           coalesce(c.groups_disabled, false), coalesce(c.force_invisible, false),
           c.daily_limit_minutes,
           (select count(*)::integer from app.parent_links l where l.child_id = v_me)
      from app.profiles p
      left join app.parent_controls c on c.child_id = p.user_id
     where p.user_id = v_me;
end
$$;

-- NULL leaves a setting unchanged.
create or replace function public.set_preferences(p_invisible boolean, p_reactions_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  if p_invisible = false and coalesce(
       (select c.force_invisible from app.parent_controls c where c.child_id = v_me), false) then
    perform app.fail('parent_locked');
  end if;
  update app.profiles p
     set invisible = coalesce(p_invisible, p.invisible),
         reactions_enabled = coalesce(p_reactions_enabled, p.reactions_enabled),
         updated_at = now()
   where p.user_id = v_me;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Groups (K-03, K-04, K-05)
-- ---------------------------------------------------------------------------------------------

create or replace function public.create_group(p_name text)
returns table (group_id uuid, invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_name text := app.clean_name(p_name);
  v_error text;
  v_group uuid;
  v_code text;
  v_expires timestamptz := now() + interval '72 hours';
begin
  perform app.require_groups_allowed(v_me);
  v_error := app.check_name(v_name, 'group');
  if v_error is not null then
    perform app.fail(v_error);
  end if;
  if app.rate_count(v_me, 'group_create', now() - interval '1 day') >= 3 then
    perform app.fail('rate_limited');
  end if;
  perform app.rate_record(v_me, 'group_create');
  loop
    v_code := app.random_code();
    exit when not exists (select 1 from app.groups g where g.invite_code = v_code);
  end loop;
  insert into app.groups (name, invite_code, invite_expires_at)
  values (v_name, v_code, v_expires)
  returning id into v_group;
  insert into app.memberships (group_id, user_id, role) values (v_group, v_me, 'owner');
  perform app.log('group_created');
  return query select v_group, v_code, v_expires;
end
$$;

-- Founder: new 72-hour code (the old one stops working at once).
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

-- Founder: cancel the code (K-03).
create or replace function public.revoke_invite(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  if app.require_member(p_group, v_me) <> 'owner' then
    perform app.fail('not_owner');
  end if;
  update app.groups g set invite_code = null, invite_expires_at = null where g.id = p_group;
  perform app.log('invite_revoked');
end
$$;

-- Ask to join with a code. Never adds a member by itself: the founder decides (K-03).
-- Returns 'requested' | 'already_member' | 'already_pending' | 'invalid_code' | 'group_full'
--         | 'rate_limited'. Expired, revoked and unknown codes all give 'invalid_code'.
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

-- Founder: pending requests (requests from people the founder blocked are not shown).
create or replace function public.list_join_requests(p_group uuid)
returns table (request_id uuid, nickname text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  if app.require_member(p_group, v_me) <> 'owner' then
    perform app.fail('not_owner');
  end if;
  return query
    select r.id, p.nickname, r.created_at
      from app.join_requests r
      join app.profiles p on p.user_id = r.user_id
     where r.group_id = p_group and r.status = 'pending'
       and not exists (select 1 from app.blocks b where b.blocker_id = v_me and b.blocked_id = r.user_id)
     order by r.created_at;
end
$$;

-- Founder: approve or reject. Returns 'approved' | 'rejected' | 'group_full' | 'not_allowed'.
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
  if app.groups_locked(v_req.user_id)
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

create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  perform app.require_member(p_group, v_me);
  -- The membership trigger hands the group to the longest-standing member, or removes an empty one.
  delete from app.memberships m where m.group_id = p_group and m.user_id = v_me;
  perform app.log('group_left');
end
$$;

-- Founder removes a member (K-28).
create or replace function public.remove_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
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
  perform app.log('member_removed');
end
$$;

-- The caller's groups and pending requests. The code is shown to the founder only.
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

-- Members of one of the caller's groups with their live status (K-12: only to the own groups;
-- invisible members never show as studying). Hidden: members whose parent turned groups off and
-- people the caller blocked.
create or replace function public.group_board(p_group uuid)
returns table (
  user_id uuid,
  nickname text,
  is_me boolean,
  role text,
  studying boolean,
  paused boolean,
  subject_id text,
  started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  perform app.require_groups_allowed(v_me);
  perform app.require_member(p_group, v_me);
  return query
    with live as (
      select m.user_id, m.role, p.nickname,
             (pr.user_id is not null and pr.last_beat_at > now() - interval '7 minutes'
              and (m.user_id = v_me or not app.effective_invisible(m.user_id))) as on_now,
             pr.paused, pr.subject_id, pr.started_at
        from app.memberships m
        join app.profiles p on p.user_id = m.user_id
        left join app.presence pr on pr.user_id = m.user_id
       where m.group_id = p_group
         and (m.user_id = v_me or not app.groups_locked(m.user_id))
         and not exists (select 1 from app.blocks b where b.blocker_id = v_me and b.blocked_id = m.user_id)
    )
    select l.user_id, l.nickname, l.user_id = v_me, l.role, l.on_now,
           case when l.on_now then l.paused end,
           case when l.on_now then l.subject_id end,
           case when l.on_now then l.started_at end
      from live l
     order by l.on_now desc, l.nickname;
end
$$;

-- Group ranking for today or this week (Istanbul), from the pg_cron cache. Only current members
-- appear (K-06: there is no ranking outside a group).
create or replace function public.group_leaderboard(p_group uuid, p_period text)
returns table (
  rank integer,
  user_id uuid,
  nickname text,
  is_me boolean,
  seconds integer,
  manual_seconds integer,
  computed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_today date := app.istanbul_day(now());
  v_start date;
begin
  perform app.require_groups_allowed(v_me);
  perform app.require_member(p_group, v_me);
  if p_period = 'day' then
    v_start := v_today;
  elsif p_period = 'week' then
    v_start := app.week_start(v_today);
  else
    perform app.fail('invalid_input');
  end if;
  return query
    select (rank() over (order by coalesce(c.seconds, 0) desc))::integer,
           m.user_id, p.nickname, m.user_id = v_me,
           coalesce(c.seconds, 0), coalesce(c.manual_seconds, 0), c.computed_at
      from app.memberships m
      join app.profiles p on p.user_id = m.user_id
      left join app.leaderboard_cache c
        on c.group_id = m.group_id and c.user_id = m.user_id
       and c.period = p_period and c.period_start = v_start
     where m.group_id = p_group
       and (m.user_id = v_me or not app.groups_locked(m.user_id))
       and not exists (select 1 from app.blocks b where b.blocker_id = v_me and b.blocked_id = m.user_id)
     order by 1, p.nickname;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Live status heartbeat: one row per user, updated in place (not inserted) every 5 minutes.
-- Returns 'ok' | 'throttled' | 'ignored' (parent turned groups off).
-- ---------------------------------------------------------------------------------------------

create or replace function public.beat(p_session uuid, p_subject text, p_paused boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_row app.presence;
begin
  if p_session is null or p_subject is null or char_length(p_subject) not between 1 and 40 then
    perform app.fail('invalid_input');
  end if;
  if app.groups_locked(v_me) then
    delete from app.presence pr where pr.user_id = v_me;
    return 'ignored';
  end if;
  select * into v_row from app.presence pr where pr.user_id = v_me;
  if found and v_row.session_client_id = p_session then
    if v_row.last_beat_at > now() - interval '30 seconds' and v_row.paused = coalesce(p_paused, false) then
      return 'throttled';
    end if;
    update app.presence pr
       set last_beat_at = now(), paused = coalesce(p_paused, false), subject_id = p_subject
     where pr.user_id = v_me;
  else
    -- New session (or none yet): the server clock marks the start.
    insert into app.presence (user_id, session_client_id, subject_id, paused)
    values (v_me, p_session, p_subject, coalesce(p_paused, false))
    on conflict (user_id) do update
      set session_client_id = excluded.session_client_id,
          subject_id = excluded.subject_id,
          paused = excluded.paused,
          started_at = now(),
          last_beat_at = now();
  end if;
  return 'ok';
end
$$;

create or replace function public.end_presence(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from app.presence pr
   where pr.user_id = app.me() and (p_session is null or pr.session_client_id = p_session);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Study sessions: append only, idempotent by the client's uuid (outbox may retry any time).
-- Returns 'accepted' | 'duplicate' (both mean "done" for the outbox) or a permanent refusal:
--   'invalid' | 'too_long' (one session > 10 h or span > 24 h) | 'day_limit' (> 16 h a day)
--   | 'overlap' | 'future' | 'too_old'
-- Times: when the server saw the session live (heartbeat with this uuid, last beat ≤ 6 min ago)
-- the start is the server's first-beat time and the end is now: `verified`. Otherwise
-- (offline, invisible without beats, manual) the device times are kept and the session is
-- marked unverified. 'manual' sessions are always unverified and carry the "elle" label.
-- ---------------------------------------------------------------------------------------------

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
  v_start timestamptz;
  v_end timestamptz;
  v_duration integer;
  v_verified boolean := false;
  v_span numeric;
  v_overlap_count integer;
  v_overlap_end timestamptz;
  v_overlap_start timestamptz;
  v_day date;
  v_last_day date;
  v_day_start timestamptz;
  v_part numeric;
  v_alloc integer;
  v_left integer;
  v_days date[] := '{}';
  v_allocs integer[] := '{}';
  v_inserted integer;
begin
  if p_client_id is null or p_source is null or p_source not in ('timer', 'manual')
     or p_subject is null or char_length(p_subject) not between 1 and 40
     or (p_topic is not null and char_length(p_topic) > 80)
     or p_duration_s is null or p_duration_s < 1
     or p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    return 'invalid';
  end if;
  if exists (select 1 from app.study_sessions s where s.user_id = v_me and s.client_id = p_client_id) then
    return 'duplicate';
  end if;
  if p_duration_s > 36000 then
    return 'too_long';
  end if;

  select * into v_presence from app.presence pr
   where pr.user_id = v_me and pr.session_client_id = p_client_id;
  if p_source = 'timer' and found and v_presence.last_beat_at > now() - interval '6 minutes' then
    v_start := v_presence.started_at;
    v_end := now();
    v_verified := true;
    -- The device clock is not trusted: the duration cannot exceed what the server observed.
    v_duration := least(p_duration_s, floor(extract(epoch from (v_end - v_start)))::integer);
  else
    v_start := p_started_at;
    v_end := p_ended_at;
    v_duration := p_duration_s;
    if v_end > now() + interval '5 minutes' then
      return 'future';
    end if;
    if (p_source = 'manual' and app.istanbul_day(v_start) < app.istanbul_day(now()) - 6)
       or (p_source = 'timer' and v_start < now() - interval '30 days') then
      return 'too_old';
    end if;
    if v_duration > extract(epoch from (v_end - v_start)) + 60 then
      return 'invalid';
    end if;
  end if;
  if v_end - v_start > interval '24 hours' then
    return 'too_long';
  end if;

  -- "Çakışma yok". Clock differences between the device and the server can make two back to back
  -- sessions touch: an overlap of up to 2 minutes at the start with one earlier session is cut.
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
  v_span := extract(epoch from (v_end - v_start));
  v_duration := least(v_duration, floor(v_span)::integer);
  if v_duration < 1 then
    return 'invalid';
  end if;

  -- Split the duration over the Istanbul days the session touches, in proportion to wall time.
  v_day := app.istanbul_day(v_start);
  v_last_day := app.istanbul_day(v_end - interval '1 microsecond');
  v_left := v_duration;
  while v_day <= v_last_day loop
    v_day_start := app.istanbul_midnight(v_day);
    if v_day = v_last_day then
      v_alloc := v_left;
    else
      v_part := extract(epoch from (least(v_end, v_day_start + interval '1 day') - greatest(v_start, v_day_start)));
      v_alloc := round(v_duration * v_part / v_span)::integer;
      v_alloc := least(v_alloc, v_left);
    end if;
    if coalesce((select t.seconds from app.daily_totals t where t.user_id = v_me and t.day = v_day), 0)
       + v_alloc > 57600 then
      return 'day_limit';
    end if;
    v_days := v_days || v_day;
    v_allocs := v_allocs || v_alloc;
    v_left := v_left - v_alloc;
    v_day := v_day + 1;
  end loop;

  begin
    insert into app.study_sessions
      (user_id, client_id, subject_id, topic_id, started_at, ended_at, duration_s, source, verified)
    values (v_me, p_client_id, p_subject, p_topic, v_start, v_end, v_duration, p_source, v_verified)
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
  if v_verified then
    delete from app.presence pr where pr.user_id = v_me and pr.session_client_id = p_client_id;
  end if;
  return 'accepted';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Ready-made reactions (K-07, K-08)
-- Returns 'sent' | 'limit' | 'not_allowed' | 'invalid'.
-- ---------------------------------------------------------------------------------------------

create or replace function public.send_reaction(p_group uuid, p_to uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_today timestamptz := app.istanbul_midnight(app.istanbul_day(now()));
begin
  if p_kind is null or p_kind not in ('tebrik', 'hadi', 'helal', 'basarilar') or p_to is null or p_to = v_me then
    return 'invalid';
  end if;
  perform app.require_groups_allowed(v_me);
  perform app.require_member(p_group, v_me);
  if not exists (select 1 from app.memberships m where m.group_id = p_group and m.user_id = p_to)
     or app.groups_locked(p_to)
     or app.blocked_between(v_me, p_to)
     or not coalesce((select p.reactions_enabled from app.profiles p where p.user_id = p_to), false) then
    return 'not_allowed';
  end if;
  -- K-08: at most 3 a day to the same person, 30 a day in total.
  if app.rate_count(v_me, 'reaction', v_today, p_to) >= 3
     or app.rate_count(v_me, 'reaction', v_today) >= 30 then
    return 'limit';
  end if;
  perform app.rate_record(v_me, 'reaction', p_to);
  insert into app.reactions (group_id, from_user, to_user, kind) values (p_group, v_me, p_to, p_kind);
  perform app.log('reaction_sent');
  return 'sent';
end
$$;

-- The caller's new reactions, each shown once (K-07: only the recipient ever sees them and there
-- is no counter). Reactions from people the caller blocked are dropped.
create or replace function public.take_reactions()
returns table (id uuid, kind text, from_nickname text, group_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  return query
    with taken as (
      update app.reactions r set delivered_at = now()
       where r.to_user = v_me and r.delivered_at is null
      returning r.id, r.kind, r.from_user, r.group_id, r.created_at
    )
    select t.id, t.kind, p.nickname, g.name, t.created_at
      from taken t
      join app.profiles p on p.user_id = t.from_user
      join app.groups g on g.id = t.group_id
     where not app.groups_locked(v_me)
       and not exists (select 1 from app.blocks b where b.blocker_id = v_me and b.blocked_id = t.from_user)
     order by t.created_at desc
     limit 20;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Report and block (K-28). Returns 'reported' | 'rate_limited' | 'invalid'.
-- ---------------------------------------------------------------------------------------------

create or replace function public.report(p_target uuid, p_group uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  if p_reason is null or p_reason not in ('nickname', 'group_name', 'harassment', 'danger', 'other')
     or (p_target is null and p_group is null) or p_target = v_me then
    return 'invalid';
  end if;
  -- Only what the caller can see: members of their own groups, or their own groups' names.
  if p_group is not null and not app.is_member(p_group) then
    return 'invalid';
  end if;
  if p_target is not null and not app.shares_group(p_target) then
    return 'invalid';
  end if;
  if app.rate_count(v_me, 'report', now() - interval '1 day') >= 10 then
    return 'rate_limited';
  end if;
  perform app.rate_record(v_me, 'report');
  insert into app.reports (reporter_id, target_user_id, group_id, reason)
  values (v_me, p_target, p_group, p_reason);
  perform app.log('report_filed');
  return 'reported';
end
$$;

create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  if p_user is null or p_user = v_me or not app.shares_group(p_user) then
    perform app.fail('invalid_input');
  end if;
  insert into app.blocks (blocker_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  perform app.log('user_blocked');
end
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from app.blocks b where b.blocker_id = app.me() and b.blocked_id = p_user;
end
$$;

create or replace function public.my_blocks()
returns table (user_id uuid, nickname text)
language sql
security definer
set search_path = ''
as $$
  select b.blocked_id, p.nickname
    from app.blocks b
    join app.profiles p on p.user_id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by p.nickname
$$;

-- ---------------------------------------------------------------------------------------------
-- Parent link (K-22). Purchase approval (K-22 b, K-24) is left to the stores' family features.
-- ---------------------------------------------------------------------------------------------

-- Student (15–17 only): a code valid for 10 minutes, shown on the student's own screen.
create or replace function public.create_parent_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile app.profiles := app.require_profile();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_profile.age_band <> '15_17' then
    perform app.fail('not_allowed');
  end if;
  if (select count(*) from app.parent_links l where l.child_id = v_profile.user_id) >= 2 then
    perform app.fail('parent_limit');
  end if;
  loop
    v_code := app.random_code();
    exit when not exists (select 1 from app.parent_link_codes c where c.code = v_code);
  end loop;
  insert into app.parent_link_codes (child_id, code, expires_at)
  values (v_profile.user_id, v_code, v_expires)
  on conflict (child_id) do update set code = excluded.code, expires_at = excluded.expires_at;
  return query select v_code, v_expires;
end
$$;

-- Parent device: enter the code. Returns status 'linked' | 'invalid_code' | 'rate_limited'
-- | 'not_allowed' (the caller has a 15–17 student profile) | 'parent_limit'.
create or replace function public.claim_parent_code(p_code text)
returns table (status text, child_id uuid, child_nickname text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_row app.parent_link_codes;
begin
  if exists (select 1 from app.profiles p where p.user_id = v_me and p.age_band = '15_17') then
    return query select 'not_allowed'::text, null::uuid, null::text;
    return;
  end if;
  if app.rate_count(v_me, 'parent_code_fail', now() - interval '1 hour') >= 10 then
    return query select 'rate_limited'::text, null::uuid, null::text;
    return;
  end if;
  select * into v_row from app.parent_link_codes c
   where c.code = app.normalize_code(p_code) and c.expires_at > now() and c.child_id <> v_me;
  if not found then
    perform app.rate_record(v_me, 'parent_code_fail');
    return query select 'invalid_code'::text, null::uuid, null::text;
    return;
  end if;
  if (select count(*) from app.parent_links l where l.child_id = v_row.child_id and l.parent_id <> v_me) >= 2 then
    return query select 'parent_limit'::text, null::uuid, null::text;
    return;
  end if;
  insert into app.parent_links (child_id, parent_id) values (v_row.child_id, v_me) on conflict do nothing;
  insert into app.parent_controls (child_id, updated_by) values (v_row.child_id, v_me) on conflict do nothing;
  delete from app.parent_link_codes c where c.child_id = v_row.child_id;
  perform app.log('parent_linked');
  return query
    select 'linked'::text, v_row.child_id, p.nickname from app.profiles p where p.user_id = v_row.child_id;
end
$$;

create or replace function public.parent_children()
returns table (
  child_id uuid,
  nickname text,
  groups_disabled boolean,
  force_invisible boolean,
  daily_limit_minutes integer,
  linked_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select l.child_id, p.nickname, coalesce(c.groups_disabled, false), coalesce(c.force_invisible, false),
         c.daily_limit_minutes, l.created_at
    from app.parent_links l
    join app.profiles p on p.user_id = l.child_id
    left join app.parent_controls c on c.child_id = l.child_id
   where l.parent_id = auth.uid()
   order by l.created_at
$$;

-- Parent: settings locks and daily limit (K-22 a, c). NULL limit = no limit.
create or replace function public.parent_set_controls(
  p_child uuid,
  p_groups_disabled boolean,
  p_force_invisible boolean,
  p_daily_limit_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  if not app.is_parent_of(p_child) then
    perform app.fail('not_parent');
  end if;
  if p_daily_limit_minutes is not null and p_daily_limit_minutes not between 15 and 600 then
    perform app.fail('invalid_input');
  end if;
  insert into app.parent_controls as c (child_id, groups_disabled, force_invisible, daily_limit_minutes, updated_by)
  values (p_child, coalesce(p_groups_disabled, false), coalesce(p_force_invisible, false), p_daily_limit_minutes, v_me)
  on conflict (child_id) do update
    set groups_disabled = excluded.groups_disabled,
        force_invisible = excluded.force_invisible,
        daily_limit_minutes = excluded.daily_limit_minutes,
        updated_at = now(),
        updated_by = v_me;
  if coalesce(p_groups_disabled, false) then
    delete from app.presence pr where pr.user_id = p_child;
  end if;
  perform app.log('parent_controls_changed');
end
$$;

-- Parent: study time of the last 7 Istanbul days (K-22 c). Only totals, nothing about groups.
create or replace function public.parent_weekly_summary(p_child uuid)
returns table (day date, seconds integer, manual_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := app.istanbul_day(now());
begin
  perform app.me();
  if not app.is_parent_of(p_child) then
    perform app.fail('not_parent');
  end if;
  return query
    select d::date, coalesce(t.seconds, 0), coalesce(t.manual_seconds, 0)
      from generate_series(v_today - 6, v_today, interval '1 day') d
      left join app.daily_totals t on t.user_id = p_child and t.day = d::date
     order by 1;
end
$$;

create or replace function public.parent_unlink(p_child uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  delete from app.parent_links l where l.child_id = p_child and l.parent_id = v_me;
  if not found then
    perform app.fail('not_parent');
  end if;
  if not exists (select 1 from app.parent_links l where l.child_id = p_child) then
    delete from app.parent_controls c where c.child_id = p_child;
  end if;
  perform app.log('parent_unlinked');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Account deletion (KVKK m.7, K-37, Apple 5.1.1(v)). Deleting the auth user cascades to every
-- table in `app`; group ownership moves on through the membership trigger; reports keep only the
-- anonymous record. The audit trail (5651) is the documented exception and keeps the account id.
-- ---------------------------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  perform app.log('account_deleted', v_me);
  -- Other people's rate-limit rows that name this person (reactions sent to them).
  delete from app.rate_events e where e.subject = v_me;
  delete from auth.users u where u.id = v_me;
  insert into audit.destruction_log (category, rows_deleted, method)
  values ('account_on_request', 1, 'delete cascade');
end
$$;
