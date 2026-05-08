#!/bin/bash
# ============================================================
# IRAM 366 News — Oracle Cloud ARM64 VPS Setup
# Run ONCE on a fresh Ubuntu 24.04 ARM instance
# Usage: ssh ubuntu@YOUR_VPS_IP 'bash -s' < deploy/setup-vps.sh
# ============================================================
set -euo pipefail

echo "========================================="
echo " IRAM 366 — Oracle Cloud VPS Setup"
echo "========================================="

# 1. System updates
echo ">>> Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
echo ">>> Installing Docker..."
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER

# 3. Oracle Cloud iptables
# Oracle uses iptables rules that BLOCK ports 80/443 by default
# even after the VCN security list allows them
echo ">>> Opening ports 80/443 in iptables (Oracle Cloud specific)..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT

# Persist iptables rules across reboots
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# 4. Install fail2ban + awscli (for R2 backups)
echo ">>> Installing fail2ban and awscli..."
sudo apt-get install -y fail2ban awscli

# 5. Enable automatic security updates
echo ">>> Enabling automatic security updates..."
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 6. Create app directory
echo ">>> Creating app directory..."
sudo mkdir -p /opt/iram366
sudo chown "$USER:$USER" /opt/iram366

# 7. Install nightly backup cron
echo ">>> Installing nightly backup cron at 03:15 UTC..."
CRON_LINE="15 3 * * *  /opt/iram366/deploy/backup.sh >> /var/log/iram366-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'iram366/deploy/backup.sh' ; echo "$CRON_LINE" ) | crontab -

echo ""
echo "========================================="
echo " VPS setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Log out and back in (for docker group)"
echo "  2. Copy .env to /opt/iram366/.env"
echo "  3. Run deploy: ./deploy/deploy.sh ubuntu@YOUR_VPS_IP"
echo ""
