-- Etüt backend: in-app KVKK application and complaint channel (KVKK m.11, m.13; hukuk/03 K-31,
-- K-38; hukuk/kvkk/07 C2, C5, C6). Additive or CREATE OR REPLACE; earlier migrations stay untouched.
--
--   app.dsr_requests   one row per application. The signed-in account is the applicant (no
--                      extra identity, kvkk/07 C3). Kinds are the rights of KVKK m.11 plus
--                      "şikâyet / bildirim" (K-31) and "diğer"; free text up to 2000 characters.
--                      No e-mail, phone or attachment is collected (K-32).
--   due_at             30 days after submission (KVKK m.13/2), set by a trigger, never changed.
--   answer             written once by the operator (app.answer_request, psql over SSH:
--                      infra/scripts/requests.sh) and immutable afterwards (kvkk/07 C5.1).
--   seen_at            first time the applicant opened the answer: the proof that it arrived
--                      (kvkk/07 C5.2), set once.
--   retention          3 years after the answer (or the submission, if never answered), then
--                      removed by the daily purge and counted in the destruction log (kvkk/07 C6).
--                      Deleting the account keeps the record without the account id (proof).
--   export_my_data()   the caller's own server-side data as JSON (KVKK m.11/1-b; the app shares
--                      it through the system share sheet as "Verilerimi indir").

-- ---------------------------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------------------------

create table app.dsr_requests (
  id uuid primary key default gen_random_uuid(),
  -- "Başvuru numarası" shown to the applicant and used by the operator (8 characters, no 0/O/1/I).
  ref text not null unique check (ref ~ '^[A-HJ-NP-Z2-9]{8}$'),
  -- Kept without the account when the account is deleted (proof of the answer, 3 years).
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in (
    'processed', 'info', 'purpose', 'recipients', 'correction', 'deletion', 'notify_recipients',
    'automated_decision', 'damages', 'complaint', 'other')),
  -- 'parent': a parent applying for their child (kvkk/07 C2, C3; verified by the operator).
  applicant text not null default 'self' check (applicant in ('self', 'parent')),
  body text check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  answered_at timestamptz,
  answer_result text check (answer_result in ('accepted', 'partial', 'rejected')),
  answer_text text check (char_length(answer_text) between 1 and 20000),
  seen_at timestamptz,
  constraint dsr_body_when_needed check (kind not in ('other', 'complaint') or body is not null),
  constraint dsr_answer_complete check (
    (answered_at is null and answer_result is null and answer_text is null)
    or (answered_at is not null and answer_result is not null and answer_text is not null)),
  constraint dsr_seen_after_answer check (seen_at is null or answered_at is not null)
);
create index dsr_requests_user_id on app.dsr_requests (user_id);
create index dsr_requests_open on app.dsr_requests (due_at) where answered_at is null;

-- The deadline follows from the submission time only (30 calendar days; Istanbul has no DST).
create or replace function app.dsr_requests_due()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.due_at := new.created_at + interval '30 days';
  return new;
end
$$;

create trigger dsr_requests_due
  before insert on app.dsr_requests
  for each row execute function app.dsr_requests_due();

-- What may change after the insert: the account id may go away (account deletion, ON DELETE SET
-- NULL), the answer is written once, seen_at is set once. Everything else is fixed. Rows are
-- deleted only by the retention purge (which sets etut.purge).
create or replace function app.dsr_requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('etut.purge', true) = 'on' then
      return old;
    end if;
    raise exception 'dsr_immutable' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.ref is distinct from old.ref
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or new.kind is distinct from old.kind
     or new.applicant is distinct from old.applicant
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at
     or new.due_at is distinct from old.due_at
     or (old.answered_at is not null and (
           new.answered_at is distinct from old.answered_at
           or new.answer_result is distinct from old.answer_result
           or new.answer_text is distinct from old.answer_text))
     or (old.seen_at is not null and new.seen_at is distinct from old.seen_at) then
    raise exception 'dsr_immutable' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger dsr_requests_guard
  before update or delete on app.dsr_requests
  for each row execute function app.dsr_requests_guard();

-- RLS as everywhere (security step 4): no client writes, own rows only for SELECT.
alter table app.dsr_requests enable row level security;
revoke all on app.dsr_requests from public, anon, authenticated;
grant select (id, ref, kind, applicant, body, created_at, due_at, answered_at, answer_result, answer_text, seen_at)
  on app.dsr_requests to authenticated;
