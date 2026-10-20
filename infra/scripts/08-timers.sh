#!/usr/bin/env bash
# systemd timers: nightly backup, 5-minute health check, daily log hash ledger, 2-minute operator
# alerts. Installs every operator script of infra/scripts (all but the numbered setup steps) into
# /opt/etut/bin and enables every infra/systemd/etut-*.timer. Safe to re-run. Run as root.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
REPO_INFRA="$(cd "$(dirname "$0")/.." && pwd)"
install -d -m 755 /opt/etut/bin
for s in "$REPO_INFRA"/scripts/*.sh; do
  case "$(basename "$s")" in [0-9][0-9]-*) continue ;; esac
  install -m 750 "$s" "/opt/etut/bin/$(basename "$s")"
done
install -m 644 "$REPO_INFRA"/systemd/etut-*.service "$REPO_INFRA"/systemd/etut-*.timer /etc/systemd/system/
systemctl daemon-reload
for t in "$REPO_INFRA"/systemd/etut-*.timer; do
  systemctl enable --now "$(basename "$t")"
done
systemctl list-timers 'etut-*'
