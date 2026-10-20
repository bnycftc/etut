#!/usr/bin/env bash
# Health check (etut-health.timer, every 5 minutes; also by hand). Prints one line per check and
# exits non-zero when something needs attention. Carries no personal data. Writes the number of
# failed system checks to /var/lib/etut/health-status; alert.sh (etut-alert.timer) sends it.
set -uo pipefail
# shellcheck source=/dev/null
. /etc/etut/etut.conf
fail=0
nfail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; nfail=$((nfail + 1)); }

# Containers healthy.
cd /opt/etut/supabase || { echo "FAIL /opt/etut/supabase missing"; exit 1; }
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

# Operator alerts (K-28, K-29): ntfy up on loopback and behind Caddy, alert.sh ran recently.
if [ -n "${ETUT_NTFY_HOST:-}" ]; then
  curl -fsS --max-time 5 http://127.0.0.1:2586/v1/health >/dev/null && ok "ntfy" || bad "ntfy not answering on 127.0.0.1:2586"
  curl -fsS --max-time 10 "https://${ETUT_NTFY_HOST}/v1/health" >/dev/null && ok "ntfy https endpoint" || bad "ntfy https endpoint"
else
  bad "alert channel not configured (ETUT_NTFY_HOST; run 09-ntfy.sh)"
fi
last_alert=$(cat /var/lib/etut/alert-last-run 2>/dev/null || echo 0)
[ $(( $(date +%s) - ${last_alert:-0} )) -lt 600 ] && ok "alert timer ran $(( $(date +%s) - last_alert ))s ago" || bad "alert timer not running (etut-alert.timer)"

# State for alert.sh: time and number of failed system checks. The report counts below are sent
# by alert.sh itself, so they are not part of this number.
install -d -m 755 /var/lib/etut
echo "$(date +%s) $nfail" > /var/lib/etut/health-status.tmp && mv /var/lib/etut/health-status.tmp /var/lib/etut/health-status

# Moderation (K-28, K-29): open reports waiting more than 12 hours, and any open 'danger' report
# (threat / self-harm: the emergency procedure starts at once). Counts only, no personal data.
# alert.sh sends the same counts to the operator; review and close with
# `sudo /opt/etut/bin/reports.sh` in an SSH session.
reports=$(docker compose exec -T db psql -U supabase_admin -d postgres -tA -F ' ' \
  -c "select open_danger, open_over_12h, open_over_24h from app.report_alert_counts()" 2>/dev/null)
read -r danger waiting overdue <<< "${reports:-? ? ?}"
if [ "${waiting:-x}" = "0" ] && [ "${danger:-x}" = "0" ]; then
  ok "no report waiting"
else
  echo "FAIL open reports: ${waiting:-?} older than 12 h (${overdue:-?} older than 24 h), ${danger:-?} danger"
  fail=1
fi

exit $fail