create policy dsr_requests_select on app.dsr_requests for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Any signed-in account may apply (a parent account has no profile). At most 5 a day.
-- Errors: 'invalid_input' (kind, applicant, missing or too long text), 'rate_limited'.
create or replace function public.submit_request(p_kind text, p_applicant text, p_body text)
returns table (request_id uuid, ref text, created_at timestamptz, due_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_ref text;
  v_row app.dsr_requests;
begin
  if p_kind is null or p_kind not in (
       'processed', 'info', 'purpose', 'recipients', 'correction', 'deletion', 'notify_recipients',
       'automated_decision', 'damages', 'complaint', 'other')
     or coalesce(p_applicant, 'self') not in ('self', 'parent')
     or (p_kind in ('other', 'complaint') and v_body is null)
     or char_length(coalesce(v_body, '')) > 2000 then
    perform app.fail('invalid_input');
  end if;
  if app.rate_count(v_me, 'dsr_submit', now() - interval '1 day') >= 5 then
    perform app.fail('rate_limited');
  end if;
  perform app.rate_record(v_me, 'dsr_submit');
  loop
    v_ref := app.random_code();
    exit when not exists (select 1 from app.dsr_requests r where r.ref = v_ref);
  end loop;
  insert into app.dsr_requests (ref, user_id, kind, applicant, body)
  values (v_ref, v_me, p_kind, coalesce(p_applicant, 'self'), v_body)
  returning * into v_row;
  perform app.log('request_submitted');
  return query select v_row.id, v_row.ref, v_row.created_at, v_row.due_at;
end
$$;

-- The caller's applications with their answers, newest first.
create or replace function public.my_requests()
returns table (
  request_id uuid, ref text, kind text, applicant text, body text, created_at timestamptz,
  due_at timestamptz, answered_at timestamptz, answer_result text, answer_text text, seen_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select r.id, r.ref, r.kind, r.applicant, r.body, r.created_at, r.due_at, r.answered_at,
         r.answer_result, r.answer_text, r.seen_at
    from app.dsr_requests r
   where r.user_id = app.me()
   order by r.created_at desc, r.ref
$$;

-- The applicant opened the answer: the first time is kept (proof of delivery). Returns that time,
-- or NULL when the request is not the caller's or has no answer yet.
create or replace function public.mark_request_seen(p_request uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_seen timestamptz;
begin
  update app.dsr_requests r
     set seen_at = now()
   where r.id = p_request and r.user_id = v_me and r.answered_at is not null and r.seen_at is null
  returning r.seen_at into v_seen;
  if v_seen is not null then
    perform app.log('request_answer_seen');
    return v_seen;
  end if;
  select r.seen_at into v_seen
    from app.dsr_requests r
   where r.id = p_request and r.user_id = v_me;
  return v_seen;
end
$$;

-- Everything the server holds about the caller (KVKK m.11/1-b), without other people's account
-- ids and without IP addresses. Free of the 5651 IP table on purpose: the traffic record is
-- opened only for a legal request (privacy text "Güvenlik kaydı"); the actions themselves are in.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_out jsonb;
begin
  select jsonb_build_object(
    'format', 'etut-sunucu-verileri',
    'version', 1,
    'exported_at', now(),
    'account', (
      select jsonb_build_object('id', u.id, 'created_at', u.created_at, 'is_anonymous', u.is_anonymous)
        from auth.users u where u.id = v_me),
    'profile', (
      select jsonb_build_object(
               'nickname', p.nickname, 'age_band', p.age_band, 'band_year', p.band_year,
               'invisible', p.invisible, 'reactions_enabled', p.reactions_enabled,
               'created_at', p.created_at, 'updated_at', p.updated_at, 'last_active_at', p.last_active_at)
        from app.profiles p where p.user_id = v_me),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', g.id, 'name', g.name, 'role', m.role, 'joined_at', m.joined_at)
                       order by m.joined_at)
        from app.memberships m join app.groups g on g.id = m.group_id
       where m.user_id = v_me), '[]'::jsonb),
    'join_requests', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', j.group_id, 'status', j.status,
                                          'created_at', j.created_at, 'decided_at', j.decided_at)
                       order by j.created_at)
        from app.join_requests j where j.user_id = v_me), '[]'::jsonb),
    'presence', (
      select jsonb_build_object('started_at', p.started_at, 'last_beat_at', p.last_beat_at, 'paused', p.paused)
        from app.presence p where p.user_id = v_me),
    'study_sessions', coalesce((
      select jsonb_agg(jsonb_build_object('client_id', s.client_id, 'started_at', s.started_at,
                                          'ended_at', s.ended_at, 'duration_s', s.duration_s,
                                          'source', s.source, 'verified', s.verified,
                                          'received_at', s.received_at)
                       order by s.started_at)
        from app.study_sessions s where s.user_id = v_me), '[]'::jsonb),
    'daily_totals', coalesce((
      select jsonb_agg(jsonb_build_object('day', t.day, 'seconds', t.seconds,
                                          'verified_seconds', t.verified_seconds,
                                          'manual_seconds', t.manual_seconds)
                       order by t.day)
        from app.daily_totals t where t.user_id = v_me), '[]'::jsonb),
    'reactions_received', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', r.group_id, 'kind', r.kind,
                                          'created_at', r.created_at, 'delivered_at', r.delivered_at)
                       order by r.created_at)
        from app.reactions r where r.to_user = v_me), '[]'::jsonb),
    'reactions_sent', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', r.group_id, 'kind', r.kind, 'created_at', r.created_at)
                       order by r.created_at)
        from app.reactions r where r.from_user = v_me), '[]'::jsonb),
    'reports_made', coalesce((
      select jsonb_agg(jsonb_build_object('reason', r.reason, 'status', r.status, 'decision', r.decision,
                                          'created_at', r.created_at, 'closed_at', r.closed_at)
                       order by r.created_at)
        from app.reports r where r.reporter_id = v_me), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('created_at', b.created_at) order by b.created_at)
        from app.blocks b where b.blocker_id = v_me), '[]'::jsonb),
    'parent_link_code', (
      select jsonb_build_object('code', c.code, 'expires_at', c.expires_at)
        from app.parent_link_codes c where c.child_id = v_me),
    'parent_links_as_student', coalesce((
      select jsonb_agg(jsonb_build_object('created_at', l.created_at, 'groups_disabled', l.groups_disabled,
                                          'force_invisible', l.force_invisible,
                                          'daily_limit_minutes', l.daily_limit_minutes)
                       order by l.created_at)
        from app.parent_links l where l.child_id = v_me), '[]'::jsonb),
    'parent_links_as_parent', coalesce((
      select jsonb_agg(jsonb_build_object('created_at', l.created_at, 'groups_disabled', l.groups_disabled,
                                          'force_invisible', l.force_invisible,
                                          'daily_limit_minutes', l.daily_limit_minutes,
                                          'controls_updated_at', l.controls_updated_at,
                                          'parent_active_at', l.parent_active_at)
                       order by l.created_at)
        from app.parent_links l where l.parent_id = v_me), '[]'::jsonb),
    'parent_notices', coalesce((
      select jsonb_agg(jsonb_build_object('kind', n.kind, 'created_at', n.created_at) order by n.created_at)
        from app.parent_notices n where n.parent_id = v_me), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('ref', r.ref, 'kind', r.kind, 'applicant', r.applicant, 'body', r.body,
                                          'created_at', r.created_at, 'due_at', r.due_at,
                                          'answered_at', r.answered_at, 'answer_result', r.answer_result,
                                          'answer_text', r.answer_text, 'seen_at', r.seen_at)
                       order by r.created_at)
        from app.dsr_requests r where r.user_id = v_me), '[]'::jsonb),
    'rate_events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'at', e.at) order by e.at)
        from app.rate_events e where e.user_id = v_me), '[]'::jsonb),
    'audit_events', coalesce((
      select jsonb_agg(jsonb_build_object('action', e.action, 'at', e.at) order by e.at)
        from audit.events e where e.user_id = v_me), '[]'::jsonb)
  ) into v_out;
  perform app.log('data_exported');
  return v_out;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Operator (psql over SSH only, infra/scripts/requests.sh). Not granted to any client role.
