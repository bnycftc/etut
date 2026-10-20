-- Etüt backend: what a 15–17 account may do before a parent approves (K-23; hukuk/03 K-22, K-23;
-- hukuk/kvkk/06). Additive or CREATE OR REPLACE; earlier migrations stay untouched.
--
-- The final rule is a lawyer's decision, so it is a setting, not code: app.settings.minor_policy.
--
--   'closed'  15–17 is not served. A profile cannot be created with the 15–17 band, nor changed
--             to it ('minor_closed'). An account that already has the band (made under another
--             policy) keeps only the account and the parent link, approved or not. The default:
--             the closed beta is 18+ only.
--   'strict'  Until a parent approves: only the account and the parent link. No group, no live
--             status, no reactions ('minor_pending').
--   'basic'   Until a parent approves: may join groups, always invisible (live status hidden),
--             no reactions either way, no new group ('minor_pending').
--   'open'    No restriction.
--
-- Approval lives on the link (app.parent_links.approved_at): any linked parent's approval
-- counts, and it ends with that link (the parent unlinks, the student removes the link). The
-- parent's own action, recorded in audit.events: 'parent_approved' (parent's account, with the
-- request IP) and 'approved_by_parent' (student's account, no IP), written in the same
-- transaction, so with the same time. An objection deletes the student's group account through
-- app.delete_account (method 'parent_objection', audit.deletion_records) in every policy.
--
-- Enforced in the existing guards, so every path that already honours a parent lock honours
-- this too: app.groups_locked (closed/strict count as "groups off": board, ranking, beat,
-- reactions, join decisions, leaderboard refresh), app.require_groups_allowed (the error code),
-- app.effective_invisible (basic: invisible); plus save_profile, set_preferences, create_group,
-- send_reaction, take_reactions, app.uploads_wanted and the founder hand-over (memberships_count). Leaving a group, reporting, blocking, deleting the account and the parent
-- link always work.
--
-- Changing the policy (operator, psql over SSH):
--   update app.settings set minor_policy = 'basic';
-- The change is written to audit.events ('minor_policy:<value>').

-- ---------------------------------------------------------------------------------------------
-- 1. The setting
-- ---------------------------------------------------------------------------------------------

-- One row. Read only by the SECURITY DEFINER functions below (no client grant, RLS on).
create table app.settings (
  id boolean primary key default true check (id),
  minor_policy text not null default 'closed' check (minor_policy in ('closed', 'strict', 'basic', 'open'))
);
insert into app.settings (id) values (true);
alter table app.settings enable row level security;
revoke all on app.settings from public, anon, authenticated;

create or replace function app.settings_logged()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.minor_policy is distinct from old.minor_policy then
    insert into audit.events (user_id, action) values (null, 'minor_policy:' || new.minor_policy);
  end if;
  return new;
end
$$;

create trigger settings_logged
after update on app.settings
for each row execute function app.settings_logged();

-- The policy in force. No row (deleted by hand) counts as 'closed'.
create or replace function app.minor_policy()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select s.minor_policy from app.settings s where s.id), 'closed')
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Approval on the link
-- ---------------------------------------------------------------------------------------------

alter table app.parent_links add column approved_at timestamptz;

-- The restriction that applies to this user now: 'closed' | 'strict' | 'basic', or null (none:
-- not 15–17, no profile, policy 'open', or approved under 'strict'/'basic').
create or replace function app.minor_restriction(p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.age_band is distinct from '15_17' then null
    when s.policy = 'open' then null
    when s.policy = 'closed' then 'closed'
    when exists (select 1 from app.parent_links l where l.child_id = p_user and l.approved_at is not null) then null
    else s.policy
  end
    from (select app.minor_policy() as policy) s
    left join app.profiles p on p.user_id = p_user
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Guards
-- ---------------------------------------------------------------------------------------------

-- Groups are off for this user: the parent turned them off (K-22 a), or the minor policy keeps
-- them closed until a parent approves (K-23).
create or replace function app.groups_locked(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select c.groups_disabled from app.parent_controls c where c.child_id = p_user), false)
      or coalesce(app.minor_restriction(p_user) in ('closed', 'strict'), false)
