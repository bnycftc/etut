#!/usr/bin/env bash
# Caddy from its official apt repository (Cloudsmith), Etüt Caddyfile, Let's Encrypt TLS.
# DNS A/AAAA records of ETUT_API_HOST and ETUT_GLITCHTIP_HOST must already point to this server
# (DNS-only at the registrar, no proxy). Run as root.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
# shellcheck source=/dev/null
. /etc/etut/etut.conf
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

cat > /etc/caddy/etut.env <<EOF
ACME_EMAIL=${ACME_EMAIL}
ETUT_API_HOST=${ETUT_API_HOST}
ETUT_GLITCHTIP_HOST=${ETUT_GLITCHTIP_HOST}
EOF
chmod 640 /etc/caddy/etut.env
chgrp caddy /etc/caddy/etut.env

install -d -m 750 -o caddy -g caddy /var/log/caddy
install -m 644 "$REPO_INFRA/caddy/Caddyfile" /etc/caddy/Caddyfile

install -d /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/etut.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/etut.env
EOF
systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile --envfile /etc/caddy/etut.env
systemctl enable --now caddy
systemctl reload caddy

sleep 5
curl -fsS "https://${ETUT_API_HOST}/saglik" && echo " ← TLS and Caddy work"
