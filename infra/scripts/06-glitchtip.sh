#!/usr/bin/env bash
# GlitchTip on the same server (hukuk/kvkk/00 §3.4: error reports stay in Turkey). Run as root.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
# shellcheck source=/dev/null
. /etc/etut/etut.conf
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"
DEST=/opt/etut/glitchtip
install -d -m 750 "$DEST"
[ -f "$DEST/compose.yml" ] || cp "$REPO_INFRA/glitchtip/compose.yml" "$DEST/compose.yml"

if [ ! -f "$DEST/.env" ]; then
  umask 077
  db_pass=$(openssl rand -hex 24)
  {
    echo "GLITCHTIP_SECRET_KEY=$(openssl rand -hex 32)"
    echo "GLITCHTIP_DB_PASSWORD=${db_pass}"
    # Database URL for GlitchTip: scheme, user, generated password, host/port/database.
    printf 'GLITCHTIP_DATABASE_URL=%s://%s:%s@%s\n' postgres glitchtip "$db_pass" postgres:5432/glitchtip
    echo "ETUT_GLITCHTIP_HOST=${ETUT_GLITCHTIP_HOST}"
    echo "ACME_EMAIL=${ACME_EMAIL}"
  } > "$DEST/.env"
  unset db_pass
fi

cd "$DEST"
docker compose pull
# Pin by digest after the first pull (sabit sürüm).
for image in postgres:18 glitchtip/glitchtip:6; do
  digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$image")
  sed -i "s|image: ${image}\$|image: ${digest}|" compose.yml
done
grep 'image:' compose.yml
docker compose up -d --wait
echo "Create the operator account: docker compose exec web ./manage.py createsuperuser"
