#!/usr/bin/env bash
# Ubuntu 24.04 hardening for the Etüt VPS (run once as root on a fresh server).
#   - admin user with SSH key, root login and passwords off
#   - ufw: only 22, 80, 443
#   - unattended security upgrades, fail2ban (sshd), swap, time sync
# Safe to re-run. Reads /etc/etut/etut.conf.
set -euo pipefail

CONF=/etc/etut/etut.conf
[ -r "$CONF" ] || { echo "Missing $CONF (copy infra/etut.conf.example)"; exit 1; }
# shellcheck source=/dev/null
. "$CONF"

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
grep -q 'VERSION_ID="24.04"' /etc/os-release || { echo "Expected Ubuntu 24.04"; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install ufw fail2ban unattended-upgrades apt-listchanges ca-certificates curl gnupg \
  jq restic openssh-client chrony

# --- admin user ---------------------------------------------------------------------------
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo "$ADMIN_USER"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
AUTH="/home/$ADMIN_USER/.ssh/authorized_keys"
touch "$AUTH"
grep -qxF "$ADMIN_SSH_PUBKEY" "$AUTH" || echo "$ADMIN_SSH_PUBKEY" >> "$AUTH"
chown "$ADMIN_USER:$ADMIN_USER" "$AUTH"
chmod 600 "$AUTH"
# sudo needs a password; set one interactively: passwd "$ADMIN_USER"

# --- SSH: key only, no root ---------------------------------------------------------------
cat > /etc/ssh/sshd_config.d/10-etut.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
X11Forwarding no
AllowAgentForwarding no
# Studio and Postgres are reached only through an SSH tunnel to 127.0.0.1.
AllowTcpForwarding local
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
sshd -t
systemctl reload ssh

# --- firewall -----------------------------------------------------------------------------
# Docker-published ports bypass ufw (iptables DOCKER chain): every published port in
# infra/supabase/docker-compose.override.yml and infra/glitchtip/compose.yml is bound to
# 127.0.0.1, so only Caddy (80/443) is reachable from outside.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- automatic security updates -----------------------------------------------------------
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52etut-unattended <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
  "${distro_id}ESM:${distro_codename}-infra-security";
};
// Docker packages are held (02-docker.sh) and updated by hand after reading release notes.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF
systemctl enable --now unattended-upgrades

# --- fail2ban -----------------------------------------------------------------------------
cat > /etc/fail2ban/jail.d/etut.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# --- swap (4 GB) and kernel ---------------------------------------------------------------
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/sysctl.d/90-etut.conf <<'EOF'
vm.swappiness = 10
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
kernel.kptr_restrict = 2
EOF
sysctl --system >/dev/null

# --- time: server clock is the source of truth for session times (hukuk: sunucu zamanı) ----
timedatectl set-timezone UTC   # Postgres stores timestamptz; Istanbul days are computed in SQL.
systemctl enable --now chrony

echo "Hardening done. Test a NEW ssh session as $ADMIN_USER before closing this one."
