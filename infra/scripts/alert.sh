#!/usr/bin/env bash
# Operator alerts (etut-alert.timer, every 2 minutes; K-28 review within 24 h, K-29 emergency
# procedure). Counts only: no nickname, group name or report id ever leaves the database here.
#
# Sends when
#   - anything changes: open danger reports, open reports older than 12 h, older than 24 h
#     (app.report_alert_counts()), failed health checks (healthcheck.sh writes health-status);
#     a report passing 24 h and a healthcheck FAIL are changes, so they are sent at once
#   - every hour while a danger report is open
# Channels: ntfy on this server (ETUT_NTFY_HOST, 09-ntfy.sh) and mail through msmtp. One working
# channel is enough; when both fail the state is not advanced and the next run tries again.
#
# Usage: alert.sh          one run (the timer)
#        alert.sh --test   send a test message through both channels; fails if either fails
#
# The ETUT_* variables below only exist for the stubbed test in .github/workflows/infra.yml.
set -euo pipefail

CONF=${ETUT_CONF:-/etc/etut/etut.conf}
STATE_DIR=${ETUT_STATE_DIR:-/var/lib/etut}
SECRETS=${ETUT_SECRETS:-/etc/etut/secrets}
SUPABASE_DIR=${ETUT_SUPABASE_DIR:-/opt/etut/supabase}
NOW=${ETUT_NOW:-$(date +%s)}
# shellcheck source=/dev/null
. "$CONF"
NTFY_URL=${ALERT_NTFY_URL:-http://127.0.0.1:2586}
NTFY_TOPIC=${ETUT_NTFY_TOPIC:-etut-uyari}
REPEAT_DANGER=3600      # seconds between reminders while a danger report is open
HEALTH_MAX_AGE=900      # healthcheck.sh runs every 5 minutes; older than this = not running
STATE="$STATE_DIR/alert-state"

case "${1:-}" in
  "" | --test) ;;
  *) echo "Usage: $0 [--test]"; exit 2 ;;
esac

# "danger over12h over24h", or "x x x" when the database cannot be read.
counts() {
  local out
  out=$(cd "$SUPABASE_DIR" && docker compose exec -T db psql -X -U supabase_admin -d postgres -tA -F ' ' \
    -c 'select * from app.report_alert_counts()' 2>/dev/null) || out=""
  if [[ "$out" =~ ^[0-9]+\ [0-9]+\ [0-9]+$ ]]; then echo "$out"; else echo "x x x"; fi
}

# Number of failed health checks, or "stale" when healthcheck.sh has not reported recently.
health() {
  local at n
  if [ -r "$STATE_DIR/health-status" ] && read -r at n < "$STATE_DIR/health-status" \
    && [[ "$at" =~ ^[0-9]+$ && "$n" =~ ^[0-9]+$ ]] && [ $((NOW - at)) -le "$HEALTH_MAX_AGE" ]; then
    echo "$n"
  else
    echo stale
  fi
}

json_str() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  printf '"%s"' "$s"
}

# Sets title, prio (ntfy 1-5), tags and body from D, W12, W24, H and the reason ($1).
compose() {
  local reason=$1 hline
  if [ "$reason" = test ]; then
    title="Etüt: deneme bildirimi"; prio=3; tags="test_tube"
  elif [ "$D" = x ]; then
    title="Etüt: rapor sayıları okunamadı"; prio=4; tags="warning"
  elif [ "$D" -gt 0 ]; then
    title="Etüt ACİL: açık danger raporu ($D)"; prio=5; tags="rotating_light"
  elif [ "$W24" -gt 0 ]; then
    title="Etüt: 24 saati geçen rapor ($W24)"; prio=5; tags="warning"
  elif [ "$W12" -gt 0 ]; then
    title="Etüt: 12 saati geçen rapor ($W12)"; prio=4; tags="hourglass"
  elif [ "$H" != 0 ]; then
    title="Etüt: sağlık denetimi"; prio=4; tags="warning"
  else
    title="Etüt: açık uyarı kalmadı"; prio=2; tags="white_check_mark"
  fi
  case "$H" in
    0) hline="Sağlık denetimi: sorun yok" ;;
    stale) hline="Sağlık denetimi: 15 dakikadır sonuç yok (etut-health çalışmıyor)" ;;
    *) hline="Sağlık denetimi: $H FAIL (journalctl -u etut-health)" ;;
  esac
  if [ "$D" = x ]; then
    body="Rapor sayıları okunamadı (veritabanı?)."$'\n'"$hline"
  else
    body="Açık danger raporu: $D"$'\n'"12 saati geçen açık rapor: $W12"$'\n'"24 saati geçen açık rapor: $W24"$'\n'"$hline"
  fi
  case "$reason" in
    test) body="Uyarı kanalı çalışıyor."$'\n'"$body" ;;
    hourly) body="Hatırlatma: danger raporu hâlâ açık. K-29 acil durum adımları."$'\n'"$body" ;;
  esac
  body="$body"$'\n'"SSH ile bak: sudo /opt/etut/bin/reports.sh"
}

