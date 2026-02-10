# Deploying OpenThrone v2

## Architecture

```
Browser → Nginx (port 80)
            ├─ /api/auth/*  → Next.js (port 3000)  ← NextAuth lives here
            ├─ /api/*       → NestJS  (port 3001)  ← Game API
            ├─ /socket.io/* → NestJS  (port 3001)  ← Chat WebSocket
            └─ /*           → Next.js (port 3000)  ← Frontend
```

- **PM2** manages both processes (fork mode, NOT cluster)
- **PostgreSQL** runs in Docker on the same droplet
- **SQLite** is used for local dev; deploy script swaps to PostgreSQL automatically

## Quick Deploy (after initial setup)

Push to `master`, then trigger the GitHub Actions workflow:

```bash
# From GitHub Actions UI: Actions → Deploy to Digital Ocean → Run workflow
# Or via CLI:
gh workflow run deploy.yml
```

The workflow SSHs into the droplet and runs the full deploy sequence automatically.

## Initial Server Setup

Run `scripts/server-setup.sh` on a fresh Ubuntu 24.04 droplet. It installs Node.js 20, pnpm, PM2, Docker, PostgreSQL, Nginx, and Certbot.

```bash
# SSH in as root
ssh root@YOUR_DROPLET_IP

# Download and run setup (or copy the script over)
bash server-setup.sh
```

The script creates a `deploy` user and generates two SSH keys:
1. **GitHub Actions key** — add as `DROPLET_SSH_KEY` secret
2. **Deploy key** — add to the GitHub repo's deploy keys (read-only)

## GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `DROPLET_HOST` | Droplet IP address |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | SSH private key for the deploy user |
| `PRODUCTION_ENV` | Full `.env` file contents (see below) |

Generate `PRODUCTION_ENV` with:
```bash
bash scripts/generate-env.sh YOUR_DROPLET_IP
```

## What the Deploy Workflow Does

1. SSH into the droplet as `deploy`
2. `git reset --hard origin/master` (clean pull)
3. Write `.env` from `PRODUCTION_ENV` secret
4. Symlink `.env` into `packages/db/`, `apps/web/`, `apps/api/`
5. `sed` swap Prisma provider from `sqlite` → `postgresql`
6. `pnpm install --frozen-lockfile`
7. `pnpm db:generate && pnpm db:push`
8. `pnpm build --force` (force skips Turborepo cache)
9. Restore Prisma schema to sqlite (so git stays clean)
10. `pm2 delete all && pm2 start ecosystem.config.cjs`
11. Health checks on ports 3000 and 3001

## Critical Gotchas

### `NEXT_PUBLIC_*` vars are baked at build time

Next.js inlines `NEXT_PUBLIC_*` env vars into the JavaScript bundle during `next build`. Turborepo's cache does NOT include `.env` files in its hash, so a cached build will have stale env values. **Always use `pnpm build --force` in production deploys.**

### PM2 must use fork mode

Next.js crashes in PM2 cluster mode (rapid restart loops). Always use `exec_mode: 'fork'` in `ecosystem.config.cjs`.

### `.env` must be symlinked

PM2 doesn't support `env_file`. Next.js only reads `.env` from its own project directory. The deploy script symlinks the root `.env` into the directories that need it:
```
packages/db/.env  → /root/.env
apps/web/.env     → /root/.env
apps/api/.env     → /root/.env
```

### `NEXT_PUBLIC_API_URL` must NOT include `/api`

The `api-client.ts` already prepends `/api` to all paths. If the env var includes `/api`, you get double-prefixed URLs like `/api/api/player/me`.

Correct: `NEXT_PUBLIC_API_URL="http://YOUR_IP"`
Wrong: `NEXT_PUBLIC_API_URL="http://YOUR_IP/api"`

### NextAuth v5 requires `AUTH_TRUST_HOST=true`

Behind a reverse proxy (Nginx), NextAuth v5 rejects requests with `UntrustedHost` unless `AUTH_TRUST_HOST=true` is set.

### Prisma schema swap is atomic

The full deploy sequence (swap → generate → build → restore) must happen in order. Never run `pnpm build` alone on the server — the Prisma schema might be set to `sqlite`, and NestJS webpack embeds the provider into `dist/main.js`.

### 1GB droplets need swap space

The build (especially Next.js + NestJS webpack) needs more than 1GB RAM. Add 2GB swap:
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Also set `NODE_OPTIONS="--max-old-space-size=1536"` for the build step.

### Nginx routing order matters

`/api/auth/*` must route to Next.js (NextAuth), not NestJS. Nginx uses longest prefix match, so the `/api/auth/` location block must come before the `/api/` block.

## File Reference

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | GitHub Actions manual deploy workflow |
| `ecosystem.config.cjs` | PM2 process configuration |
| `deploy/nginx.conf` | Nginx reverse proxy config |
| `scripts/server-setup.sh` | One-time server provisioning |
| `scripts/generate-env.sh` | Generate production `.env` template |

## Populating Test Data

After deploy, seed the database:
```bash
# On the server as deploy user
cd ~/OpenThrone-v2
pnpm db:seed       # 6 core test players
pnpm db:populate   # 200 randomized players (various levels/archetypes)
```

Test login: `testplayer1@openthrone.dev` / `password123`

## Adding SSL (when domain is ready)

1. Update `server_name` in `/etc/nginx/sites-available/openthrone`
2. Run `certbot --nginx -d yourdomain.com`
3. Update `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, and `CORS_ORIGIN` in the `PRODUCTION_ENV` secret to use `https://`
4. Re-deploy

## Troubleshooting

**Dashboard shows blank panels / API calls go to localhost:**
→ Turborepo served a cached build. Rebuild with `pnpm build --force` on the server, then restart PM2.

**"UntrustedHost" errors in web logs:**
→ `AUTH_TRUST_HOST=true` is missing from `.env`. Add it and restart PM2.

**API crashes with "URL must start with protocol file:":**
→ Prisma schema is set to `sqlite` but `DATABASE_URL` is PostgreSQL. Run the full sed swap → generate → build sequence.

**PM2 web process restarts rapidly:**
→ Check `exec_mode` is `fork`, not `cluster`. Check the script path is `node_modules/next/dist/bin/next`, not `.bin/next`.

**pnpm install or build OOM:**
→ Add swap space and set `NODE_OPTIONS="--max-old-space-size=1536"`.
