#!/usr/bin/env bash
# systemd timers: nightly backup, 5-minute health check, daily log hash ledger. Run as root.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"
install -d -m 755 /opt/etut/bin
for s in backup-run.sh healthcheck.sh log-hash.sh restore-drill.sh; do
  install -m 750 "$REPO_INFRA/scripts/$s" "/opt/etut/bin/$s"
done
install -m 644 "$REPO_INFRA"/systemd/etut-*.service "$REPO_INFRA"/systemd/etut-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now etut-backup.timer etut-health.timer etut-loghash.timer
systemctl list-timers 'etut-*'
