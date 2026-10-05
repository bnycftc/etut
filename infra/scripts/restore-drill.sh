#!/usr/bin/env bash
# Restore drill (do it in the first week, then every 3 months — hukuk/kvkk/09 §8 manual check).
# Restores the latest pgBackRest backup + WAL into a SEPARATE scratch container on this server
# and checks it, without touching the live database. A real disaster restore is described in
# infra/README.md "Felaket: yeni sunucuya geri yükleme".
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
SCRATCH=/var/lib/etut/restore-drill
IMAGE=etut/postgres-pgbackrest:17.6.1.136
PGUID=$(docker run --rm --entrypoint id "$IMAGE" -u postgres)

rm -rf "$SCRATCH"
install -d -m 700 "$SCRATCH/data"
chown -R "$PGUID" "$SCRATCH"

echo "1/4 restore latest backup + WAL into $SCRATCH/data"
docker run --rm -u postgres \
  -v /etc/etut/pgbackrest:/etc/pgbackrest:ro \
  -v "$SCRATCH/data:/var/lib/postgresql/data" \
  --entrypoint pgbackrest "$IMAGE" --stanza=etut --delta --type=default --archive-mode=off restore

echo "2/4 start the restored copy (no network, archiving off)"
# The data directory's own postgresql.conf is used (the live config needs the db-config volume);
# extensions that need preloading (pg_cron) stay idle, which is fine for checking the data.
docker run -d --name etut-restore-drill --network none -u postgres \
  -v "$SCRATCH/data:/var/lib/postgresql/data" \
  --entrypoint postgres "$IMAGE" -D /var/lib/postgresql/data -c archive_mode=off -c listen_addresses='' >/dev/null
trap 'docker rm -f etut-restore-drill >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do
  docker exec etut-restore-drill pg_isready -h /var/run/postgresql >/dev/null 2>&1 && break
  sleep 2
done

echo "3/4 compare row counts with the live database"
q="select 'profiles', count(*) from app.profiles union all select 'groups', count(*) from app.groups
   union all select 'study_sessions', count(*) from app.study_sessions union all select 'audit.events', count(*) from audit.events"
docker exec etut-restore-drill psql -h /var/run/postgresql -U supabase_admin -d postgres -tA -c "$q" > "$SCRATCH/restored.txt"
(cd /opt/etut/supabase && docker compose exec -T db psql -U supabase_admin -d postgres -tA -c "$q") > "$SCRATCH/live.txt"
paste "$SCRATCH/live.txt" "$SCRATCH/restored.txt"
echo "(restored counts may be slightly lower: they end at the last archived WAL segment)"

echo "4/4 restic: list snapshots and restore one file to a temp dir"
set -a; . /etc/etut/secrets/restic.env; set +a
restic snapshots --tag etut --latest 3
restic restore latest --tag etut --target "$SCRATCH/files" --include /etc/caddy/Caddyfile
ls -l "$SCRATCH/files/etc/caddy/Caddyfile"

echo "Drill done. Write the date and the result into the destruction/ops log, then:"
echo "  rm -rf $SCRATCH"