$$;

create or replace function app.require_groups_allowed(p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_restriction text := app.minor_restriction(p_user);
begin
  if v_restriction = 'closed' then
    perform app.fail('minor_closed');
  end if;
  if coalesce((select c.groups_disabled from app.parent_controls c where c.child_id = p_user), false) then
    perform app.fail('parent_locked');
  end if;
  if v_restriction = 'strict' then
    perform app.fail('minor_pending');
  end if;
end
$$;

-- "Görünmez çalış" as seen by others: own choice, forced by the parent (K-12, K-22 a), or a 15–17
-- account under 'basic' that no parent approved yet (K-23).
create or replace function app.effective_invisible(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select p.invisible from app.profiles p where p.user_id = p_user), true)
      or coalesce((select c.force_invisible from app.parent_controls c where c.child_id = p_user), false)
      or coalesce(app.minor_restriction(p_user) = 'basic', false)
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Functions with a minor rule of their own
-- ---------------------------------------------------------------------------------------------

-- Same as step 7, plus: under 'closed' no new 15–17 profile and no change to 15–17.
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
  -- K-23: 15–17 is not served under 'closed'. An account that already has the band keeps it.
  if p_age_band = '15_17' and app.minor_policy() = 'closed'
     and (not v_exists or v_old.age_band <> '15_17') then
    perform app.fail('minor_closed');
  end if;
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

-- Same as step 3, plus: under 'basic' visibility cannot be turned on before approval.
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
  if p_invisible = false and app.minor_restriction(v_me) = 'basic' then
    perform app.fail('minor_pending');
  end if;
  update app.profiles p
     set invisible = coalesce(p_invisible, p.invisible),
         reactions_enabled = coalesce(p_reactions_enabled, p.reactions_enabled),
         updated_at = now()
   where p.user_id = v_me;
end
$$;

-- Same as step 3, plus: under 'basic' no new group before approval ('closed'/'strict' are
-- refused by app.require_groups_allowed).
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
  if app.minor_restriction(v_me) is not null then
    perform app.fail('minor_pending');
  end if;
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

-- Same as step 3, plus: before approval a 15–17 account neither sends nor receives reactions.
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
  if app.minor_restriction(v_me) is not null then
    perform app.fail('minor_pending');
  end if;
  perform app.require_member(p_group, v_me);
  if not exists (select 1 from app.memberships m where m.group_id = p_group and m.user_id = p_to)
     or app.groups_locked(p_to)
     or app.minor_restriction(p_to) is not null
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

