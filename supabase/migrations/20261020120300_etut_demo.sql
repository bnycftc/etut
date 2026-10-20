-- Etüt backend: the demo group for App Review and the TestFlight Beta App Review (Apple 2.1: the
-- reviewer must be able to see the group module without a second person to approve them).
-- Additive or CREATE OR REPLACE; earlier migrations stay untouched.
--
--   app.groups.is_demo   true for the one demo group. Set only by the operator through
--                        app.demo_seed() (infra/scripts/demo-seed.sh, psql on the server). No RPC
--                        sets it, clients have no write grant, and a trigger refuses any change
--                        to it (and to the demo group's code) made inside a signed-in request.
--   app.demo_accounts    the seeded fake accounts (fixed ids, "Demo …" nicknames, made-up study
--                        times). They never sign in.
--   invite code          never expires (invite_expires_at = 'infinity'; the daily purge only
--                        clears codes whose expiry has passed). A new code only by
--                        demo-seed.sh --new-code.
--   request_join         a valid demo code adds the caller at once, without the founder (who is
--                        a seeded account). Only adults (age band 18+): the group is shared with
--                        whoever has the code. A real member is taken out again after 7 days, so
--                        the group never fills up and nobody stays among strangers. Joining it
--                        changes nothing else: membership of this one group, role 'member'.
--                        This is the only migration that redefines request_join.

-- ---------------------------------------------------------------------------------------------
-- 1. Flag, fake accounts
-- ---------------------------------------------------------------------------------------------

alter table app.groups add column is_demo boolean not null default false;
-- At most one demo group.
create unique index groups_one_demo on app.groups (is_demo) where is_demo;

create table app.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app.demo_accounts enable row level security;
-- No policy, no grant: clients never read or write it.
revoke all on app.demo_accounts from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Nothing a client can reach turns a group into the demo group (or changes the demo code)
-- ---------------------------------------------------------------------------------------------

-- Every RPC runs inside a request with a signed-in user (auth.uid() set), also the SECURITY
-- DEFINER ones that write app.groups as the table owner. The operator (psql) and the pg_cron jobs
-- run without one.
create or replace function app.groups_demo_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.is_demo then
      perform app.fail('demo_locked');
    end if;
  elsif new.is_demo is distinct from old.is_demo
     or (old.is_demo and (new.invite_code is distinct from old.invite_code
                          or new.invite_expires_at is distinct from old.invite_expires_at)) then
    perform app.fail('demo_locked');
  end if;
  return new;
end
$$;

create trigger groups_demo_guard
before insert or update on app.groups
for each row execute function app.groups_demo_guard();

-- ---------------------------------------------------------------------------------------------
-- 3. Joining
-- ---------------------------------------------------------------------------------------------

-- Returns 'requested' | 'already_member' | 'already_pending' | 'invalid_code' | 'group_full'
-- | 'rate_limited'. Someone the founder rejected or removed in the last 30 days, or who is
-- blocked either way with the founder, gets 'invalid_code' (nothing tells them why).
-- Demo group: 'requested' means the caller is already a member (the app reloads the group list
-- after 'requested', so the group shows up at once); under 18 the code is 'invalid_code'.
create or replace function public.request_join(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile app.profiles := app.require_profile();
  v_me uuid := v_profile.user_id;
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

  if v_group.is_demo then
    if v_profile.age_band <> '18_plus' then
      return 'invalid_code';
    end if;
    -- Real members stay 7 days; the seeded accounts stay.
    delete from app.memberships m
     where m.group_id = v_group.id and m.role = 'member'
       and m.joined_at < now() - interval '7 days'
       and not exists (select 1 from app.demo_accounts d where d.user_id = m.user_id);
    if app.rate_count(v_me, 'join_request', now() - interval '1 day') >= 10 then
      return 'rate_limited';
    end if;
    begin
      insert into app.memberships (group_id, user_id, role) values (v_group.id, v_me, 'member');
    exception when check_violation then
      -- K-05: member_count would exceed 30.
      return 'group_full';
    end;
    perform app.rate_record(v_me, 'join_request', v_group.id);
    -- Kept like an approved request (30 days), so the history reads the same as elsewhere.
    insert into app.join_requests (group_id, user_id, status, decided_at)
    values (v_group.id, v_me, 'approved', now());
    perform app.log('join_demo');
    return 'requested';
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

-- ---------------------------------------------------------------------------------------------
-- 4. Seeding (operator only: infra/scripts/demo-seed.sh)
-- ---------------------------------------------------------------------------------------------

-- Creates the demo group, or brings it back to its seeded state, and returns its invite code:
-- five fake accounts (one founder), made-up study times for the last 7 days, no real members
-- (they are taken out; the reviewer joins fresh). Safe to run again: same accounts, same group,
-- same code unless p_new_code. Running it also keeps the fake accounts from the 6-month
-- inactivity purge (last_active_at).
create or replace function app.demo_seed(p_new_code boolean default false)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ids constant uuid[] := array[
    'de000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002',
    'de000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000004',
    'de000000-0000-4000-8000-000000000005']::uuid[];
  v_nicks constant text[] := array['Demo Kurucu', 'Demo Sayısal', 'Demo Eşit Ağırlık', 'Demo Sözel', 'Demo Dil'];
  v_areas constant text[] := array['sayisal', 'sayisal', 'esit_agirlik', 'sozel', 'dil'];
  v_today date := app.istanbul_day(now());
  v_group uuid;
  v_code text;
  v_seconds integer;
begin
  if auth.uid() is not null then
    perform app.fail('demo_locked');
  end if;

  for i in 1..5 loop
    insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
    values (v_ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now())
    on conflict (id) do nothing;
    insert into app.profiles (user_id, nickname, exam_type, yks_area, age_band)
    values (v_ids[i], v_nicks[i], 'YKS', v_areas[i], '18_plus')
    on conflict (user_id) do update
      set nickname = excluded.nickname, exam_type = excluded.exam_type, yks_area = excluded.yks_area,
          age_band = excluded.age_band, last_active_at = now(), updated_at = now();
    insert into app.demo_accounts (user_id) values (v_ids[i]) on conflict (user_id) do nothing;
  end loop;

  select g.id, g.invite_code into v_group, v_code from app.groups g where g.is_demo;
  if v_group is null then
    insert into app.groups (name, is_demo) values ('Etüt Demo', true) returning id into v_group;
  end if;

  -- A real member the membership trigger promoted to founder steps down first, so taking the
  -- real members out promotes nobody and never removes the group. Then the seeded five in, the
  -- first one as founder, with a join date fixed before any real member's.
  update app.memberships m set role = 'member'
   where m.group_id = v_group and m.role = 'owner' and m.user_id <> v_ids[1];
  delete from app.memberships m
   where m.group_id = v_group
     and not exists (select 1 from app.demo_accounts d where d.user_id = m.user_id);
  for i in 1..5 loop
    insert into app.memberships (group_id, user_id, role, joined_at)
    values (v_group, v_ids[i], case when i = 1 then 'owner' else 'member' end,
            timestamptz '2026-01-01 09:00+03' + make_interval(mins => i))
    on conflict (group_id, user_id) do update set role = excluded.role, joined_at = excluded.joined_at;
  end loop;

  if v_code is null or p_new_code then
    loop
      v_code := app.random_code();
      exit when not exists (select 1 from app.groups g where g.invite_code = v_code);
    end loop;
    update app.groups g set invite_code = v_code, invite_expires_at = 'infinity' where g.id = v_group;
  end if;

  -- Made-up study times (verified timer time) for the last 7 days, so the board and the ranking
  -- have something to show.
  for i in 1..5 loop
    for d in 0..6 loop
      v_seconds := 1800 + ((i * 7 + d * 3) % 11) * 900;
      insert into app.daily_totals (user_id, day, seconds, verified_seconds, manual_seconds)
      values (v_ids[i], v_today - d, v_seconds, v_seconds, 0)
      on conflict (user_id, day) do update
        set seconds = excluded.seconds, verified_seconds = excluded.verified_seconds,
            manual_seconds = excluded.manual_seconds;
    end loop;
  end loop;
  perform app.refresh_leaderboards();
  perform app.log('demo_seeded', null);
  return v_code;
end
$$;

revoke all on function app.groups_demo_guard() from public, anon, authenticated;
revoke all on function app.demo_seed(boolean) from public, anon, authenticated;
revoke all on function public.request_join(text) from public, anon;
grant execute on function public.request_join(text) to authenticated;