-- ---------------------------------------------------------------------------------------------

-- Writes the answer once (kvkk/07 C4). Result: 'accepted' | 'partial' | 'rejected'.
create or replace function app.answer_request(p_ref text, p_result text, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_result is null or p_result not in ('accepted', 'partial', 'rejected') then
    raise exception 'result must be accepted, partial or rejected';
  end if;
  if nullif(btrim(coalesce(p_text, '')), '') is null then
    raise exception 'an answer text is required';
  end if;
  update app.dsr_requests r
     set answered_at = now(), answer_result = p_result, answer_text = btrim(p_text)
   where r.ref = app.normalize_code(p_ref) and r.answered_at is null
  returning r.user_id into v_user;
  if not found then
    raise exception 'request % does not exist or is already answered', p_ref;
  end if;
  perform app.log('request_answered', v_user);
end
$$;

-- Retention (kvkk/07 C6): 3 years after the answer, or after the submission if never answered.
create or replace function app.purge_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform set_config('etut.purge', 'on', true);
  delete from app.dsr_requests r where coalesce(r.answered_at, r.created_at) < now() - interval '3 years';
  get diagnostics n = row_count;
  perform set_config('etut.purge', 'off', true);
  perform app.log_destruction('dsr_requests', n, 'delete');
  return n;
end
$$;

-- Same as step 8 (round3), plus the applications (app.purge_requests). A later migration that
-- replaces this function must keep the purge_requests() call: 09_requests.test.sql checks it.
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

  -- KVKK applications and their answers: 3 years (kvkk/07 C6).
  perform app.purge_requests();

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

revoke all on function app.dsr_requests_due() from public, anon, authenticated;
revoke all on function app.dsr_requests_guard() from public, anon, authenticated;
revoke all on function app.answer_request(text, text, text) from public, anon, authenticated;
revoke all on function app.purge_requests() from public, anon, authenticated;
revoke all on function app.purge_expired() from public, anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on function public.submit_request(text, text, text) to authenticated;
grant execute on function public.my_requests() to authenticated;
grant execute on function public.mark_request_seen(uuid) to authenticated;
grant execute on function public.export_my_data() to authenticated;
