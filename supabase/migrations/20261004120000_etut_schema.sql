-- Etüt backend, step 1: schemas, tables, constraints, triggers.
--
-- Layout
--   app    : every table with personal data. NOT exposed through the Data API (config.toml
--            [api].schemas lists only public/graphql_public), RLS on every table.
--   audit  : 5651 traffic/audit records and the destruction log. No client access at all.
--   public : only the RPC functions the app calls (step 3). No tables.
--
-- Rules from docs/hukuk/03-tasarim-kurallari.md are referenced as K-xx.
-- Birth year never reaches the server: only the age band ('15_17' | '18_plus') is stored and an
-- under-15 declaration is refused (K-16, K-19, K-33).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists app;
create schema if not exists audit;
revoke all on schema app from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers that do not touch tables
-- ---------------------------------------------------------------------------------------------

-- Istanbul calendar day of a timestamp (Europe/Istanbul is UTC+3 all year, no DST since 2016).
create or replace function app.istanbul_day(p_at timestamptz)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (p_at at time zone 'Europe/Istanbul')::date
$$;

-- Monday of the ISO week that contains the given Istanbul day.
create or replace function app.week_start(p_day date)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (p_day - ((extract(isodow from p_day)::int) - 1))
$$;

-- ---------------------------------------------------------------------------------------------
-- Profiles (K-33: nickname, exam type/area, age band; no birth year, e-mail or phone)
-- ---------------------------------------------------------------------------------------------

create table app.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 20),
  exam_type text not null check (exam_type in ('YKS', 'LGS', 'KPSS', 'DIGER')),
  yks_area text check (yks_area in ('sayisal', 'esit_agirlik', 'sozel', 'dil')),
  -- "15+" flag: a row only exists for 15+; under 15 is refused by app.save_profile (K-16).
  age_band text not null check (age_band in ('15_17', '18_plus')),
  -- K-12 "görünmez çalış": hides the live status from the user's groups.
  invisible boolean not null default false,
  -- K-08: the recipient can turn reactions off.
  reactions_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Inactive accounts are purged (hukuk/kvkk/09 §7: 6 months unlinked, 24 months linked).
  last_active_at timestamptz not null default now(),
  constraint yks_area_only_for_yks check (exam_type = 'YKS' or yks_area is null)
);

-- ---------------------------------------------------------------------------------------------
-- Groups (K-03 invite code + founder approval, K-04 no listing/search, K-05 max 30 members)
-- ---------------------------------------------------------------------------------------------

create table app.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24),
  -- One active code per group; NULL = no code (revoked by the founder).
  invite_code text unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  invite_expires_at timestamptz,
  -- K-05: the 30-member limit is a database constraint, maintained by a trigger on memberships.
  member_count integer not null default 0 check (member_count between 0 and 30),
  created_at timestamptz not null default now(),
  constraint invite_code_has_expiry check ((invite_code is null) = (invite_expires_at is null))
);

create table app.memberships (
  group_id uuid not null references app.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index memberships_user_id on app.memberships (user_id);
create unique index memberships_one_owner on app.memberships (group_id) where role = 'owner';

create or replace function app.memberships_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- The row lock taken by this UPDATE serialises concurrent joins; the CHECK fails at 31.
    update app.groups set member_count = member_count + 1 where id = new.group_id;
    return new;
  elsif tg_op = 'DELETE' then
    update app.groups set member_count = member_count - 1 where id = old.group_id;
    -- The founder left, was deleted or deleted the account: the longest-standing member
    -- becomes the founder; a group without members is removed. This covers every deletion
    -- path (RPC, account deletion, admin deletion of an auth user, inactivity purge).
    if old.role = 'owner' then
      update app.memberships m
         set role = 'owner'
       where (m.group_id, m.user_id) = (
         select m2.group_id, m2.user_id
           from app.memberships m2
          where m2.group_id = old.group_id
          order by m2.joined_at, m2.user_id
          limit 1);
      if not found then
        delete from app.groups where id = old.group_id;
      end if;
    end if;
    return old;
  end if;
  return null;
end
$$;

create trigger memberships_count
after insert or delete on app.memberships
for each row execute function app.memberships_count();

create table app.join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references app.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index join_requests_one_pending on app.join_requests (group_id, user_id)
  where status = 'pending';
create index join_requests_user_id on app.join_requests (user_id);

-- ---------------------------------------------------------------------------------------------
-- Live status ("şu an çalışıyor"): one row per user, updated in place every 5 minutes.
-- ---------------------------------------------------------------------------------------------

create table app.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_client_id uuid not null,
  subject_id text not null check (char_length(subject_id) between 1 and 40),
  -- Server time of the first heartbeat of this session.
  started_at timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  paused boolean not null default false
);

-- ---------------------------------------------------------------------------------------------
-- Study sessions: append only, idempotent by the client's uuid.
-- ---------------------------------------------------------------------------------------------

create table app.study_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  subject_id text not null check (char_length(subject_id) between 1 and 40),
  topic_id text check (char_length(topic_id) <= 80),
  -- Server time when `verified`, otherwise the times the device reported.
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null check (duration_s between 1 and 36000),
  -- 'timer' or 'manual' (added afterwards, shown with the "elle" label everywhere).
  source text not null check (source in ('timer', 'manual')),
  -- true only when the server saw the session live (heartbeat) and it was submitted on time.
  verified boolean not null,
  received_at timestamptz not null default now(),
  -- Idempotency is per user, so nobody can block another user's uuid.
  unique (user_id, client_id),
  check (ended_at > started_at),
  check (ended_at - started_at <= interval '24 hours'),
  check (duration_s <= extract(epoch from (ended_at - started_at)) + 60),
  check (source = 'timer' or verified = false),
  -- "Çakışma yok": sessions of one user never overlap (database guarantee).
  constraint study_sessions_no_overlap exclude using gist (
    user_id with =,
    tstzrange(started_at, ended_at, '[)') with &&
  )
);

