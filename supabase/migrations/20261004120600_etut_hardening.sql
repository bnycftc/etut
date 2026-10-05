-- Etüt backend, step 6: fixes from the first review round (no data exists yet, but earlier
-- migrations stay untouched; everything here is additive or CREATE OR REPLACE).
--
--   1. Subjects are a fixed list (the live status must not become a free-text channel, K-09).
--   2. Live status only for people in a group (KVKK m.4); presence ends with every upload.
--   3. submit_session: a verified session ends when the server last saw it, not when it was sent
--      (late outbox retries no longer push the end into the next session); when the server saw
--      only part of a session (first beats lost) it is kept unverified instead of being cut.
--      Own sessions can be deleted one by one (KVKK m.7, kvkk/08 #4).
--   4. take_reactions marks as delivered only what it returns.
--   5. Blocking hides both people from each other's board and ranking (K-08).
--   6. Ranking shows the unverified timer part next to the "elle" part.
--   7. Name filter: fewer false positives (-yarak, words joined across spaces, "Dickens"),
--      dotless ı spellings, school / city / "Ad Soyad" patterns (K-26, K-27).
--   8. LGS is not a 15+ group profile (K-17, K-45).
--   9. Parent controls per parent: the strictest setting of all linked parents wins, so a second
--      "parent" cannot loosen the first one's locks, and controls end with the last link.
--  10. Parent accounts follow the inactivity purge; GoTrue's own audit table is purged/cleaned.
--  11. Moderation: reports get a decision and an operator function to close them.
--  12. Future functions in public are not executable by PUBLIC/anon by default.

-- ---------------------------------------------------------------------------------------------
-- 1. Subjects (same ids as src/domain/subjects.ts SUBJECTS_BY_EXAM; a Jest test compares them)
-- ---------------------------------------------------------------------------------------------

create table app.subjects (
  id text primary key check (id ~ '^[a-z_]{1,40}$')
);
insert into app.subjects (id) values
  ('matematik'), ('geometri'), ('turkce'), ('edebiyat'), ('fizik'), ('kimya'), ('biyoloji'),
  ('tarih'), ('cografya'), ('felsefe'), ('din'), ('yabanci_dil'), ('fen'), ('inkilap'),
  ('vatandaslik'), ('guncel'), ('egitim_bilimleri'), ('genel'), ('diger');
alter table app.subjects enable row level security;
revoke all on app.subjects from public, anon, authenticated;

alter table app.presence
  add constraint presence_subject_known foreign key (subject_id) references app.subjects (id);
alter table app.study_sessions
  add constraint study_sessions_subject_known foreign key (subject_id) references app.subjects (id);

create or replace function app.valid_subject(p_subject text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_subject is not null and exists (select 1 from app.subjects s where s.id = p_subject)
$$;

-- Topic ids of the built-in curriculum (`tyt.matematik.problemler`); never shown to others.
create or replace function app.valid_topic(p_topic text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_topic is null or p_topic ~ '^[a-z0-9._-]{1,80}$'
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Heartbeat
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
  if p_session is null or not app.valid_subject(p_subject) then
    perform app.fail('invalid_input');
  end if;
  -- Nobody would see it: the parent turned groups off, or the user is in no group yet.
  if app.groups_locked(v_me)
     or not exists (select 1 from app.memberships m where m.user_id = v_me) then
    delete from app.presence pr where pr.user_id = v_me;
    return 'ignored';
  end if;
  select * into v_row from app.presence pr where pr.user_id = v_me;
  if found and v_row.session_client_id = p_session then
    if v_row.last_beat_at > now() - interval '30 seconds' and v_row.paused = coalesce(p_paused, false)
       and v_row.subject_id = p_subject then
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

-- ---------------------------------------------------------------------------------------------
-- 3. Sessions
-- ---------------------------------------------------------------------------------------------

-- Seconds of a session per Istanbul day, in proportion to wall time (the last day takes the
-- rest). Deterministic, so deleting a session subtracts exactly what storing it added.
create or replace function app.split_days(p_start timestamptz, p_end timestamptz, p_duration integer)
returns table (day date, seconds integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := app.istanbul_day(p_start);
  v_last date := app.istanbul_day(p_end - interval '1 microsecond');
  v_span numeric := extract(epoch from (p_end - p_start));
  v_left integer := p_duration;
  v_alloc integer;
  v_day_start timestamptz;
begin
  while v_day <= v_last loop
    v_day_start := app.istanbul_midnight(v_day);
    if v_day = v_last then
      v_alloc := v_left;
    else
      v_alloc := least(v_left, round(p_duration * extract(epoch from (
        least(p_end, v_day_start + interval '1 day') - greatest(p_start, v_day_start))) / v_span)::integer);
    end if;
    day := v_day;
    seconds := v_alloc;
    return next;
    v_left := v_left - v_alloc;
    v_day := v_day + 1;
  end loop;
end
$$;

-- Returns 'accepted' | 'duplicate' or a permanent refusal: 'invalid' | 'too_long' | 'day_limit'
-- | 'overlap' | 'future' | 'too_old'.
-- Verified: the server saw the session live (heartbeat with this uuid, last beat ≤ 6 min ago)
-- and observed (nearly) all of it. Start = server's first-beat time; end = the later of the last
-- beat and start + active time, never after now. Otherwise the device times are kept and the
-- session is unverified (offline, invisible, first beats lost, manual).
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
     or not app.valid_subject(p_subject) or not app.valid_topic(p_topic)
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
    -- More than 2 minutes the server did not see: keep the device times, unverified (instead
    -- of cutting an honest session whose first beats were lost).
    v_verified := v_duration >= 1 and v_duration >= p_duration_s - 120;
  end if;
  if not v_verified then
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
  return 'accepted';
end
$$;

-- The owner deletes one of their sessions (e.g. an "elle" entry removed on the device).
-- Returns 'deleted' | 'not_found'. The ranking cache follows with the next refresh (≤ 5 min).
create or replace function public.delete_session(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_session app.study_sessions;
  v_split record;
begin
  delete from app.study_sessions s
   where s.user_id = v_me and s.client_id = p_client_id
  returning * into v_session;
  if not found then
    return 'not_found';
  end if;
  for v_split in select * from app.split_days(v_session.started_at, v_session.ended_at, v_session.duration_s) loop
    update app.daily_totals t
       set seconds = greatest(0, t.seconds - v_split.seconds),
           verified_seconds = greatest(0, t.verified_seconds - case when v_session.verified then v_split.seconds else 0 end),
           manual_seconds = greatest(0, t.manual_seconds - case when v_session.source = 'manual' then v_split.seconds else 0 end)
     where t.user_id = v_me and t.day = v_split.day;
  end loop;
  delete from app.daily_totals t where t.user_id = v_me and t.seconds = 0;
  perform app.log('session_deleted');
  return 'deleted';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Reactions: the newest 20 are shown and marked; the rest wait for the next time.
-- ---------------------------------------------------------------------------------------------

create or replace function public.take_reactions()
returns table (id uuid, kind text, from_nickname text, group_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  -- Dropped unseen: everything while a parent turned groups off, and reactions from people the
  -- caller blocked.
  update app.reactions r set delivered_at = now()
   where r.to_user = v_me and r.delivered_at is null
     and (app.groups_locked(v_me)
          or exists (select 1 from app.blocks b where b.blocker_id = v_me and b.blocked_id = r.from_user));
  return query
    with picked as (
      select r.id as reaction_id
        from app.reactions r
       where r.to_user = v_me and r.delivered_at is null
       order by r.created_at desc
       limit 20
    ), taken as (
      update app.reactions r set delivered_at = now()
        from picked
       where r.id = picked.reaction_id
      returning r.id, r.kind, r.from_user, r.group_id, r.created_at
    )
    select t.id, t.kind, p.nickname, g.name, t.created_at
      from taken t
      join app.profiles p on p.user_id = t.from_user
      join app.groups g on g.id = t.group_id
     order by t.created_at desc;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5–6. Board and ranking: blocks hide both ways; unverified timer time is shown separately.
-- ---------------------------------------------------------------------------------------------

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
         and (m.user_id = v_me or not app.blocked_between(v_me, m.user_id))
    )
    select l.user_id, l.nickname, l.user_id = v_me, l.role, l.on_now,
           case when l.on_now then l.paused end,
           case when l.on_now then l.subject_id end,
           case when l.on_now then l.started_at end
      from live l
     order by l.on_now desc, l.nickname;
end
$$;

alter table app.leaderboard_cache
  add column unverified_seconds integer not null default 0 check (unverified_seconds >= 0);
grant select (unverified_seconds) on app.leaderboard_cache to authenticated;

create or replace function app.refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := app.istanbul_day(now());
  v_week date := app.week_start(app.istanbul_day(now()));
begin
  delete from app.leaderboard_cache c
   where not ((c.period = 'day' and c.period_start = v_today)
           or (c.period = 'week' and c.period_start = v_week));

  insert into app.leaderboard_cache as c
    (group_id, period, period_start, user_id, rank, seconds, manual_seconds, unverified_seconds, computed_at)
  select w.group_id, w.period, w.period_start, w.user_id,
         rank() over (partition by w.group_id, w.period order by w.seconds desc),
         w.seconds, w.manual_seconds, w.unverified_seconds, now()
    from (
      select m.group_id, p.period, p.period_start, m.user_id,
             coalesce(sum(t.seconds), 0)::integer as seconds,
             coalesce(sum(t.manual_seconds), 0)::integer as manual_seconds,
             -- Timer time the server did not see live (offline, invisible): labelled like "elle".
             coalesce(sum(greatest(0, t.seconds - t.verified_seconds - t.manual_seconds)), 0)::integer
               as unverified_seconds
        from app.memberships m
        cross join (values ('day', v_today), ('week', v_week)) as p (period, period_start)
        left join app.daily_totals t
          on t.user_id = m.user_id and t.day between p.period_start and v_today
       where not app.groups_locked(m.user_id)
       group by m.group_id, p.period, p.period_start, m.user_id
    ) w
  on conflict (group_id, period, period_start, user_id) do update
    set rank = excluded.rank, seconds = excluded.seconds, manual_seconds = excluded.manual_seconds,
        unverified_seconds = excluded.unverified_seconds, computed_at = excluded.computed_at;

  -- Left or locked between refreshes: never shown.
  delete from app.leaderboard_cache c
   where app.groups_locked(c.user_id)
      or not exists (select 1 from app.memberships m where m.group_id = c.group_id and m.user_id = c.user_id);
end
$$;

drop function public.group_leaderboard(uuid, text);
create function public.group_leaderboard(p_group uuid, p_period text)
returns table (
  rank integer,
  user_id uuid,
  nickname text,
  is_me boolean,
  seconds integer,
  manual_seconds integer,
  unverified_seconds integer,
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
           coalesce(c.seconds, 0), coalesce(c.manual_seconds, 0), coalesce(c.unverified_seconds, 0),
           c.computed_at
      from app.memberships m
      join app.profiles p on p.user_id = m.user_id
      left join app.leaderboard_cache c
        on c.group_id = m.group_id and c.user_id = m.user_id
       and c.period = p_period and c.period_start = v_start
     where m.group_id = p_group
       and (m.user_id = v_me or not app.groups_locked(m.user_id))
       and (m.user_id = v_me or not app.blocked_between(v_me, m.user_id))
     order by 1, p.nickname;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Name filter
-- ---------------------------------------------------------------------------------------------

-- fold   : also matched against the form where dotless ı is folded to i ("amcık" = "amcik").
--          Off for the "sik" roots only, so "sık", "sıkı", "sıkış", "sıkım" stay allowed.
-- across : may also match written across spaces ("o r o s p u", "İmam Hatip"); off where a
--          following word often starts the same ("Lise Sınavı" ≠ "lisesi").
-- reason : 'banned' (profanity) or 'personal' (social media, school, city: K-27).
alter table app.banned_terms
  add column fold boolean not null default true,
  add column across boolean not null default true,
  add column reason text not null default 'banned' check (reason in ('banned', 'personal'));

-- -(y)arak is a common Turkish suffix ("Okuyarak", "Planlayarak"): only as a word start.
update app.banned_terms set match = 'word', suffixes = true where term = 'yarak';
-- "Dickens".
update app.banned_terms set suffixes = false where term = 'dick';
update app.banned_terms set fold = false where term in ('sik', 'sikim', 'sikik', 'sikis');

insert into app.banned_terms (term, match, suffixes, reason) values
  -- Social media names (were matched over the whole joined name: "Ekibin Stajı" → "insta").
  ('instagram', 'word', true, 'personal'),
  ('insta', 'word', true, 'personal'),
  ('ig', 'word', false, 'personal'),
  ('tiktok', 'word', true, 'personal'),
  ('snapchat', 'word', true, 'personal'),
  ('discord', 'word', true, 'personal'),
  ('whatsap', 'word', true, 'personal'),
  ('telegram', 'word', true, 'personal'),
  ('twiter', 'word', true, 'personal'),
  ('youtube', 'word', true, 'personal'),
  ('facebok', 'word', true, 'personal'),
  ('onlyfans', 'word', true, 'personal'),
  -- School names (K-27): the possessive forms name one school ("Kadıköy Anadolu Lisesi");
  -- plain "Lise", "Fen", "Anadolu" stay allowed ("Lise 3", "Fen Takımı").
  ('lisesi', 'part', false, 'personal'),
  ('kolej', 'word', true, 'personal'),
  ('koleji', 'part', false, 'personal'),
  ('okulu', 'part', false, 'personal'),
  ('ortaokul', 'part', false, 'personal'),
  ('ilkokul', 'part', false, 'personal'),
  ('dershanesi', 'part', false, 'personal'),
  ('imamhatip', 'part', false, 'personal'),
  ('etutmerkezi', 'part', false, 'personal'),
  -- Provinces (K-27). Left out because they are everyday words or names: Aydın, Batman, Ordu,
  -- Van. Exact word only where a longer innocent word starts the same ("Kilise", "Karşı").
  ('adana', 'word', true, 'personal'), ('adiyaman', 'word', true, 'personal'),
  ('afyon', 'word', true, 'personal'), ('agri', 'word', false, 'personal'),
  ('aksaray', 'word', true, 'personal'), ('amasya', 'word', true, 'personal'),
  ('ankara', 'word', true, 'personal'), ('antalya', 'word', true, 'personal'),
  ('antep', 'word', true, 'personal'), ('ardahan', 'word', true, 'personal'),
  ('artvin', 'word', true, 'personal'), ('balikesir', 'word', true, 'personal'),
  ('bartin', 'word', true, 'personal'), ('bayburt', 'word', true, 'personal'),
  ('bilecik', 'word', true, 'personal'), ('bingol', 'word', true, 'personal'),
  ('bitlis', 'word', true, 'personal'), ('bolu', 'word', false, 'personal'),
  ('burdur', 'word', true, 'personal'), ('bursa', 'word', true, 'personal'),
  ('canakale', 'word', true, 'personal'), ('cankiri', 'word', true, 'personal'),
  ('corum', 'word', true, 'personal'), ('denizli', 'word', true, 'personal'),
  ('diyarbakir', 'word', true, 'personal'), ('duzce', 'word', true, 'personal'),
  ('edirne', 'word', true, 'personal'), ('elazig', 'word', true, 'personal'),
  ('erzincan', 'word', true, 'personal'), ('erzurum', 'word', true, 'personal'),
  ('eskisehir', 'word', true, 'personal'), ('gaziantep', 'word', true, 'personal'),
  ('giresun', 'word', true, 'personal'), ('gumushane', 'word', true, 'personal'),
  ('hakari', 'word', true, 'personal'), ('hatay', 'word', true, 'personal'),
  ('igdir', 'word', true, 'personal'), ('isparta', 'word', true, 'personal'),
  ('istanbul', 'word', true, 'personal'), ('izmir', 'word', true, 'personal'),
  ('kahramanmaras', 'word', true, 'personal'), ('maras', 'word', true, 'personal'),
  ('karabuk', 'word', true, 'personal'), ('karaman', 'word', false, 'personal'),
  ('kars', 'word', false, 'personal'), ('kastamonu', 'word', true, 'personal'),
  ('kayseri', 'word', true, 'personal'), ('kirikale', 'word', true, 'personal'),
  ('kirklareli', 'word', true, 'personal'), ('kirsehir', 'word', true, 'personal'),
  ('kilis', 'word', false, 'personal'), ('kocaeli', 'word', true, 'personal'),
  ('konya', 'word', true, 'personal'), ('kutahya', 'word', true, 'personal'),
  ('malatya', 'word', true, 'personal'), ('manisa', 'word', true, 'personal'),
  ('mardin', 'word', true, 'personal'), ('mersin', 'word', true, 'personal'),
  ('mugla', 'word', true, 'personal'), ('mus', 'word', false, 'personal'),
  ('nevsehir', 'word', true, 'personal'), ('nigde', 'word', true, 'personal'),
  ('osmaniye', 'word', true, 'personal'), ('rize', 'word', true, 'personal'),
  ('sakarya', 'word', true, 'personal'), ('samsun', 'word', true, 'personal'),
  ('sirt', 'word', true, 'personal'), ('sinop', 'word', true, 'personal'),
  ('sivas', 'word', true, 'personal'), ('sanliurfa', 'word', true, 'personal'),
  ('urfa', 'word', true, 'personal'), ('sirnak', 'word', true, 'personal'),
  ('tekirdag', 'word', true, 'personal'), ('tokat', 'word', false, 'personal'),
  ('trabzon', 'word', true, 'personal'), ('tunceli', 'word', true, 'personal'),
  ('usak', 'word', false, 'personal'), ('yalova', 'word', true, 'personal'),
  ('yozgat', 'word', true, 'personal'), ('zonguldak', 'word', true, 'personal');
-- Stored normalised (repeated letters collapsed): "Siirt" is 'sirt', which folded would also be
-- "sırt"; "Çanakkale" 'canakale', "Kırıkkale" 'kirikale', "Hakkari" 'hakari'.
update app.banned_terms set fold = false where term = 'sirt';
update app.banned_terms set across = false where term in ('lisesi', 'okulu', 'koleji', 'dershanesi');

-- "Ad Soyad" in a nickname: a last word that is one of the most common surnames (only those that
-- are not everyday words: "Kaya", "Demir", "Yıldız", "Kurt" … stay allowed).
create table app.common_surnames (
  term text primary key check (term ~ '^[a-z]+$')
);
insert into app.common_surnames (term) values
  ('yilmaz'), ('ozturk'), ('ozdemir'), ('yildirim'), ('arslan'), ('cetin'), ('ozkan'), ('simsek'),
  ('polat'), ('ozcan'), ('korkmaz'), ('cakir'), ('erdogan'), ('aktas'), ('yalcin'), ('bozkurt'),
  ('unal'), ('ozer'), ('turan');
alter table app.common_surnames enable row level security;
revoke all on app.common_surnames from public, anon, authenticated;

-- Does a term occur in the word list? 'part': inside a word; 'word': a whole word, or a word
-- start when `suffixes`. With `p_across`, written across spaces or dots ("o r o s p u", "amına
-- koyim"), a term also matches when it starts at a word start and runs on into the next words;
-- a 'word' term must then end exactly at a word end ("s i k"), so "Amin Ali" is not "amina…".
-- (Joining the whole name instead blocked "Sakal Takımı" for "kaltak".)
create or replace function app.term_hit(p_words text[], p_term text, p_match text, p_suffixes boolean, p_across boolean)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  n integer := coalesce(array_length(p_words, 1), 0);
  v_len integer := char_length(p_term);
  v_word text;
  v_concat text;
begin
  for i in 1 .. n loop
    v_word := p_words[i];
    if p_match = 'part' then
      if position(p_term in v_word) > 0 then
        return true;
      end if;
    elsif v_word = p_term or (p_suffixes and left(v_word, v_len) = p_term) then
      return true;
    end if;
    continue when not p_across;
    v_concat := v_word;
    for j in i + 1 .. n loop
      exit when char_length(v_concat) >= v_len;
      v_concat := v_concat || p_words[j];
      if (p_match = 'part' and left(v_concat, v_len) = p_term) or (p_match = 'word' and v_concat = p_term) then
        return true;
      end if;
    end loop;
  end loop;
  return false;
end
$$;

-- Returns NULL when the name is acceptable, otherwise 'name_length' | 'name_chars' |
-- 'name_personal' | 'name_banned'. p_kind: 'nickname' (3–20 characters) or 'group' (3–24).
create or replace function app.check_name(p_text text, p_kind text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text := app.clean_name(p_text);
  v_max integer := case when p_kind = 'group' then 24 else 20 end;
  v_norm text;
  v_words text[];
  v_folded text[];
  v_term record;
begin
  if char_length(v_text) < 3 or char_length(v_text) > v_max then
    return 'name_length';
  end if;
  -- Letters (Turkish included), digits, space and . _ - only: no emoji, no symbols (K-26).
  if v_text !~ '^[A-Za-z0-9çğıöşüâîûÇĞİÖŞÜÂÎÛ ._-]+$' then
    return 'name_chars';
  end if;
  -- Phone numbers (7+ digits in total). '@' never passes the character check above.
  if char_length(regexp_replace(v_text, '[^0-9]', '', 'g')) >= 7 then
    return 'name_personal';
  end if;
  if v_text !~ '[A-Za-zçğıöşüâîûÇĞİÖŞÜÂÎÛ]' then
    return 'name_chars';
  end if;
  v_norm := app.normalize_name(v_text);
  if lower(v_text) ~ '(www|https?)' or v_norm ~ '\.(com|net|org|tr|io|me|app|gg|ly|co)\M' then
    return 'name_personal';
  end if;
  -- A birth year in a nickname reveals the age (K-20); allowed in group names ("YKS 2027").
  if p_kind = 'nickname' and v_text ~ '(19[4-9][0-9]|20[0-2][0-9])' then
    return 'name_personal';
  end if;

  v_words := array_remove(regexp_split_to_array(v_norm, '[^a-zı]+'), '');
  v_folded := array_remove(regexp_split_to_array(translate(v_norm, 'ı', 'i'), '[^a-z]+'), '');
  if p_kind = 'nickname' and exists (
    select 1 from app.reserved_names r where r.term = any (v_words) or r.term = any (v_folded)
  ) then
    return 'name_banned';
  end if;

  for v_term in
    select t.term, t.match, t.suffixes, t.fold, t.across, t.reason from app.banned_terms t
     order by t.reason = 'personal', t.term
  loop
    if app.term_hit(v_words, v_term.term, v_term.match, v_term.suffixes, v_term.across)
       or (v_term.fold and app.term_hit(v_folded, v_term.term, v_term.match, v_term.suffixes, v_term.across)) then
      return 'name_' || v_term.reason;
    end if;
  end loop;

  if p_kind = 'nickname' and coalesce(array_length(v_folded, 1), 0) >= 2
     and exists (select 1 from app.common_surnames s where s.term = v_folded[array_length(v_folded, 1)]) then
    return 'name_personal';
  end if;
  return null;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Profile: LGS candidates are typically 13–14 (K-17: the lower age wins; K-45).
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

-- ---------------------------------------------------------------------------------------------
-- 9. Parent controls per parent (K-22 a, c). The student's effective controls are the
--    strictest of all linked parents; a link that goes away (unlink, account deletion, purge)
--    takes its controls with it.
-- ---------------------------------------------------------------------------------------------

alter table app.parent_links
  add column groups_disabled boolean not null default false,
  add column force_invisible boolean not null default false,
  add column daily_limit_minutes integer check (daily_limit_minutes between 15 and 600),
  add column controls_updated_at timestamptz,
  -- The parent's own last use (inactivity purge of parent accounts, kvkk/09 §7).
  add column parent_active_at timestamptz not null default now();

update app.parent_links l
   set groups_disabled = c.groups_disabled,
       force_invisible = c.force_invisible,
       daily_limit_minutes = c.daily_limit_minutes,
       controls_updated_at = c.updated_at
  from app.parent_controls c
 where c.child_id = l.child_id;

drop table app.parent_controls;

-- Same name and columns as the former table, so every reader (get_me, set_preferences,
-- groups_locked, effective_invisible) keeps working. Not readable by clients.
create view app.parent_controls as
  select l.child_id,
         bool_or(l.groups_disabled) as groups_disabled,
         bool_or(l.force_invisible) as force_invisible,
         min(l.daily_limit_minutes) as daily_limit_minutes,
         max(l.controls_updated_at) as updated_at
    from app.parent_links l
   group by l.child_id;
revoke all on app.parent_controls from public, anon, authenticated;

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
  delete from app.parent_link_codes c where c.child_id = v_row.child_id;
  perform app.log('parent_linked');
  return query
    select 'linked'::text, v_row.child_id, p.nickname from app.profiles p where p.user_id = v_row.child_id;
end
$$;

-- The parent's own settings per student, and how many other parents are linked (so a second,
-- unknown "parent" account is visible to the first one).
drop function public.parent_children();
create function public.parent_children()
returns table (
  child_id uuid,
  nickname text,
  groups_disabled boolean,
  force_invisible boolean,
  daily_limit_minutes integer,
  linked_at timestamptz,
  other_parents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  update app.parent_links l set parent_active_at = now()
   where l.parent_id = v_me and l.parent_active_at < now() - interval '1 day';
  return query
    select l.child_id, p.nickname, l.groups_disabled, l.force_invisible, l.daily_limit_minutes, l.created_at,
           (select count(*)::integer from app.parent_links o where o.child_id = l.child_id and o.parent_id <> v_me)
      from app.parent_links l
      join app.profiles p on p.user_id = l.child_id
     where l.parent_id = v_me
     order by l.created_at;
end
$$;

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
  update app.parent_links l
     set groups_disabled = coalesce(p_groups_disabled, false),
         force_invisible = coalesce(p_force_invisible, false),
         daily_limit_minutes = p_daily_limit_minutes,
         controls_updated_at = now(),
         parent_active_at = now()
   where l.child_id = p_child and l.parent_id = v_me;
  if app.groups_locked(p_child) then
    delete from app.presence pr where pr.user_id = p_child;
  end if;
  perform app.log('parent_controls_changed');
end
$$;

create or replace function public.parent_weekly_summary(p_child uuid)
returns table (day date, seconds integer, manual_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_today date := app.istanbul_day(now());
begin
  if not app.is_parent_of(p_child) then
    perform app.fail('not_parent');
  end if;
  update app.parent_links l set parent_active_at = now()
   where l.child_id = p_child and l.parent_id = v_me and l.parent_active_at < now() - interval '1 day';
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
  -- The controls live on the link and go with it.
  delete from app.parent_links l where l.child_id = p_child and l.parent_id = v_me;
  if not found then
    perform app.fail('not_parent');
  end if;
  perform app.log('parent_unlinked');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 10. Account deletion and retention
-- ---------------------------------------------------------------------------------------------

-- GoTrue's own audit table (auth.audit_log_entries: account id, IP, e-mail if linked) is off in
-- production (GOTRUE_AUDIT_LOG_DISABLE_POSTGRES, infra/supabase/docker-compose.override.yml).
-- Where it is written anyway (local stack, a missed setting) the account's rows go with the
-- account and nothing stays longer than audit.* (395 days).
create or replace function app.purge_auth_audit(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
begin
  if to_regclass('auth.audit_log_entries') is null then
    return 0;
  end if;
  begin
    if p_user is null then
      execute 'delete from auth.audit_log_entries where created_at < now() - interval ''395 days''';
    else
      execute 'delete from auth.audit_log_entries where payload ->> ''actor_id'' = $1' using p_user::text;
    end if;
    get diagnostics n = row_count;
  exception when others then
    raise warning 'auth.audit_log_entries not purged: %', sqlerrm;
  end;
  return n;
end
$$;

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
  perform app.purge_auth_audit(v_me);
  delete from auth.users u where u.id = v_me;
  insert into audit.destruction_log (category, rows_deleted, method)
  values ('account_on_request', 1, 'delete cascade');
end
$$;

create or replace function app.purge_expired()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from app.presence where last_beat_at < now() - interval '1 hour';
  get diagnostics n = row_count; perform app.log_destruction('presence', n, 'delete');

  delete from app.parent_link_codes where expires_at < now();
  get diagnostics n = row_count; perform app.log_destruction('parent_link_codes', n, 'delete');

  update app.groups set invite_code = null, invite_expires_at = null where invite_expires_at < now();

  delete from app.rate_events where at < now() - interval '2 days';
  get diagnostics n = row_count; perform app.log_destruction('rate_events', n, 'delete');

  -- Ready-made reactions: 90 days (kvkk/09 §7), no counter is kept.
  delete from app.reactions where created_at < now() - interval '90 days';
  get diagnostics n = row_count; perform app.log_destruction('reactions', n, 'delete');

  delete from app.join_requests
   where (status <> 'pending' and decided_at < now() - interval '30 days')
      or (status = 'pending' and created_at < now() - interval '30 days');
  get diagnostics n = row_count; perform app.log_destruction('join_requests', n, 'delete');

  -- Moderation records: 2 years after closing (kvkk/09 §7).
  delete from app.reports where status = 'closed' and closed_at < now() - interval '2 years';
  get diagnostics n = row_count; perform app.log_destruction('reports', n, 'delete');

  -- Signed-in users that never got a profile (and are not a linked parent): after 1 day.
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '1 day'
     and not exists (select 1 from app.profiles p where p.user_id = u.id)
     and not exists (select 1 from app.parent_links l where l.parent_id = u.id);
  get diagnostics n = row_count; perform app.log_destruction('accounts_without_profile', n, 'delete cascade');

  -- Unused accounts (kvkk/09 §7): anonymous 6 months, linked to Apple/Google 24 months.
  delete from auth.users u
   using app.profiles p
   where p.user_id = u.id
     and ((u.is_anonymous and p.last_active_at < now() - interval '6 months')
       or (not u.is_anonymous and p.last_active_at < now() - interval '24 months'));
  get diagnostics n = row_count; perform app.log_destruction('inactive_accounts', n, 'delete cascade');

  -- Parent accounts (no profile of their own): the same rule, by the parent's last use.
  delete from auth.users u
   where not exists (select 1 from app.profiles p where p.user_id = u.id)
     and exists (select 1 from app.parent_links l where l.parent_id = u.id)
     and not exists (
       select 1 from app.parent_links l
        where l.parent_id = u.id
          and l.parent_active_at >= now() - case when u.is_anonymous then interval '6 months'
                                                 else interval '24 months' end);
  get diagnostics n = row_count; perform app.log_destruction('inactive_parent_accounts', n, 'delete cascade');

  n := app.purge_auth_audit(null);
  perform app.log_destruction('auth_audit_log', n, 'delete');

  -- Traffic/audit records: 1 year + 30 days (5651 m.5/3: at least 1, at most 2 years).
  perform set_config('etut.purge', 'on', true);
  delete from audit.events where at < now() - interval '395 days';
  get diagnostics n = row_count; perform app.log_destruction('audit_events', n, 'delete');
  delete from audit.ip_events where at < now() - interval '395 days';
  get diagnostics n = row_count; perform app.log_destruction('audit_ip_events', n, 'delete');
  -- Destruction log itself: 3 years (Silme Yönetmeliği m.7/3).
  delete from audit.destruction_log where at < now() - interval '3 years';
  perform set_config('etut.purge', 'off', true);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 11. Moderation: the operator closes a report with a decision (Studio / psql over SSH only).
-- ---------------------------------------------------------------------------------------------

alter table app.reports
  add column decision text check (decision in
    ('no_action', 'name_changed', 'member_removed', 'account_removed', 'reported_to_authorities'));

create or replace function app.close_report(p_report uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_decision is null then
    raise exception 'a decision is required';
  end if;
  update app.reports r
     set status = 'closed', closed_at = now(), decision = p_decision
   where r.id = p_report and r.status = 'open';
  if not found then
    raise exception 'report % is not open', p_report;
  end if;
  insert into audit.events (user_id, action) values (null, 'report_closed:' || p_decision);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 12. Grants. PostgreSQL gives EXECUTE to PUBLIC on every new function by a *global* default
--     that `alter default privileges in schema public …` (step 4) cannot remove, and a global
--     revoke would also strip extensions created later (pgTAP, pgcrypto). So the rule is: every
--     migration that creates a function ends with the revoke below and grants its RPCs to
--     `authenticated` explicitly. supabase/tests/00_schema.test.sql fails if one is missed.
-- ---------------------------------------------------------------------------------------------

revoke all on function app.valid_subject(text) from public, anon, authenticated;
revoke all on function app.valid_topic(text) from public, anon, authenticated;
revoke all on function app.split_days(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function app.term_hit(text[], text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function app.purge_auth_audit(uuid) from public, anon, authenticated;
revoke all on function app.close_report(uuid, text) from public, anon, authenticated;

revoke all on all functions in schema public from public, anon;
grant execute on function public.group_leaderboard(uuid, text) to authenticated;
grant execute on function public.parent_children() to authenticated;
grant execute on function public.delete_session(uuid) to authenticated;
