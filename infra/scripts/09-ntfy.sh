#!/usr/bin/env bash
# Operator alert channel (K-28, K-29), fully domestic:
#   - ntfy at a pinned version on this server, 127.0.0.1:2586 only, behind Caddy at
#     ETUT_NTFY_HOST (bildirim.<alan>); no upstream (ntfy.sh, Firebase and APNs see nothing),
#     deny-all, user `alert` write-only and user `bny` read-only on ETUT_NTFY_TOPIC
#   - msmtp: the same alert by mail through a mailbox in Turkey (backup channel)
# Generates both ntfy passwords here and never prints them; asks once for the SMTP password.
# Safe to re-run. Run as root after 05-caddy.sh, then 08-timers.sh (installs alert.sh and
# etut-alert.timer) and `sudo /opt/etut/bin/alert.sh --test`.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
# shellcheck source=/dev/null
. /etc/etut/etut.conf
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS=/etc/etut/secrets

for v in ETUT_NTFY_HOST ETUT_NTFY_TOPIC ALERT_SMTP_HOST ALERT_SMTP_PORT ALERT_SMTP_USER ALERT_MAIL_FROM ALERT_MAIL_TO; do
  [ -n "${!v:-}" ] || { echo "Set $v in /etc/etut/etut.conf (see etut.conf.example)"; exit 1; }
done
[[ "$ETUT_NTFY_TOPIC" =~ ^[-_A-Za-z0-9]{1,64}$ ]] || { echo "ETUT_NTFY_TOPIC: letters, digits, - and _ only"; exit 1; }

# --- ntfy, pinned (sabit sürüm): release .deb checked against its SHA-256 ----------------------
NTFY_VERSION=2.28.0
ARCH=$(dpkg --print-architecture)
case "$ARCH" in
  amd64) NTFY_SHA256=48e95870ff4b1e30df8648f40e2d7f4a96956e93dc75fd07f770f726c1a4f2c5 ;;
  arm64) NTFY_SHA256=99b840da412bf0be75e20049b74ce488acab4ffb134fd18f02d8d0622548c9fa ;;
  *) echo "No pinned ntfy package for $ARCH"; exit 1 ;;
esac
# shellcheck disable=SC2016 # ${Version} is dpkg-query's format, not a shell variable
if [ "$(dpkg-query -W -f='${Version}' ntfy 2>/dev/null || true)" != "$NTFY_VERSION" ]; then
  deb=$(mktemp --suffix=.deb)
  curl -fsSL -o "$deb" \
    "https://github.com/binwiederhier/ntfy/releases/download/v${NTFY_VERSION}/ntfy_${NTFY_VERSION}_linux_${ARCH}.deb"
  echo "${NTFY_SHA256}  ${deb}" | sha256sum -c -
  # Our server.yml replaces the package's conffile; keep it on upgrades.
  dpkg -i --force-confold "$deb"
  rm -f "$deb"
fi

sed "s|<ETUT_NTFY_HOST>|${ETUT_NTFY_HOST}|" "$REPO_INFRA/ntfy/server.yml" > /etc/ntfy/server.yml.new
install -m 640 -o root -g ntfy /etc/ntfy/server.yml.new /etc/ntfy/server.yml
rm -f /etc/ntfy/server.yml.new
install -d -m 700 -o ntfy -g ntfy /var/lib/ntfy /var/cache/ntfy
systemctl daemon-reload
systemctl enable ntfy
systemctl restart ntfy
for _ in $(seq 1 15); do curl -fsS --max-time 2 http://127.0.0.1:2586/v1/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS --max-time 5 http://127.0.0.1:2586/v1/health >/dev/null || { echo "ntfy did not start: journalctl -u ntfy"; exit 1; }