send_ntfy() {
  local pwfile="$SECRETS/ntfy-alert-password"
  [ -r "$pwfile" ] || { echo "ntfy: not configured ($pwfile missing; run 09-ntfy.sh)"; return 2; }
  printf '{"topic":%s,"title":%s,"message":%s,"priority":%d,"tags":[%s]}' \
    "$(json_str "$NTFY_TOPIC")" "$(json_str "$title")" "$(json_str "$body")" "$prio" "$(json_str "$tags")" |
    curl -fsS --max-time 20 -o /dev/null -K <(printf 'user = "alert:%s"\n' "$(cat "$pwfile")") \
      -H 'Content-Type: application/json' --data-binary @- "$NTFY_URL/"
}

send_mail() {
  [ -n "${ALERT_MAIL_TO:-}" ] || { echo "mail: not configured (ALERT_MAIL_TO empty)"; return 2; }
  command -v msmtp >/dev/null || { echo "mail: msmtp missing (run 09-ntfy.sh)"; return 2; }
  printf 'From: %s\nTo: %s\nSubject: =?UTF-8?B?%s?=\nDate: %s\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\n\n%s\n' \
    "${ALERT_MAIL_FROM:-$ALERT_MAIL_TO}" "$ALERT_MAIL_TO" "$(printf '%s' "$title" | base64 -w0)" "$(date -R)" "$body" |
    timeout 60 msmtp -a default "$ALERT_MAIL_TO"
}

# Prints the number of channels that delivered.
deliver() {
  local sent=0
  if send_ntfy >&2; then sent=$((sent + 1)); echo "ntfy: sent" >&2; else echo "ntfy: FAILED" >&2; fi
  if send_mail >&2; then sent=$((sent + 1)); echo "mail: sent" >&2; else echo "mail: FAILED" >&2; fi
  echo "$sent"
}

read -r D W12 W24 <<< "$(counts)"
H=$(health)
sig="$D $W12 $W24 $H"
install -d -m 755 "$STATE_DIR"
echo "$NOW" > "$STATE_DIR/alert-last-run"   # healthcheck.sh: the timer is alive

if [ "${1:-}" = --test ]; then
  compose test
  echo "test: $sig"
  [ "$(deliver)" = 2 ] || { echo "test: a channel failed"; exit 1; }
  exit 0
fi

prev_sig=""
prev_sent=0
if [ -r "$STATE" ]; then
  read -r a b c d e < "$STATE" || true
  prev_sig="${a:-} ${b:-} ${c:-} ${d:-}"
  [[ "${e:-}" =~ ^[0-9]+$ ]] && prev_sent=$e
fi

reason=""
if [ "$sig" != "$prev_sig" ]; then
  if [ ! -e "$STATE" ] && [ "$sig" = "0 0 0 0" ]; then
    echo "$sig $NOW" > "$STATE"   # first run, nothing open: nothing to say
    exit 0
  fi
  reason=change
elif [[ "$D" =~ ^[0-9]+$ ]] && [ "$D" -gt 0 ] && [ $((NOW - prev_sent)) -ge "$REPEAT_DANGER" ]; then
  reason=hourly
fi
[ -n "$reason" ] || exit 0

compose "$reason"
echo "$reason: $sig (was: ${prev_sig:-none})"
if [ "$(deliver)" -eq 0 ]; then
  echo "no channel delivered; retrying on the next run"
  exit 1
fi
echo "$sig $NOW" > "$STATE.tmp"
mv "$STATE.tmp" "$STATE"
