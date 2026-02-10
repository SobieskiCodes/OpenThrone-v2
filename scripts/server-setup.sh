#!/usr/bin/env bash
# =============================================================================
# OpenThrone v2 — One-time server provisioning for Ubuntu 24.04 (Digital Ocean)
#
# Usage:
#   1. Create a fresh Ubuntu 24.04 droplet
#   2. SSH in as root
#   3. curl/scp this script onto the server
#   4. Run: bash server-setup.sh
#   5. Follow the printed instructions at the end
# =============================================================================
set -euo pipefail

DEPLOY_USER="deploy"
REPO_SSH="git@github.com:SobieskiCodes/OpenThrone-v2.git"
NODE_VERSION="20"
PNPM_VERSION="9.15.0"

echo "============================================"
echo " OpenThrone v2 — Server Setup"
echo "============================================"

# -------------------------------------------------------------------
# 1. System updates
# -------------------------------------------------------------------
echo "==> Updating system packages"
apt-get update && apt-get upgrade -y

# -------------------------------------------------------------------
# 2. Install essential packages
# -------------------------------------------------------------------
echo "==> Installing essentials"
apt-get install -y \
  curl wget git build-essential \
  ca-certificates gnupg lsb-release \
  ufw fail2ban

# -------------------------------------------------------------------
# 3. Create deploy user
# -------------------------------------------------------------------
echo "==> Creating deploy user"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
fi

mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
touch /home/$DEPLOY_USER/.ssh/authorized_keys
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

# -------------------------------------------------------------------
# 4. Generate SSH key for GitHub Actions (deploy to this server)
# -------------------------------------------------------------------
echo "==> Generating SSH key for GitHub Actions"
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /tmp/github-actions-key -N ""
cat /tmp/github-actions-key.pub >> /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

ACTIONS_PRIVATE_KEY=$(cat /tmp/github-actions-key)
rm /tmp/github-actions-key /tmp/github-actions-key.pub

# -------------------------------------------------------------------
# 5. Generate deploy key for GitHub repo access (git clone/pull)
# -------------------------------------------------------------------
echo "==> Generating deploy key for GitHub repo access"
sudo -u $DEPLOY_USER ssh-keygen -t ed25519 -C "openthrone-deploy-key" -f /home/$DEPLOY_USER/.ssh/github_deploy_key -N ""

# Configure SSH to use this key for github.com
sudo -u $DEPLOY_USER bash -c 'cat > ~/.ssh/config << SSHEOF
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy_key
  StrictHostKeyChecking accept-new
SSHEOF'
chmod 600 /home/$DEPLOY_USER/.ssh/config
chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh/config

DEPLOY_PUBLIC_KEY=$(cat /home/$DEPLOY_USER/.ssh/github_deploy_key.pub)

# -------------------------------------------------------------------
# 6. Firewall
# -------------------------------------------------------------------
echo "==> Configuring firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# -------------------------------------------------------------------
# 7. Node.js 20 (via NodeSource)
# -------------------------------------------------------------------
echo "==> Installing Node.js $NODE_VERSION"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# -------------------------------------------------------------------
# 8. pnpm
# -------------------------------------------------------------------
echo "==> Installing pnpm $PNPM_VERSION"
npm install -g pnpm@$PNPM_VERSION

# -------------------------------------------------------------------
# 9. PM2
# -------------------------------------------------------------------
echo "==> Installing PM2"
npm install -g pm2

sudo -u $DEPLOY_USER bash -c "pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER" || true
env PATH=$PATH:/usr/bin pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER || true

# -------------------------------------------------------------------
# 10. Docker + Docker Compose (for PostgreSQL)
# -------------------------------------------------------------------
echo "==> Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

usermod -aG docker $DEPLOY_USER

# -------------------------------------------------------------------
# 11. PostgreSQL via Docker Compose
# -------------------------------------------------------------------
echo "==> Starting PostgreSQL"
DOCKER_DIR="/home/$DEPLOY_USER/docker"
mkdir -p $DOCKER_DIR

cat > $DOCKER_DIR/docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: openthrone
      POSTGRES_PASSWORD: openthrone
      POSTGRES_DB: openthrone
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
EOF

chown -R $DEPLOY_USER:$DEPLOY_USER $DOCKER_DIR
cd $DOCKER_DIR && docker compose up -d

# -------------------------------------------------------------------
# 12. Nginx
# -------------------------------------------------------------------
echo "==> Installing and configuring Nginx"
apt-get install -y nginx
rm -f /etc/nginx/sites-enabled/default

# -------------------------------------------------------------------
# 13. Certbot (for SSL later)
# -------------------------------------------------------------------
echo "==> Installing Certbot"
apt-get install -y certbot python3-certbot-nginx

# -------------------------------------------------------------------
# Done — print everything the user needs
# -------------------------------------------------------------------
echo ""
echo "============================================"
echo " Server setup complete!"
echo "============================================"
echo ""
echo ">>> STEP 1: Add the DEPLOY KEY to your GitHub repo <<<"
echo ""
echo "  Go to: https://github.com/SobieskiCodes/OpenThrone-v2/settings/keys"
echo "  Click 'Add deploy key'"
echo "  Title: OpenThrone Droplet"
echo "  Key:   (copy the line below)"
echo ""
echo "  $DEPLOY_PUBLIC_KEY"
echo ""
echo "  Leave 'Allow write access' UNCHECKED (read-only is fine)"
echo "  Click 'Add key'"
echo ""
echo ">>> STEP 2: Add this as DROPLET_SSH_KEY in GitHub Actions secrets <<<"
echo ""
echo "  Go to: https://github.com/SobieskiCodes/OpenThrone-v2/settings/secrets/actions"
echo "  Create secret: DROPLET_SSH_KEY"
echo "  Value: (copy everything between the dashed lines below)"
echo ""
echo "------- START COPYING BELOW THIS LINE -------"
echo "$ACTIONS_PRIVATE_KEY"
echo "------- STOP COPYING ABOVE THIS LINE -------"
echo ""
echo ">>> STEP 3: Clone the repo (after adding deploy key above) <<<"
echo ""
echo "  Run as deploy user:"
echo "    su - deploy"
echo "    git clone $REPO_SSH ~/OpenThrone-v2"
echo ""
echo ">>> STEP 4: Set up Nginx (after first deploy) <<<"
echo ""
echo "  cp ~/OpenThrone-v2/deploy/nginx.conf /etc/nginx/sites-available/openthrone"
echo "  ln -s /etc/nginx/sites-available/openthrone /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo ">>> STEP 5: Generate PRODUCTION_ENV secret <<<"
echo ""
echo "  Locally run: bash scripts/generate-env.sh 143.198.226.184"
echo "  Paste output as PRODUCTION_ENV GitHub secret"
echo ""
echo ">>> STEP 6: Deploy! <<<"
echo ""
echo "  GitHub repo → Actions → 'Deploy to Digital Ocean' → Run workflow"
echo ""
