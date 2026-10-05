-- Etüt backend, step 8: fixes from the third review round (additive or CREATE OR REPLACE;
-- earlier migrations stay untouched).
--
--   1. Uploads only with a purpose: submit_session stores nothing for someone in no group, with
--      no pending request and no linked parent ('ignored'). The device flag is only a shortcut
--      (KVKK m.4/2-ç). A linked parent's weekly summary keeps working without a group.
--   2. A request the system turned down (parent lock, block, no profile) is dropped instead of
--      being marked 'rejected', so it does not count as the founder's "no" (30-day wait).
--   3. A founder can block or report someone who only sent a request, by request id; the
--      requester's account id is never shown (K-08, K-28, Apple 1.2).
--   4. Exam type and YKS area are checked (no LGS group profile, K-17/K-45) but not stored:
--      nothing on the server reads them (KVKK m.4/2-ç).
--   5. A parent link that ends without the parent (student deleted the group account, removed
--      the link, declared 18+) leaves a notice for the parent (K-22). The student can remove the
--      link; the parent sees that it happened.
--   6. Retention: parent notices 90 days; a parent account kept while it has one.

-- ---------------------------------------------------------------------------------------------
-- 1. Uploads only with a purpose
-- ---------------------------------------------------------------------------------------------

-- Someone could see this user's study time: a group (or a pending request to one) or a parent.
create or replace function app.uploads_wanted(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from app.memberships m where m.user_id = p_user)
      or exists (select 1 from app.join_requests r where r.user_id = p_user and r.status = 'pending')
      or exists (select 1 from app.parent_links l where l.child_id = p_user)
$$;

-- Same as step 7, plus: 'ignored' (nothing stored) when uploads_wanted() is false.
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

  -- Nobody would see it (no group, no pending request, no parent): not stored (KVKK m.4/2-ç).
  if not app.uploads_wanted(v_me) then
    return 'ignored';
  end if;

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
-- 2. A "no" from the system is not the founder's "no"
-- ---------------------------------------------------------------------------------------------

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
    -- The founder said yes; the request just cannot be carried out now. It is dropped, so the
    -- person may ask again (no 30-day wait as after a rejection).
    delete from app.join_requests r where r.id = p_request;
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

-- ---------------------------------------------------------------------------------------------
-- 3. Block or report a requester (founder only, by request id)
-- ---------------------------------------------------------------------------------------------

-- The requester of a request in a group the caller founded (null otherwise).
create or replace function app.requester_for_owner(p_request uuid, p_owner uuid)
returns table (user_id uuid, group_id uuid)
language sql
stable
set search_path = ''
as $$
  select r.user_id, r.group_id
    from app.join_requests r
    join app.memberships m on m.group_id = r.group_id and m.user_id = p_owner and m.role = 'owner'
   where r.id = p_request and r.user_id <> p_owner
$$;

-- Blocks the person and turns down their pending requests to the caller's groups.
create or replace function public.block_join_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_user uuid;
begin
  select q.user_id into v_user from app.requester_for_owner(p_request, v_me) q;
  if v_user is null then
    perform app.fail('invalid_input');
  end if;
  insert into app.blocks (blocker_id, blocked_id) values (v_me, v_user) on conflict do nothing;
  update app.join_requests r set status = 'rejected', decided_at = now()
   where r.user_id = v_user and r.status = 'pending'
     and exists (select 1 from app.memberships m
                  where m.group_id = r.group_id and m.user_id = v_me and m.role = 'owner');
  perform app.log('user_blocked');
end
$$;