create or replace function app.reject_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only' using errcode = 'P0001';
end
$$;

create trigger study_sessions_append_only
before update on app.study_sessions
for each row execute function app.reject_update();

-- Daily totals per Istanbul day (K-06: used only inside groups, never globally).
create table app.daily_totals (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds between 0 and 57600), -- ≤ 16 hours
  verified_seconds integer not null default 0 check (verified_seconds >= 0),
  manual_seconds integer not null default 0 check (manual_seconds >= 0),
  primary key (user_id, day),
  check (verified_seconds + manual_seconds <= seconds)
);

-- Group leaderboard cache, refreshed by pg_cron (step 5). Only group scope exists (K-06).
create table app.leaderboard_cache (
  group_id uuid not null references app.groups (id) on delete cascade,
  period text not null check (period in ('day', 'week')),
  period_start date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  rank integer not null check (rank >= 1),
  seconds integer not null check (seconds >= 0),
  manual_seconds integer not null default 0 check (manual_seconds >= 0),
  computed_at timestamptz not null default now(),
  primary key (group_id, period, period_start, user_id)
);
create index leaderboard_cache_user_id on app.leaderboard_cache (user_id);

-- ---------------------------------------------------------------------------------------------
-- Ready-made reactions (K-07 recipient only, never a public counter; K-08 limits)
-- ---------------------------------------------------------------------------------------------

create table app.reactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references app.groups (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tebrik', 'hadi', 'helal', 'basarilar')),
  created_at timestamptz not null default now(),
  -- Set when the recipient's app has shown it once; purged after 90 days (kvkk/09 §7).
  delivered_at timestamptz,
  check (from_user <> to_user)
);
create index reactions_to_user on app.reactions (to_user) where delivered_at is null;
create index reactions_from_user on app.reactions (from_user);

-- ---------------------------------------------------------------------------------------------
-- Reports and blocks (K-28). Reports are moderation records (kvkk/09: 2 years after closing);
-- on account deletion the person reference is cleared, the anonymous record stays.
-- ---------------------------------------------------------------------------------------------

create table app.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  group_id uuid references app.groups (id) on delete set null,
  -- Fixed reasons, no free text (K-09). 'danger' = threat / self-harm risk (K-29 procedure).
  reason text not null check (reason in ('nickname', 'group_name', 'harassment', 'danger', 'other')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index reports_open on app.reports (created_at) where status = 'open';

create table app.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_id on app.blocks (blocked_id);

-- ---------------------------------------------------------------------------------------------
-- Parent link (K-22): the parent types the short-lived code shown on the student's screen into
-- the app on the parent's own device. No parent e-mail or phone.
-- ---------------------------------------------------------------------------------------------

create table app.parent_link_codes (
  child_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  expires_at timestamptz not null
);

create table app.parent_links (
  child_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_id, parent_id),
  check (child_id <> parent_id)
);
create index parent_links_parent_id on app.parent_links (parent_id);

create table app.parent_controls (
  child_id uuid primary key references auth.users (id) on delete cascade,
  -- (a) settings locks
  groups_disabled boolean not null default false,
  force_invisible boolean not null default false,
  -- (c) daily usage limit of the group module, minutes; NULL = no limit (enforced by the app)
  daily_limit_minutes integer check (daily_limit_minutes between 15 and 600),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------------------------
-- Rate limits (invite code attempts, join requests, reactions, reports, parent code attempts)
-- ---------------------------------------------------------------------------------------------

create table app.rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  subject uuid,
  at timestamptz not null default now()
);
create index rate_events_lookup on app.rate_events (user_id, kind, at);

-- ---------------------------------------------------------------------------------------------
-- Audit / traffic records (5651 m.5/3, hukuk/03 K-41; kvkk/09 "5651 trafik kaydı").
--   audit.events    : account id + action + time. Kept 1 year + 30 days, survives account
--                     deletion on purpose (K-37 "trafik logu istisna"), no foreign key.
--   audit.ip_events : the client IP of an event, in its own table with the same retention so
--                     it can be purged or restricted independently.
--   IP, port, start/end time and byte counts of every request are in the Caddy access log
--   (infra/caddy), rotated with the same retention; the two are joined only for legal requests.
-- ---------------------------------------------------------------------------------------------

create table audit.events (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  at timestamptz not null default now()
);
create index events_at on audit.events (at);
create index events_user_id on audit.events (user_id);

create table audit.ip_events (
  event_id bigint primary key references audit.events (id) on delete cascade,
  ip inet not null,
  at timestamptz not null default now()
);
create index ip_events_at on audit.ip_events (at);

-- Destruction log (Silme Yönetmeliği m.7/3: kept 3 years). Counts only, no personal data.
create table audit.destruction_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  category text not null,
  rows_deleted integer not null,
  method text not null
);

-- Audit rows are append only; only the retention purge (which sets etut.purge) may delete.
create or replace function audit.protect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('etut.purge', true) = 'on' then
    return old;
  end if;
  raise exception 'audit_append_only' using errcode = 'P0001';
end
$$;

create trigger events_protect before update or delete on audit.events
for each row execute function audit.protect();
create trigger ip_events_protect before update or delete on audit.ip_events
for each row execute function audit.protect();
create trigger destruction_log_protect before update or delete on audit.destruction_log
for each row execute function audit.protect();
