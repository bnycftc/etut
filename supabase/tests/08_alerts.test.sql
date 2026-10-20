-- Operator alert counts (K-28, K-29): the three numbers alert.sh sends are right, and no client
-- role can read them (the function is for the operator's psql session only).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Nobody but the operator (superuser) may execute it.
select ok(not has_function_privilege('anon', 'app.report_alert_counts()', 'execute'),
  'anon cannot execute report_alert_counts');
select ok(not has_function_privilege('authenticated', 'app.report_alert_counts()', 'execute'),
  'authenticated cannot execute report_alert_counts');
select ok(not has_function_privilege('service_role', 'app.report_alert_counts()', 'execute'),
  'service_role cannot execute report_alert_counts');
select ok((select p.prosecdef from pg_proc p where p.oid = 'app.report_alert_counts()'::regprocedure),
  'report_alert_counts is security definer');

-- It returns numbers only: three integer columns, nothing that could name a person or a group.
select is(
  (select array_agg(format_type(t, null) order by i)
     from pg_proc p, unnest(p.proallargtypes) with ordinality as a(t, i)
    where p.oid = 'app.report_alert_counts()'::regprocedure),
  array['integer', 'integer', 'integer'],
  'the result is three integers');

select results_eq('select * from app.report_alert_counts()', $$ values (0, 0, 0) $$,
  'no report: all counts are zero');

-- Open: a fresh danger report, one 13 h old, one 25 h old, a danger report 26 h old.
-- Closed reports never count, however old or dangerous.
insert into app.reports (reason, status, created_at) values
  ('danger', 'open', now() - interval '5 minutes'),
  ('harassment', 'open', now() - interval '13 hours'),
  ('nickname', 'open', now() - interval '25 hours'),
  ('danger', 'open', now() - interval '26 hours'),
  ('other', 'open', now() - interval '11 hours'),
  ('danger', 'closed', now() - interval '30 hours'),
  ('group_name', 'closed', now() - interval '40 hours');

select results_eq('select * from app.report_alert_counts()', $$ values (2, 3, 2) $$,
  'open danger 2, older than 12 h 3, older than 24 h 2; closed reports are not counted');

update app.reports set status = 'closed', closed_at = now(), decision = 'no_action'
 where reason = 'danger' and status = 'open';
select results_eq('select * from app.report_alert_counts()', $$ values (0, 2, 1) $$,
  'closing the danger reports drops them from every count');

-- A client role is refused at run time too.
set local role authenticated;
select throws_ok('select * from app.report_alert_counts()', '42501', null,
  'authenticated is refused');
reset role;
set local role anon;
select throws_ok('select * from app.report_alert_counts()', '42501', null,
  'anon is refused');
reset role;

select * from finish();
rollback;
