#!/usr/bin/env bash
# GCE VM(Ubuntu 24.04) 초기 셋업 — ARCHITECTURE_v2.1 §7 체크리스트 자동화.
# 멱등하게 작성해서 재실행해도 안전하다. root 아닌 기본 계정으로 실행(sudo 사용).
set -euo pipefail

echo "[1/5] 스왑 2GB (e2-small 2GB RAM 안전판)"
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

echo "[2/5] ufw 방화벽 (VPC 방화벽과 이중 방벽 — 컴퓨터보안 어필 겸)"
sudo apt-get update -qq
sudo apt-get install -y -qq ufw fail2ban
sudo ufw default deny incoming
sudo ufw default allow outgoing
# 필요 시 22를 관리 IP 대역으로 좁히기: sudo ufw delete allow 22/tcp && sudo ufw allow from <내IP> to any port 22
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "[3/5] fail2ban (sshd 기본 jail 활성화)"
sudo systemctl enable --now fail2ban

echo "[4/5] Docker 공식 저장소 설치"
if ! command -v docker > /dev/null; then
  sudo apt-get install -y -qq ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker "$USER"

echo "[5/5] SSH 키 전용 로그인 (비밀번호 로그인 비활성화)"
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

echo "완료. docker 그룹 반영을 위해 재접속할 것."
