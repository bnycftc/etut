#!/usr/bin/env bash
# Health check (etut-health.timer, every 5 minutes; also by hand). Prints one line per check and
# exits non-zero when something needs attention. Carries no personal data.
set -uo pipefail
# shellcheck source=/dev/null
. /etc/etut/etut.conf
fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

# Containers healthy.
cd /opt/etut/supabase
unhealthy=$(docker compose ps --format json | jq -r 'select(.Health != "" and .Health != "healthy") | .Service' 2>/dev/null)
[ -z "$unhealthy" ] && ok "supabase containers healthy" || bad "unhealthy: $unhealthy"
if [ -f /opt/etut/glitchtip/compose.yml ]; then
  (cd /opt/etut/glitchtip && docker compose ps --status running --quiet | grep -q .) && ok "glitchtip running" || bad "glitchtip not running"
fi

# Public endpoint through Caddy + TLS, and the Auth service behind it.
curl -fsS --max-time 10 "https://${ETUT_API_HOST}/saglik" >/dev/null && ok "https endpoint" || bad "https endpoint"
ANON=$(grep '^ANON_KEY=' /opt/etut/supabase/.env | cut -d= -f2-)
curl -fsS --max-time 10 -H "apikey: ${ANON}" "http://127.0.0.1:8000/auth/v1/health" >/dev/null && ok "auth health" || bad "auth health"
unset ANON

# Nothing but 22/80/443 listens on public addresses.
public=$(ss -Htlpn | awk '{print $4}' | grep -vE '^(127\.0\.0\.1|\[::1\]):' | grep -vE ':(22|80|443)$' || true)
[ -z "$public" ] && ok "no unexpected public ports" || bad "public ports: $public"

# Certificate valid for at least 14 more days.
end=$(echo | openssl s_client -servername "$ETUT_API_HOST" -connect "${ETUT_API_HOST}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ] && [ $(( $(date -d "$end" +%s) - $(date +%s) )) -gt $(( 14 * 86400 )) ]; then ok "certificate until $end"; else bad "certificate expiry: ${end:-unknown}"; fi

# Disk and memory.
disk=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "$disk" -lt 80 ] && ok "disk ${disk}%" || bad "disk ${disk}%"
mem=$(free | awk '/Mem:/ {printf "%d", $7 / $2 * 100}')
[ "$mem" -gt 10 ] && ok "available memory ${mem}%" || bad "available memory ${mem}%"

# Backups: last nightly run < 26 h, WAL archiving working.
if [ -f /var/lib/etut/last-backup-ok ] && [ $(( $(date +%s) - $(date -d "$(cat /var/lib/etut/last-backup-ok)" +%s) )) -lt $(( 26 * 3600 )) ]; then
  ok "backup $(cat /var/lib/etut/last-backup-ok)"
else
  bad "no successful backup in 26 h"
fi
archived=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
  "select coalesce(extract(epoch from now() - last_archived_time)::int, -1) || ' ' || failed_count from pg_stat_archiver" 2>/dev/null)
age=${archived%% *}
[ -n "$age" ] && [ "$age" -ge 0 ] && [ "$age" -lt 900 ] && ok "WAL archived ${age}s ago (failed total: ${archived#* })" || bad "WAL archive: ${archived:-unknown}"

# pg_cron jobs ran recently (leaderboards every 5 min).
lb=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
  "select coalesce(extract(epoch from now() - max(end_time))::int, -1) from cron.job_run_details d join cron.job j using (jobid) where j.jobname = 'etut-leaderboards' and d.status = 'succeeded'" 2>/dev/null)
[ -n "$lb" ] && [ "$lb" -ge 0 ] && [ "$lb" -lt 900 ] && ok "leaderboard job ${lb}s ago" || bad "leaderboard job: ${lb:-unknown}"

exit $fail
