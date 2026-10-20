-- Etüt backend: account code, deletion records, deletion by code (K-37; hukuk/kvkk/07 A Yol 2,
-- B5, C3). Additive or CREATE OR REPLACE; earlier migrations stay untouched.
--
--   app.account_codes        one permanent 12-character code per account, shown in the app. Only
--                            its SHA-256 is stored (app.account_code_hash); the plain code exists
--                            only in the RPC result and on the student's phone. It identifies the
--                            account when the app is gone: the student e-mails the code and the
--                            operator deletes with app.delete_by_account_code (psql over SSH:
--                            infra/scripts/delete-by-code.sh). Goes with the account (cascade).
--   my_account_code()        the caller's code: created on the first call and returned once;
--                            later calls return only its date (the server cannot show it again).
--                            p_renew = true replaces it (lost on the phone); the old one stops
--                            working.
--   audit.deletion_records   account id, requested_at, deleted_at, method of every deletion on
--                            request (Silme Yönetmeliği m.7/3; kvkk/07 B5): kept 3 years, then
--                            removed by the daily purge. In `audit`, like the 5651 records: the
--                            documented exception that outlives the account (06_account_deletion
--                            checks that `app` keeps no trace of a deleted account). Append only.
--   app.delete_account()     the body of delete_my_account, shared by every deletion on request
--                            (in the app, by account code, a parent's objection in WP-I). It
--                            writes the deletion record; everything else is unchanged.
--
-- Methods in audit.deletion_records: 'in_app' (delete_my_account), 'account_code' (operator, by
-- e-mailed code); WP-I adds its own. Lower-case word, checked by format only.

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------

create table app.account_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash bytea not null unique check (octet_length(code_hash) = 32),
  created_at timestamptz not null default now()
);

create table audit.deletion_records (
  id bigint generated always as identity primary key,
  -- No foreign key: the account is gone; this is the random account number only (no nickname).
  account_id uuid not null,
  requested_at timestamptz not null,
  deleted_at timestamptz not null default now(),
  method text not null check (method ~ '^[a-z][a-z_]{1,39}$'),
  check (requested_at <= deleted_at)
);
create index deletion_records_deleted_at on audit.deletion_records (deleted_at);

create trigger deletion_records_protect before update or delete on audit.deletion_records
for each row execute function audit.protect();

alter table app.account_codes enable row level security;
alter table audit.deletion_records enable row level security;
revoke all on app.account_codes from public, anon, authenticated;
revoke all on audit.deletion_records from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Account code
-- ---------------------------------------------------------------------------------------------

-- 12 characters from the alphabet of app.random_code (no 0/O/1/I; 32 symbols, so byte % 32 is
-- unbiased): 60 bits.
create or replace function app.random_account_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_code text := '';
begin
  for i in 0..11 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end
$$;

-- What is stored instead of the code. Typed by people: case, spaces and dashes are ignored.
create or replace function app.account_code_hash(p_code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest('etut-account-code:' || app.normalize_code(p_code), 'sha256')
$$;

-- The caller's code. code = null: issued earlier (created_at), the server cannot show it again.
create or replace function public.my_account_code(p_renew boolean default false)
returns table (code text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.me();
  v_code text := app.random_account_code();
  v_created timestamptz;
begin
  if coalesce(p_renew, false) then
    insert into app.account_codes as a (user_id, code_hash)
    values (v_me, app.account_code_hash(v_code))
    on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now()
    returning a.created_at into v_created;
    return query select v_code, v_created;
    return;
  end if;
  insert into app.account_codes as a (user_id, code_hash)
  values (v_me, app.account_code_hash(v_code))
  on conflict (user_id) do nothing
  returning a.created_at into v_created;
  if v_created is not null then
    return query select v_code, v_created;
  else
    return query select null::text, a.created_at from app.account_codes a where a.user_id = v_me;
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Deletion on request
-- ---------------------------------------------------------------------------------------------

-- The body of delete_my_account (round3) for any account, plus the deletion record. Returns
-- whether the account existed. Callers check who may delete; this function does not.
create or replace function app.delete_account(p_user uuid, p_method text, p_requested_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  if p_user is null then
    raise exception 'delete_account: no account';
  end if;
  perform app.log('account_deleted', p_user);
  -- Other people's rate-limit rows that name this person (reactions sent to them).
  delete from app.rate_events e where e.subject = p_user;
  perform app.purge_auth_audit(p_user);
  perform set_config('etut.link_end', 'child_deleted_account', true);
  delete from auth.users u where u.id = p_user;
  v_found := found;
  perform set_config('etut.link_end', '', true);
  insert into audit.destruction_log (category, rows_deleted, method)
  values ('account_on_request', 1, 'delete cascade');
  if v_found then
    insert into audit.deletion_records (account_id, requested_at, method)
    values (p_user, coalesce(p_requested_at, now()), p_method);
  end if;
  return v_found;
end
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.delete_account(app.me(), 'in_app');
end
$$;

-- Operator only (psql over SSH, infra/scripts/delete-by-code.sh): deletes the account whose code
-- was e-mailed. p_requested_at = when the e-mail arrived. Returns the deleted account's id, or
-- null when no account has this code (nothing is deleted).
create or replace function app.delete_by_account_code(p_code text, p_requested_at timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select a.user_id into v_user from app.account_codes a where a.code_hash = app.account_code_hash(p_code);
  if v_user is null then
    return null;
  end if;
  perform app.delete_account(v_user, 'account_code', p_requested_at);
  return v_user;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Retention: deletion records 3 years (Silme Yönetmeliği m.7/3)
-- ---------------------------------------------------------------------------------------------

create or replace function app.purge_deletion_records()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform set_config('etut.purge', 'on', true);
  delete from audit.deletion_records r where r.deleted_at < now() - interval '3 years';
  get diagnostics n = row_count;
  perform set_config('etut.purge', 'off', true);
  perform app.log_destruction('deletion_records', n, 'delete');
  return n;
end
$$;

-- The daily job keeps calling app.purge_expired() (pg_cron 'etut-purge'). Instead of copying its
-- whole body once more (other migrations of the same release replace it too), the version in
-- place is kept under another name and the new app.purge_expired() runs it, then this purge. A
-- later migration that replaces app.purge_expired() must keep both calls:
-- 10_account_code.test.sql checks that the daily purge removes old deletion records.
alter function app.purge_expired() rename to purge_expired_before_account_code;

create function app.purge_expired()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.purge_expired_before_account_code();
  perform app.purge_deletion_records();
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants (see step 6, section 12)
-- ---------------------------------------------------------------------------------------------

revoke all on function app.random_account_code() from public, anon, authenticated;
revoke all on function app.account_code_hash(text) from public, anon, authenticated;
revoke all on function app.delete_account(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function app.delete_by_account_code(text, timestamptz) from public, anon, authenticated;
revoke all on function app.purge_deletion_records() from public, anon, authenticated;
revoke all on function app.purge_expired_before_account_code() from public, anon, authenticated;
revoke all on function app.purge_expired() from public, anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on function public.my_account_code(boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
