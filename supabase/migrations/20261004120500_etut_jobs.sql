-- Etüt backend, step 5: periodic jobs (pg_cron): leaderboard cache every 5 minutes and the daily
-- retention purge (hukuk/kvkk/09 §7–8). Every purge writes its row count to the destruction log.

-- Group leaderboards of the current Istanbul day and ISO week, current members only (K-06).
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
    (group_id, period, period_start, user_id, rank, seconds, manual_seconds, computed_at)
  select m.group_id, 'day', v_today, m.user_id,
         rank() over (partition by m.group_id order by coalesce(t.seconds, 0) desc),
         coalesce(t.seconds, 0), coalesce(t.manual_seconds, 0), now()
    from app.memberships m
    left join app.daily_totals t on t.user_id = m.user_id and t.day = v_today
   where not app.groups_locked(m.user_id)
  on conflict (group_id, period, period_start, user_id) do update
    set rank = excluded.rank, seconds = excluded.seconds,
        manual_seconds = excluded.manual_seconds, computed_at = excluded.computed_at;

  insert into app.leaderboard_cache as c
    (group_id, period, period_start, user_id, rank, seconds, manual_seconds, computed_at)
  select w.group_id, 'week', v_week, w.user_id,
         rank() over (partition by w.group_id order by w.seconds desc),
         w.seconds, w.manual_seconds, now()
    from (
      select m.group_id, m.user_id,
             coalesce(sum(t.seconds), 0)::integer as seconds,
             coalesce(sum(t.manual_seconds), 0)::integer as manual_seconds
        from app.memberships m
        left join app.daily_totals t
          on t.user_id = m.user_id and t.day between v_week and v_today
       where not app.groups_locked(m.user_id)
       group by m.group_id, m.user_id
    ) w
  on conflict (group_id, period, period_start, user_id) do update
    set rank = excluded.rank, seconds = excluded.seconds,
        manual_seconds = excluded.manual_seconds, computed_at = excluded.computed_at;

  -- Left or locked between refreshes: never shown.
  delete from app.leaderboard_cache c
   where app.groups_locked(c.user_id)
      or not exists (select 1 from app.memberships m where m.group_id = c.group_id and m.user_id = c.user_id);
end
$$;

create or replace function app.log_destruction(p_category text, p_rows integer, p_method text)
returns void
language sql
set search_path = ''
as $$
  insert into audit.destruction_log (category, rows_deleted, method)
  select p_category, p_rows, p_method where p_rows > 0
$$;

-- Daily retention purge.
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

revoke all on function app.refresh_leaderboards() from public, anon, authenticated;
revoke all on function app.purge_expired() from public, anon, authenticated;
revoke all on function app.log_destruction(text, integer, text) from public, anon, authenticated;

-- pg_cron ships with the Supabase Postgres image (local and self-hosted). Times are UTC:
-- 00:30 UTC = 03:30 Istanbul.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('etut-leaderboards', '*/5 * * * *', 'select app.refresh_leaderboards()');
    perform cron.schedule('etut-purge', '30 0 * * *', 'select app.purge_expired()');
  else
    raise warning 'pg_cron is not available: leaderboard refresh and purge jobs are NOT scheduled';
  end if;
end
$$;
