#!/usr/bin/env bash
# Dry run of alert.sh's state machine (.github/workflows/infra.yml; also locally: bash this file).
# psql (docker compose exec), curl and msmtp are stubs; nothing leaves the machine.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ALERT="$HERE/../scripts/alert.sh"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/state" "$T/secrets" "$T/supabase"

PW=Zq7alertTestPassword9
printf '%s' "$PW" > "$T/secrets/ntfy-alert-password"
cat > "$T/etut.conf" <<'EOF'
ETUT_NTFY_TOPIC=etut-uyari
ALERT_MAIL_TO=ops@example.test
ALERT_MAIL_FROM=uyari@example.test
EOF

# docker compose exec ... psql: prints the canned counts, or fails like an unreachable database.
cat > "$T/bin/docker" <<EOF
#!/usr/bin/env bash
[ "\$(cat "$T/counts")" = fail ] && exit 1
cat "$T/counts"
EOF
# curl: records its argv and the JSON body, checks the credentials came through -K, not argv.
cat > "$T/bin/curl" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$T/argv.log"
while [ \$# -gt 0 ]; do
  if [ "\$1" = -K ]; then grep -q '^user = "alert:' "\$2" && echo ok > "$T/auth"; shift; fi
  shift
done
cat > "$T/last-ntfy.json"
echo ntfy >> "$T/calls"
exit "\$(cat "$T/curl_rc" 2>/dev/null || echo 0)"
EOF
cat > "$T/bin/msmtp" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$T/argv.log"
cat > "$T/last-mail.txt"
echo mail >> "$T/calls"
exit "\$(cat "$T/msmtp_rc" 2>/dev/null || echo 0)"
EOF
chmod +x "$T/bin/"*
export PATH="$T/bin:$PATH" ETUT_CONF="$T/etut.conf" ETUT_STATE_DIR="$T/state" \
  ETUT_SECRETS="$T/secrets" ETUT_SUPABASE_DIR="$T/supabase"

now=1800000000
pass=0
failed=0
# run <counts> [health fails | stale] [--test]
run() {
  : > "$T/calls"
  rm -f "$T/auth" "$T/last-ntfy.json"
  echo "$1" > "$T/counts"
  if [ "${2:-0}" = stale ]; then echo "$((now - 3600)) 0"; else echo "$now ${2:-0}"; fi > "$T/state/health-status"
  rc=0
  out=$(ETUT_NOW=$now bash "$ALERT" ${3:+"$3"} 2>&1) || rc=$?
  sends=$(xargs < "$T/calls")
}
# expect <name> <channels that sent> <exit code> [text the ntfy title must contain]
expect() {
  local title=""
  [ -f "$T/last-ntfy.json" ] && title=$(sed -n 's/.*"title":"\([^"]*\)".*/\1/p' "$T/last-ntfy.json")
  if [ "$sends" = "$2" ] && [ "$rc" = "$3" ] && { [ -z "${4:-}" ] || [[ "$title" == *"$4"* ]]; }; then
    pass=$((pass + 1)); echo "ok   - $1"
  else
    failed=$((failed + 1)); echo "FAIL - $1: sent '$sends' (want '$2'), exit $rc (want $3), title '$title'"
    printf '%s\n' "$out" | sed 's/^/       /'
  fi
}
tick() { now=$((now + $1)); }

run "0 0 0"; expect "first run with nothing open stays silent" "" 0
tick 120; run "0 0 0"; expect "no change, no message" "" 0
tick 120; run "1 0 0"; expect "a danger report is sent at once on both channels" "ntfy mail" 0 "ACİL"
grep -q '"priority":5' "$T/last-ntfy.json" && expect "danger is priority 5" "ntfy mail" 0 || { failed=$((failed + 1)); echo "FAIL - danger priority"; }
[ -f "$T/auth" ] && expect "ntfy gets the alert user through curl -K" "ntfy mail" 0 || { failed=$((failed + 1)); echo "FAIL - no -K credentials"; }
tick 120; run "1 0 0"; expect "same danger 2 minutes later: silent" "" 0
tick 3360; run "1 0 0"; expect "59 minutes after the last message: still silent" "" 0
tick 240; run "1 0 0"; expect "an hour after the last message: reminder" "ntfy mail" 0 "ACİL"
grep -q 'Hatırlatma' "$T/last-ntfy.json" && expect "the reminder says so" "ntfy mail" 0 || { failed=$((failed + 1)); echo "FAIL - reminder text"; }
tick 120; run "1 1 0"; expect "a report passes 12 h: sent" "ntfy mail" 0
tick 120; run "1 1 1"; expect "a report passes 24 h: sent" "ntfy mail" 0
tick 120; run "0 1 1"; expect "danger closed: sent" "ntfy mail" 0 "24 saati"
tick 3700; run "0 1 1"; expect "no hourly reminder without a danger report" "" 0
tick 120; run "0 0 0"; expect "all closed: one all-clear message" "ntfy mail" 0 "kalmadı"
tick 120; run "0 0 0" 2; expect "healthcheck FAIL is sent" "ntfy mail" 0 "sağlık"
tick 120; run "0 0 0" 2; expect "same FAIL count: silent" "" 0
tick 120; run "0 0 0" stale; expect "healthcheck stopped reporting: sent" "ntfy mail" 0 "sağlık"
tick 120; run "fail" 0; expect "database unreadable: sent" "ntfy mail" 0 "okunamadı"
tick 120; echo 7 > "$T/curl_rc"; echo 1 > "$T/msmtp_rc"
run "1 0 0"; expect "both channels down: exit 1" "ntfy mail" 1
tick 120; run "1 0 0"; expect "state not advanced, so the next run tries again" "ntfy mail" 1
tick 120; echo 0 > "$T/msmtp_rc"; run "1 0 0"; expect "one channel is enough" "ntfy mail" 0
tick 120; echo 0 > "$T/curl_rc"; run "1 0 0"; expect "and then it is silent again" "" 0
tick 120; cp "$T/state/alert-state" "$T/before"
run "1 0 0" 0 --test; expect "--test sends on both channels" "ntfy mail" 0 "deneme"
cmp -s "$T/before" "$T/state/alert-state" && expect "--test leaves the state alone" "ntfy mail" 0 || { failed=$((failed + 1)); echo "FAIL - --test changed the state"; }
echo 7 > "$T/curl_rc"; run "1 0 0" 0 --test; expect "--test fails when a channel fails" "ntfy mail" 1
echo 0 > "$T/curl_rc"

# Privacy: the password never in argv, counts only in what was sent.
if grep -qF "$PW" "$T/argv.log"; then failed=$((failed + 1)); echo "FAIL - password in argv"; else pass=$((pass + 1)); echo "ok   - password never in argv"; fi
if grep -qiE '[0-9a-f]{8}-[0-9a-f]{4}-' "$T/last-ntfy.json" "$T/last-mail.txt"; then
  failed=$((failed + 1)); echo "FAIL - an id in the message"
else
  pass=$((pass + 1)); echo "ok   - no id in the messages"
fi
grep -q '^Subject: =?UTF-8?B?' "$T/last-mail.txt" && grep -q 'Açık danger raporu: 1' "$T/last-mail.txt" \
  && { pass=$((pass + 1)); echo "ok   - mail: encoded subject, counts in the body"; } \
  || { failed=$((failed + 1)); echo "FAIL - mail format"; }

echo "$pass passed, $failed failed"
[ "$failed" -eq 0 ]