# --- users and access: passwords generated here, kept in /etc/etut/secrets, never printed -----
umask 077
install -d -m 700 "$SECRETS"
for u in alert bny; do
  f="$SECRETS/ntfy-$u-password"
  [ -s "$f" ] || { openssl rand -base64 33 | tr -dc 'A-Za-z0-9' > "$f"; }
  chmod 600 "$f"
  # The password goes through the environment (ntfy's documented way for scripts), not argv.
  NTFY_PASSWORD="$(cat "$f")" runuser -u ntfy -- ntfy user add --role=user --ignore-exists "$u" >/dev/null
  NTFY_PASSWORD="$(cat "$f")" runuser -u ntfy -- ntfy user change-pass "$u" >/dev/null
done
runuser -u ntfy -- ntfy access alert "$ETUT_NTFY_TOPIC" write-only >/dev/null
runuser -u ntfy -- ntfy access bny "$ETUT_NTFY_TOPIC" read-only >/dev/null
runuser -u ntfy -- ntfy access

# --- Caddy: bildirim.<alan> (the main Caddyfile imports /etc/caddy/etut.d/*.caddy) ------------
install -d -m 755 /etc/caddy/etut.d
sed "s|<ETUT_NTFY_HOST>|${ETUT_NTFY_HOST}|" "$REPO_INFRA/ntfy/ntfy.caddy" > /etc/caddy/etut.d/ntfy.caddy
chmod 644 /etc/caddy/etut.d/ntfy.caddy
install -m 644 "$REPO_INFRA/caddy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile --envfile /etc/caddy/etut.env
systemctl reload caddy
curl -fsS --retry 10 --retry-delay 3 --retry-all-errors --max-time 10 "https://${ETUT_NTFY_HOST}/v1/health" >/dev/null \
  && echo "https://${ETUT_NTFY_HOST} works (TLS and Caddy)"
# deny-all: an anonymous reader and an anonymous publisher are both refused.
for method in GET POST; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" --max-time 10 \
    "https://${ETUT_NTFY_HOST}/${ETUT_NTFY_TOPIC}/json?poll=1" || true)
  case "$code" in 401 | 403) echo "anonymous $method refused ($code)" ;; *) echo "anonymous $method NOT refused ($code)"; exit 1 ;; esac
done

# --- mail backup: msmtp through the mailbox in Turkey ------------------------------------------
DEBIAN_FRONTEND=noninteractive apt-get install -y msmtp
if [ ! -s "$SECRETS/smtp-password" ]; then
  [ -t 0 ] || { echo "Run once in a terminal to enter the SMTP password"; exit 1; }
  read -r -s -p "SMTP password for ${ALERT_SMTP_USER} (not shown, stored in $SECRETS/smtp-password): " smtp_pw
  echo
  printf '%s' "$smtp_pw" > "$SECRETS/smtp-password"
  unset smtp_pw
fi
chmod 600 "$SECRETS/smtp-password"
if [ "$ALERT_SMTP_PORT" = 465 ]; then starttls=off; else starttls=on; fi
sed -e "s|<ALERT_SMTP_HOST>|${ALERT_SMTP_HOST}|" \
    -e "s|<ALERT_SMTP_PORT>|${ALERT_SMTP_PORT}|" \
    -e "s|<ALERT_SMTP_STARTTLS>|${starttls}|" \
    -e "s|<ALERT_MAIL_FROM>|${ALERT_MAIL_FROM}|" \
    -e "s|<ALERT_SMTP_USER>|${ALERT_SMTP_USER}|" \
    "$REPO_INFRA/ntfy/msmtprc" > /etc/msmtprc
chmod 600 /etc/msmtprc

echo
echo "ntfy ${NTFY_VERSION}: https://${ETUT_NTFY_HOST}, topic ${ETUT_NTFY_TOPIC} (deny-all, no upstream)."
echo "Phone (ntfy app): server https://${ETUT_NTFY_HOST}, user bny, topic ${ETUT_NTFY_TOPIC}."
echo "  The bny password is in $SECRETS/ntfy-bny-password; read it yourself (sudo cat) and put it"
echo "  into the app and the offline password manager. It is not printed here."
echo "Next: sudo bash $REPO_INFRA/scripts/08-timers.sh && sudo /opt/etut/bin/alert.sh --test"
