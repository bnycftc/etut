#!/usr/bin/env bash
# Encrypted backups to the second box in Turkey (Radore, İstanbul) over SFTP:
#   - pgBackRest: WAL archive (continuous) + full/diff backups, AES-256 client-side encrypted
#   - restic: configuration, Caddy certificates and access logs, GlitchTip database dump
# Generates the backup SSH key and both encryption passwords on this server. Copy the two
# passwords into the operator's offline password manager: without them the backups are
# unreadable (that is the point — the backup provider sees only ciphertext).
# Run as root after 03-supabase.sh. Then install the timers (08-timers.sh).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
# shellcheck source=/dev/null
. /etc/etut/etut.conf
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS=/etc/etut/secrets
install -d -m 700 "$SECRETS" /etc/etut/pgbackrest

# --- SSH key for SFTP (one key, both tools) -------------------------------------------------
KEY=/etc/etut/pgbackrest/id_ed25519
if [ ! -f "$KEY" ]; then
  ssh-keygen -t ed25519 -N '' -C "etut-backup@$(hostname)" -f "$KEY"
  echo "Add this public key to ${BACKUP_SFTP_USER}@${BACKUP_SFTP_HOST} (~/.ssh/authorized_keys, SFTP-only user):"
  cat "$KEY.pub"
  read -r -p "Press Enter once the key is installed on the backup box..."
fi
FINGERPRINT=$(ssh-keyscan -p "$BACKUP_SFTP_PORT" -t ed25519 "$BACKUP_SFTP_HOST" 2>/dev/null | ssh-keygen -lf - -E md5 | awk '{print $2}' | sed 's/^MD5://; s/://g')
[ -n "$FINGERPRINT" ] || { echo "Cannot read the host key of $BACKUP_SFTP_HOST"; exit 1; }
echo "Backup host key fingerprint (MD5): $FINGERPRINT — compare it with the provider panel."

# --- encryption passwords -------------------------------------------------------------------
umask 077
[ -f "$SECRETS/pgbackrest-cipher" ] || openssl rand -base64 48 | tr -d '\n' > "$SECRETS/pgbackrest-cipher"
[ -f "$SECRETS/restic-password" ] || openssl rand -base64 48 | tr -d '\n' > "$SECRETS/restic-password"

# --- pgBackRest config ----------------------------------------------------------------------
sed -e "s|<BACKUP_SFTP_HOST>|${BACKUP_SFTP_HOST}|" \
    -e "s|<BACKUP_SFTP_PORT>|${BACKUP_SFTP_PORT}|" \
    -e "s|<BACKUP_SFTP_USER>|${BACKUP_SFTP_USER}|" \
    -e "s|<BACKUP_SFTP_FINGERPRINT>|${FINGERPRINT}|" \
    -e "s|<BACKUP_PGBACKREST_PATH>|${BACKUP_PGBACKREST_PATH}|" \
    -e "s|<PGBACKREST_CIPHER_PASS>|$(cat "$SECRETS/pgbackrest-cipher")|" \
    "$REPO_INFRA/supabase/pgbackrest.conf" > /etc/etut/pgbackrest/pgbackrest.conf
# Readable by the postgres user inside the container only (uid/gid of the image).
PGUID=$(docker run --rm --entrypoint id etut/postgres-pgbackrest:17.6.1.136 -u postgres)
chown -R "$PGUID" /etc/etut/pgbackrest
chmod 600 /etc/etut/pgbackrest/pgbackrest.conf "$KEY"

cd /opt/etut/supabase
pgb() { docker compose exec -T -u postgres db pgbackrest --stanza=etut "$@"; }
pgb stanza-create
pgb check          # also proves that archive_command reaches the repository
pgb --type=full backup
pgb info

# --- restic repository ------------------------------------------------------------------------
cat > "$SECRETS/restic.env" <<EOF
RESTIC_REPOSITORY=sftp:${BACKUP_SFTP_USER}@${BACKUP_SFTP_HOST}:${BACKUP_RESTIC_PATH}
RESTIC_PASSWORD_FILE=${SECRETS}/restic-password
EOF
install -d -m 700 /root/.ssh
cat > /root/.ssh/config.d-etut <<EOF
Host ${BACKUP_SFTP_HOST}
  User ${BACKUP_SFTP_USER}
  Port ${BACKUP_SFTP_PORT}
  IdentityFile ${KEY}
  IdentitiesOnly yes
EOF
grep -q 'config.d-etut' /root/.ssh/config 2>/dev/null || echo 'Include /root/.ssh/config.d-etut' >> /root/.ssh/config
ssh-keyscan -p "$BACKUP_SFTP_PORT" -t ed25519 "$BACKUP_SFTP_HOST" >> /root/.ssh/known_hosts 2>/dev/null
set -a; . "$SECRETS/restic.env"; set +a
restic snapshots >/dev/null 2>&1 || restic init
bash "$REPO_INFRA/scripts/backup-run.sh"

echo
echo "Store these two values in the offline password manager NOW (they are not backed up):"
echo "  pgBackRest cipher pass: $SECRETS/pgbackrest-cipher"
echo "  restic password:        $SECRETS/restic-password"
