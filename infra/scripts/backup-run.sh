#!/usr/bin/env bash
# Nightly backup (etut-backup.timer):
#   1. pgBackRest differential backup (full on Sundays); WAL is archived continuously anyway.
#   2. GlitchTip database dump.
#   3. restic snapshot of configuration, certificates, access logs and the dump; 30-day cycle.
set -euo pipefail
SECRETS=/etc/etut/secrets
STAGE=/var/lib/etut/backup-stage
install -d -m 700 "$STAGE"

cd /opt/etut/supabase
if [ "$(date -u +%u)" = "7" ]; then type=full; else type=diff; fi
docker compose exec -T -u postgres db pgbackrest --stanza=etut --type="$type" backup
docker compose exec -T -u postgres db pgbackrest --stanza=etut expire

if [ -f /opt/etut/glitchtip/compose.yml ]; then
  (cd /opt/etut/glitchtip && docker compose exec -T postgres pg_dump -U glitchtip -Fc glitchtip) > "$STAGE/glitchtip.dump"
fi

set -a; . "$SECRETS/restic.env"; set +a
restic backup --tag etut --exclude-caches \
  /etc/etut /etc/caddy /var/lib/caddy /var/log/caddy \
  /opt/etut/supabase/.env /opt/etut/supabase/docker-compose.override.yml /opt/etut/supabase/ETUT_IMAGE_DIGESTS \
  /opt/etut/glitchtip/.env /opt/etut/glitchtip/compose.yml \
  "$STAGE"
# kvkk/09 §7: backups on a 30-day cycle. Access logs live 400 days on the server itself.
restic forget --tag etut --keep-within 30d --prune
rm -f "$STAGE/glitchtip.dump"
date -u +%FT%TZ > /var/lib/etut/last-backup-ok