-- Returns 'reported' | 'rate_limited' | 'invalid' (like report()). The request stays as it is:
-- the founder still decides on it.
create or replace function public.report_join_request(p_request uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_user uuid;
  v_group uuid;
begin
  if p_reason is null or p_reason not in ('nickname', 'harassment', 'danger', 'other') then
    return 'invalid';
  end if;
  select q.user_id, q.group_id into v_user, v_group from app.requester_for_owner(p_request, v_me) q;
  if v_user is null then
    return 'invalid';
  end if;
  if app.rate_count(v_me, 'report', now() - interval '1 day') >= 10 then
    return 'rate_limited';
  end if;
  perform app.rate_record(v_me, 'report');
  insert into app.reports (reporter_id, target_user_id, group_id, reason)
  values (v_me, v_user, v_group, p_reason);
  perform app.log('report_filed');
  return 'reported';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Exam type and YKS area: checked by save_profile, not stored
-- ---------------------------------------------------------------------------------------------

alter table app.profiles alter column exam_type drop not null;
update app.profiles set exam_type = null, yks_area = null where exam_type is not null or yks_area is not null;

create or replace function app.profiles_no_exam()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.exam_type := null;
  new.yks_area := null;
  return new;
end
$$;

create trigger profiles_no_exam
  before insert or update on app.profiles
  for each row execute function app.profiles_no_exam();

alter table app.profiles
  add constraint profiles_no_exam check (exam_type is null and yks_area is null);

-- ---------------------------------------------------------------------------------------------
-- 5. Parent notices (K-22)
-- ---------------------------------------------------------------------------------------------

-- What the parent is told: only the kind and the time. No student id, no nickname (the link,
-- and with it the student's data, is gone).
create table app.parent_notices (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('child_deleted_account', 'child_unlinked', 'child_adult', 'link_ended')),
  created_at timestamptz not null default now()
);
create index parent_notices_parent_id on app.parent_notices (parent_id);
alter table app.parent_notices enable row level security;
revoke all on app.parent_notices from public, anon, authenticated;

-- A link ended by anyone but the parent leaves a notice. The functions that end links on the
-- student's side name the reason in the setting etut.link_end (transaction-local).
create or replace function app.parent_link_ended()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
begin
  -- The parent's own doing (unlink, own account deleted): nothing to tell.
  if auth.uid() is not distinct from old.parent_id then
    return old;
  end if;
  -- The parent account itself is going away (purge): nobody to tell.
  if not exists (select 1 from auth.users u where u.id = old.parent_id) then
    return old;
  end if;
  v_kind := nullif(current_setting('etut.link_end', true), '');
  if v_kind is null then
    v_kind := case
      when exists (select 1 from app.profiles p where p.user_id = old.child_id and p.age_band = '18_plus')
        then 'child_adult'
      else 'link_ended'
    end;
  end if;
  insert into app.parent_notices (parent_id, kind) values (old.parent_id, v_kind);
  return old;
end
$$;

create trigger parent_links_ended
  after delete on app.parent_links
  for each row execute function app.parent_link_ended();

-- Student (15–17): removes every parent link. The parents see that it happened (notice).
create or replace function public.child_unlink_parents()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (app.require_profile()).user_id;
  v_count integer;
begin
  perform set_config('etut.link_end', 'child_unlinked', true);
  delete from app.parent_links l where l.child_id = v_me;
  get diagnostics v_count = row_count;
  perform set_config('etut.link_end', '', true);
  delete from app.parent_link_codes c where c.child_id = v_me;
  if v_count > 0 then
    perform app.log('parent_links_removed_by_child');
  end if;
end
$$;

-- The parent's notices, newest first (kept 90 days).
create or replace function public.parent_notices()
returns table (kind text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select n.kind, n.created_at
    from app.parent_notices n
   where n.parent_id = auth.uid()
   order by n.created_at desc
$$;

-- Same as step 6, but a linked student deleting the account leaves a notice for the parent.
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
  perform set_config('etut.link_end', 'child_deleted_account', true);
  delete from auth.users u where u.id = v_me;
  perform set_config('etut.link_end', '', true);
  insert into audit.destruction_log (category, rows_deleted, method)
  values ('account_on_request', 1, 'delete cascade');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Retention (same as step 6, plus parent notices)
-- ---------------------------------------------------------------------------------------------

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

  -- Parent notices: 90 days (kvkk/09 §7).
  delete from app.parent_notices where created_at < now() - interval '90 days';
  get diagnostics n = row_count; perform app.log_destruction('parent_notices', n, 'delete');

  delete from app.join_requests
   where (status <> 'pending' and decided_at < now() - interval '30 days')
      or (status = 'pending' and created_at < now() - interval '30 days');
  get diagnostics n = row_count; perform app.log_destruction('join_requests', n, 'delete');

  -- Moderation records: 2 years after closing (kvkk/09 §7).
  delete from app.reports where status = 'closed' and closed_at < now() - interval '2 years';
  get diagnostics n = row_count; perform app.log_destruction('reports', n, 'delete');

  -- Signed-in users that never got a profile (and are not a linked parent, and have no parent
  -- notice to read): after 1 day.
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '1 day'
     and not exists (select 1 from app.profiles p where p.user_id = u.id)
     and not exists (select 1 from app.parent_links l where l.parent_id = u.id)
     and not exists (select 1 from app.parent_notices n where n.parent_id = u.id);
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
-- Grants (see step 6, section 12)
-- ---------------------------------------------------------------------------------------------

revoke all on function app.uploads_wanted(uuid) from public, anon, authenticated;
revoke all on function app.requester_for_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function app.profiles_no_exam() from public, anon, authenticated;
revoke all on function app.parent_link_ended() from public, anon, authenticated;
revoke all on function app.purge_expired() from public, anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on function public.block_join_request(uuid) to authenticated;
grant execute on function public.report_join_request(uuid, text) to authenticated;
grant execute on function public.child_unlink_parents() to authenticated;
grant execute on function public.parent_notices() to authenticated;
