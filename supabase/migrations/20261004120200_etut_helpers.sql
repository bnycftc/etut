-- Etüt backend, step 3a: internal helpers used by the RPC functions and the RLS policies.
-- All of them live in the private `app` schema and run with a fixed, empty search_path.

-- Membership trigger: also drop a leaver's cached leaderboard rows right away, so nobody outside
-- the group appears in its ranking even before the next refresh (K-06, K-12).
create or replace function app.memberships_cleanup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from app.leaderboard_cache c where c.group_id = old.group_id and c.user_id = old.user_id;
  return old;
end
$$;

create trigger memberships_cleanup
after delete on app.memberships
for each row execute function app.memberships_cleanup();

-- Caller's user id; every RPC requires a signed-in (anonymous or linked) user.
create or replace function app.me()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  return v;
end
$$;

create or replace function app.fail(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using message = p_code, errcode = 'P0001';
end
$$;

-- RLS helper functions. SECURITY DEFINER so a policy on a table can look at memberships without
-- recursing into the memberships policy; they only answer yes/no about the caller.
create or replace function app.is_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.memberships m where m.group_id = p_group and m.user_id = auth.uid())
$$;

create or replace function app.is_owner(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.memberships m
     where m.group_id = p_group and m.user_id = auth.uid() and m.role = 'owner')
$$;

create or replace function app.shares_group(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from app.memberships a
      join app.memberships b on b.group_id = a.group_id
     where a.user_id = auth.uid() and b.user_id = p_user)
$$;

create or replace function app.is_parent_of(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.parent_links l where l.child_id = p_child and l.parent_id = auth.uid())
$$;

-- Either user blocked the other.
create or replace function app.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from app.blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a))
$$;

-- Parent lock: the group module is turned off for this user (K-22 a).
create or replace function app.groups_locked(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select c.groups_disabled from app.parent_controls c where c.child_id = p_user), false)
$$;

-- "Görünmez çalış" as seen by others: own choice or forced by the parent (K-12, K-22 a).
create or replace function app.effective_invisible(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select p.invisible from app.profiles p where p.user_id = p_user), true)
      or coalesce((select c.force_invisible from app.parent_controls c where c.child_id = p_user), false)
$$;

-- The caller's profile; raises when the account has none (no group feature without a 15+ profile).
create or replace function app.require_profile()
returns app.profiles
language plpgsql
set search_path = ''
as $$
declare
  v app.profiles;
begin
  select * into v from app.profiles where user_id = app.me();
  if not found then
    perform app.fail('no_profile');
  end if;
  if v.last_active_at < now() - interval '1 day' then
    update app.profiles set last_active_at = now() where user_id = v.user_id;
  end if;
  return v;
end
$$;

create or replace function app.require_groups_allowed(p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if app.groups_locked(p_user) then
    perform app.fail('parent_locked');
  end if;
end
$$;

create or replace function app.require_member(p_group uuid, p_user uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  select m.role into v_role from app.memberships m where m.group_id = p_group and m.user_id = p_user;
  if v_role is null then
    perform app.fail('not_member');
  end if;
  return v_role;
end
$$;

-- Number of rate events of a kind in a window (optionally for one subject).
create or replace function app.rate_count(p_user uuid, p_kind text, p_since timestamptz, p_subject uuid default null)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
    from app.rate_events e
   where e.user_id = p_user and e.kind = p_kind and e.at >= p_since
     and (p_subject is null or e.subject = p_subject)
$$;

create or replace function app.rate_record(p_user uuid, p_kind text, p_subject uuid default null)
returns void
language sql
set search_path = ''
as $$
  insert into app.rate_events (user_id, kind, subject) values (p_user, p_kind, p_subject)
$$;

-- Start of the current Istanbul day as a timestamp.
create or replace function app.istanbul_midnight(p_day date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_day::timestamp at time zone 'Europe/Istanbul')
$$;

-- 8 characters from an alphabet without 0/O/1/I; 32 symbols, so byte % 32 is unbiased.
create or replace function app.random_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end
$$;

-- Codes are typed by people: ignore case, spaces and dashes.
create or replace function app.normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'))
$$;

-- Audit record (5651 / K-41). The client IP is taken from X-Forwarded-For as set by the reverse
-- proxy (Caddy replaces any client-sent value; Kong appends itself), stored separately.
create or replace function app.log(p_action text, p_user uuid default auth.uid())
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_headers json;
  v_ip text;
begin
  insert into audit.events (user_id, action) values (p_user, p_action) returning id into v_id;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    v_ip := btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
    if v_ip <> '' then
      insert into audit.ip_events (event_id, ip) values (v_id, v_ip::inet);
    end if;
  exception when others then
    -- A malformed header must never block the action itself.
    null;
  end;
end
$$;