-- Same as step 6, plus: reactions waiting for a 15–17 account under a restriction (sent before
-- the policy changed or the approval ended) are dropped unseen, like under a parent lock.
create or replace function public.take_reactions()
returns table (id uuid, kind text, from_nickname text, group_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
begin
  -- Dropped unseen: everything while a parent turned groups off or the minor policy holds
  -- reactions back, and reactions from people the caller blocked.
  update app.reactions r set delivered_at = now()
   where r.to_user = v_me and r.delivered_at is null
     and (app.groups_locked(v_me) or app.minor_restriction(v_me) is not null
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

-- Same as step 8, plus: a membership hidden by a lock (parent or minor policy) is no purpose
-- of its own; only a linked parent still is (KVKK m.4/2-ç). Under a parent lock a parent is
-- linked, so nothing changes there.
create or replace function app.uploads_wanted(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (not app.groups_locked(p_user)
          and (exists (select 1 from app.memberships m where m.user_id = p_user)
               or exists (select 1 from app.join_requests r where r.user_id = p_user and r.status = 'pending')))
      or exists (select 1 from app.parent_links l where l.child_id = p_user)
$$;

-- Same as step 1, plus: when the founder goes, an unrestricted member is preferred as the new
-- founder, so a 15–17 account under a restriction ('basic': no new group) does not get the
-- founder's powers while anyone else is there.
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
          order by (app.groups_locked(m2.user_id) or app.minor_restriction(m2.user_id) is not null),
                   m2.joined_at, m2.user_id
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

-- ---------------------------------------------------------------------------------------------
-- 5. RPCs
-- ---------------------------------------------------------------------------------------------

-- The caller's standing under the policy (the app's explanation card and the day-14 reminder).
-- band / days_since_signup are null without a profile; days are Istanbul calendar days since
-- the profile was made.
create or replace function public.my_minor_status()
returns table (policy text, band text, linked boolean, approved boolean, days_since_signup integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  return query
    select app.minor_policy(), p.age_band,
           exists (select 1 from app.parent_links l where l.child_id = v_me),
           exists (select 1 from app.parent_links l where l.child_id = v_me and l.approved_at is not null),
           app.istanbul_day(now()) - app.istanbul_day(p.created_at)
      from (select 1) one
      left join app.profiles p on p.user_id = v_me;
end
$$;

-- Parent: approval per linked student. approved_at = this parent's own approval; approved = any
-- linked parent approved.
create or replace function public.parent_approvals()
returns table (child_id uuid, approved_at timestamptz, approved boolean, policy text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
begin
  return query
    select l.child_id, l.approved_at,
           exists (select 1 from app.parent_links o where o.child_id = l.child_id and o.approved_at is not null),
           app.minor_policy()
      from app.parent_links l
     where l.parent_id = v_me
     order by l.created_at;
end
$$;

-- Parent: "Onaylıyorum". The first approval's time is kept; approving again changes nothing.
create or replace function public.parent_approve(p_child uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_link app.parent_links;
begin
  select * into v_link from app.parent_links l where l.child_id = p_child and l.parent_id = v_me;
  if not found then
    perform app.fail('not_parent');
  end if;
  if v_link.approved_at is not null then
    return v_link.approved_at;
  end if;
  update app.parent_links l
     set approved_at = now(), parent_active_at = now()
   where l.child_id = p_child and l.parent_id = v_me;
  -- Evidence of the parent's own action: both accounts, same time; the IP only on the parent's.
  perform app.log('parent_approved', v_me);
  insert into audit.events (user_id, action) values (p_child, 'approved_by_parent');
  return now();
end
$$;

-- Parent: "İtiraz ediyorum". Deletes the student's group account (K-23), like a deletion on
-- request. Another linked parent is told that the link ended.
create or replace function public.parent_object(p_child uuid)
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
  perform app.log('parent_objected', v_me);
  perform set_config('etut.link_end', 'link_ended', true);
  delete from app.parent_links l where l.child_id = p_child and l.parent_id <> v_me;
  perform set_config('etut.link_end', '', true);
  perform app.delete_account(p_child, 'parent_objection');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants (see step 6, section 12)
-- ---------------------------------------------------------------------------------------------

revoke all on function app.settings_logged() from public, anon, authenticated;
revoke all on function app.minor_policy() from public, anon, authenticated;
revoke all on function app.minor_restriction(uuid) from public, anon, authenticated;
revoke all on function app.groups_locked(uuid) from public, anon, authenticated;
revoke all on function app.require_groups_allowed(uuid) from public, anon, authenticated;
revoke all on function app.effective_invisible(uuid) from public, anon, authenticated;
revoke all on function app.uploads_wanted(uuid) from public, anon, authenticated;
revoke all on function app.memberships_count() from public, anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on function public.my_minor_status() to authenticated;
grant execute on function public.parent_approvals() to authenticated;
grant execute on function public.parent_approve(uuid) to authenticated;
grant execute on function public.parent_object(uuid) to authenticated;
