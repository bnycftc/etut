-- Operator alerts (K-28: reports reviewed within 24 hours, K-29: a 'danger' report starts the
-- emergency procedure at once). infra/scripts/alert.sh polls this every 2 minutes over psql on
-- the server and sends the three numbers to the operator (ntfy on the same server + mail).
--
-- Counts only: no report id, nickname, group name or reason text leaves the database through
-- this function, so the alert channel never carries personal data. Not an RPC: it lives in
-- `app` (not exposed by PostgREST) and no role may execute it; only the operator's superuser
-- session (psql over SSH) can call it.

create or replace function app.report_alert_counts()
returns table (open_danger integer, open_over_12h integer, open_over_24h integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where r.reason = 'danger')::integer,
         count(*) filter (where r.created_at < now() - interval '12 hours')::integer,
         count(*) filter (where r.created_at < now() - interval '24 hours')::integer
    from app.reports r
   where r.status = 'open'
$$;

comment on function app.report_alert_counts() is
  'Open danger reports, open reports older than 12 h and older than 24 h. Counts only (alert.sh).';

revoke all on function app.report_alert_counts() from public, anon, authenticated, service_role;
