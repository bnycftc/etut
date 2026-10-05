#!/usr/bin/env bash
# Docker Engine + compose plugin from Docker's official apt repository, then held so unattended
# upgrades never restart the database. Run as root after 01-harden.sh.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Container logs: bounded, no personal data kept longer than needed.
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "local",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true
}
EOF
systemctl enable --now docker
systemctl restart docker

docker version --format 'Docker {{.Server.Version}}'
docker compose version
echo "Record these versions in infra/README.md (Sürümler) — compose >= 2.24 is needed for !override."
