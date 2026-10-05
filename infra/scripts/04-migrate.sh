#!/usr/bin/env bash
# Applies the Etüt migrations (supabase/migrations/*.sql of this repository) to the self-hosted
# database, in order, each once. Applied files are recorded in ops.migrations.
#
#   sudo bash infra/scripts/04-migrate.sh            # from the repository checkout on the server
#
# This is the ONLY way migrations reach production. Do not mix in `supabase db push`: it keeps
# its own list (supabase_migrations.schema_migrations) and would try to apply everything again.
#
# Migrations run as `postgres`, the same role as locally (supabase CLI, PGlite tests), so every
# table and SECURITY DEFINER function is owned by postgres there too — not by the superuser
# supabase_admin, which would give every RPC superuser rights the tests never exercised.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd /opt/etut/supabase

psql_db() { docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

psql_db -c "create schema if not exists ops;
            revoke all on schema ops from public, anon, authenticated;
            create table if not exists ops.migrations (name text primary key, applied_at timestamptz not null default now());"

for file in "$REPO"/supabase/migrations/*.sql; do
  name=$(basename "$file")
  if [ "$(psql_db -tAc "select 1 from ops.migrations where name = '$name'")" = "1" ]; then
    echo "skip  $name"
    continue
  fi
  echo "apply $name"
  { echo 'begin;'; cat "$file"; echo; echo "insert into ops.migrations (name) values ('$name');"; echo 'commit;'; } | psql_db -q
done

# pg_cron jobs must exist (leaderboards every 5 minutes, purge daily).
psql_db -tAc "select jobname || ' ' || schedule from cron.job where jobname like 'etut-%' order by 1"
