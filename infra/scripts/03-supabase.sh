#!/usr/bin/env bash
# Self-hosted Supabase at a pinned release, every default secret replaced, Etüt overrides.
# Run as root from a checkout of the Etüt repository (needs infra/ next to this script).
#
#   sudo bash infra/scripts/03-supabase.sh
#
# Result: /opt/etut/supabase (compose project), secrets in /opt/etut/supabase/.env (600),
# API on 127.0.0.1:8000 only, Postgres on 127.0.0.1 only. Caddy (05) publishes the API.
set -euo pipefail

# Pinned release of the official self-hosting files (docs: supabase.com/docs/guides/self-hosting/docker).
# Every image inside its docker-compose.yml has a fixed tag. Update = change this tag after
# reading the release notes, then follow infra/README.md "Güncelleme".
SUPABASE_SELF_HOSTED_TAG=self-hosted/v0.8.2
EXPECTED_DB_IMAGE=supabase/postgres:17.6.1.136

CONF=/etc/etut/etut.conf
# shellcheck source=/dev/null
. "$CONF"
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"
DEST=/opt/etut/supabase
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [ ! -f "$DEST/docker-compose.yml" ]; then
  git clone --filter=blob:none --no-checkout --depth=1 --branch "$SUPABASE_SELF_HOSTED_TAG" \
    https://github.com/supabase/supabase "$WORK/supabase"
  (cd "$WORK/supabase" && git sparse-checkout init --cone && git sparse-checkout set docker && git checkout --quiet)
  install -d -m 750 "$DEST"
  cp -rf "$WORK/supabase/docker/." "$DEST"
  cp "$DEST/.env.example" "$DEST/.env"
  chmod 600 "$DEST/.env"
  echo "$SUPABASE_SELF_HOSTED_TAG" > "$DEST/ETUT_PINNED_TAG"
fi
cd "$DEST"

grep -q "image: $EXPECTED_DB_IMAGE" docker-compose.yml \
  || { echo "db image of $SUPABASE_SELF_HOSTED_TAG is not $EXPECTED_DB_IMAGE: update infra/supabase/db and the override"; exit 1; }

# --- secrets: the official generators replace every default value ---------------------------
if grep -q 'your-super-secret-and-long-postgres-password' .env; then
  sh utils/generate-keys.sh
  sh utils/add-new-auth-keys.sh
fi

set_env() { # set_env KEY VALUE  (replaces or appends, value written literally)
  local key="$1" value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value//|/\\|}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

rand_alnum() { tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$1"; }
# Anything the generators may leave at a known default.
grep -q '^DASHBOARD_PASSWORD=this_password_is_insecure' .env && set_env DASHBOARD_PASSWORD "$(rand_alnum 32)"
grep -q '^DASHBOARD_USERNAME=supabase$' .env && set_env DASHBOARD_USERNAME "etut-admin"
grep -q '^REALTIME_DB_ENC_KEY=supabaserealtime$' .env && set_env REALTIME_DB_ENC_KEY "$(rand_alnum 16)"
grep -q '^SECRET_KEY_BASE=UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq$' .env && set_env SECRET_KEY_BASE "$(rand_alnum 64)"
grep -q '^MINIO_ROOT_PASSWORD=secret1234$' .env && set_env MINIO_ROOT_PASSWORD "$(rand_alnum 32)"
grep -q '^S3_PROTOCOL_ACCESS_KEY_ID=625729a08b95bf1b7ff351a663f3a23c$' .env && set_env S3_PROTOCOL_ACCESS_KEY_ID "$(rand_alnum 32)"
grep -q '^S3_PROTOCOL_ACCESS_KEY_SECRET=' .env && set_env S3_PROTOCOL_ACCESS_KEY_SECRET "$(rand_alnum 64)"
grep -q '^POOLER_TENANT_ID=your-tenant-id$' .env && set_env POOLER_TENANT_ID "etut"
set_env OPENAI_API_KEY ""

# Fail if any well-known default survived.
for pattern in 'your-super-secret' 'this_password_is_insecure' 'your-32-character-encryption-key' \
               'your-encryption-key-32-chars-min' 'supabaserealtime' 'secret1234'; do
  if grep -q "$pattern" .env; then echo "Default secret still present: $pattern"; exit 1; fi
done

# --- Etüt settings ------------------------------------------------------------------------
set_env SUPABASE_PUBLIC_URL "https://${ETUT_API_HOST}"
set_env API_EXTERNAL_URL "https://${ETUT_API_HOST}/auth/v1"
set_env SITE_URL "https://${ETUT_DOMAIN}"
set_env ENABLE_EMAIL_SIGNUP false        # no e-mail accounts (K-32)
set_env ENABLE_PHONE_SIGNUP false        # no phone (K-32)
set_env ENABLE_ANONYMOUS_USERS true      # anonymous start
set_env DISABLE_SIGNUP false
set_env PGRST_DB_SCHEMAS "public,graphql_public"   # never add `app` or `audit`
set_env APPLE_CLIENT_ID "${APPLE_CLIENT_ID}"
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  set_env GOOGLE_CLIENT_ID "${GOOGLE_CLIENT_ID}"
fi
# Linking Apple / Google writes the e-mail (Google: also the name) into auth.users and
# auth.identities. Off until the app has the buttons and that data is cleaned (kvkk/08 #11).
if [ "${ETUT_LINKING_ENABLED:-false}" = "true" ]; then
  set_env LINKING_ENABLED true
  set_env APPLE_ENABLED true
  if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then set_env GOOGLE_ENABLED true; fi
else
  set_env LINKING_ENABLED false
  set_env APPLE_ENABLED false
  set_env GOOGLE_ENABLED false
fi

# --- overrides and the db image with pgBackRest ---------------------------------------------
install -d -m 755 "$DEST/etut/db"
cp "$REPO_INFRA/supabase/db/Dockerfile" "$DEST/etut/db/Dockerfile"
cp "$REPO_INFRA/supabase/docker-compose.override.yml" "$DEST/docker-compose.override.yml"
install -d -m 750 /etc/etut/pgbackrest /var/lib/etut/pgbackrest-spool /var/log/etut/pgbackrest
# The postgres user inside the image owns spool and log (uid/gid of the image, printed below).
docker compose build db
PGUID=$(docker run --rm --entrypoint id etut/postgres-pgbackrest:17.6.1.136 -u postgres)
PGGID=$(docker run --rm --entrypoint id etut/postgres-pgbackrest:17.6.1.136 -g postgres)
chown -R "$PGUID:$PGGID" /var/lib/etut/pgbackrest-spool /var/log/etut/pgbackrest
docker run --rm --entrypoint cat etut/postgres-pgbackrest:17.6.1.136 /etc/os-release | head -n 3

# pgBackRest config must exist before Postgres starts archiving (07-backup.sh fills it in).
[ -f /etc/etut/pgbackrest/pgbackrest.conf ] || cp "$REPO_INFRA/supabase/pgbackrest.conf" /etc/etut/pgbackrest/pgbackrest.conf

docker compose pull --ignore-buildable
docker compose up -d --wait
docker compose ps

# Record exact image digests (pinning evidence; compare after every update).
docker compose images --format json | jq -r '.[] | "\(.Repository):\(.Tag) \(.ID)"' > "$DEST/ETUT_IMAGE_DIGESTS"
echo "Supabase is up on 127.0.0.1:8000. Next: 04-migrate.sh"
