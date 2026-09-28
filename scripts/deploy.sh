#!/usr/bin/env bash
# Play Time — build & deploy script (PM2 + PostgreSQL + Caddy).
#
#   First-time server setup:   sudo ./scripts/deploy.sh setup
#   Deploy latest code:        sudo ./scripts/deploy.sh          (zero-downtime)
#   Install/repair Caddy+TLS:  sudo ./scripts/deploy.sh caddy
#   Tail app logs:             ./scripts/deploy.sh logs
#   Service status:            ./scripts/deploy.sh status
#
# Deploys are zero-downtime: the app is built into a side directory while the
# running PM2 cluster keeps serving, then `pm2 reload` swaps workers once the
# new build binds the port.
#
# Override via environment variables:
#   APP_DIR=/opt/playtime BRANCH=main DOMAIN=playtimetcg.com ./scripts/deploy.sh
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/playtime}"
REPO_URL="${REPO_URL:-https://github.com/mikeisflux/playtimetcg.git}"
# Default to whatever branch is checked out in APP_DIR (falls back to main
# for a fresh clone). Override with BRANCH=… for a different one.
BRANCH="${BRANCH:-$(git -C "${APP_DIR:-/opt/playtime}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
SERVICE="${SERVICE:-playtime}"
PORT="${PORT:-3000}"
DOMAIN="${DOMAIN:-playtimetcg.com}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-40}"
DB_NAME="${DB_NAME:-playtime}"
DB_USER="${DB_USER:-playtime}"
NODE_MAJOR="${NODE_MAJOR:-22}"

log()  { echo -e "\033[1;36m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

ensure_node() {
  if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]; then
    log "Installing Node ${NODE_MAJOR}…"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
}

ensure_pm2() {
  command -v pm2 >/dev/null || { log "Installing PM2…"; npm install -g pm2 >/dev/null; }
}

load_env() {
  if [ -f "$APP_DIR/.env" ]; then set -a; . "$APP_DIR/.env"; set +a; fi
}

provision_postgres() {
  [ "$(id -u)" -eq 0 ] || fail "Provisioning PostgreSQL needs root (sudo)."
  if ! command -v psql >/dev/null; then
    log "Installing PostgreSQL…"
    apt-get install -y -qq postgresql postgresql-contrib >/dev/null
  fi
  systemctl enable --now postgresql >/dev/null 2>&1 || true
  touch "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
  if grep -qE '^DATABASE_URL="postgresql://' "$APP_DIR/.env"; then
    log "DATABASE_URL already configured — reusing."; return
  fi
  local pw; pw=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  log "Creating PostgreSQL role & database (${DB_USER}/${DB_NAME})…"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
DO \$\$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    ALTER ROLE ${DB_USER} LOGIN PASSWORD '${pw}';
  ELSE
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${pw}';
  END IF;
END \$\$;
SQL
  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    runuser -u postgres -- createdb -O "${DB_USER}" "${DB_NAME}"
  fi
  local url="postgresql://${DB_USER}:${pw}@localhost:5432/${DB_NAME}"
  if grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${url}\"|" "$APP_DIR/.env"
  else
    echo "DATABASE_URL=\"${url}\"" >> "$APP_DIR/.env"
  fi
  log "PostgreSQL ready."
}

provision_caddy() {
  [ "$(id -u)" -eq 0 ] || return 0
  if ! command -v caddy >/dev/null; then
    log "Installing Caddy…"
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
    # apt verifies signatures as the unprivileged _apt user, so the keyring and
    # list must be world-readable despite this script's umask 077
    rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy
  fi
  command -v caddy >/dev/null || fail "Caddy did not install — see the apt output above."
  mkdir -p /etc/caddy
  if ! grep -q "$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
    log "Writing Caddyfile for ${DOMAIN}…"
    cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN}, www.${DOMAIN} {
	encode zstd gzip
	# SendGrid inbound parse can post large multipart bodies (attachments)
	request_body {
		max_size 60MB
	}
	reverse_proxy 127.0.0.1:${PORT} {
		transport http {
			read_timeout 120s
		}
	}
}
CADDY
    chmod 644 /etc/caddy/Caddyfile
    systemctl enable --now caddy >/dev/null 2>&1 || true
    systemctl reload caddy || systemctl restart caddy
  fi
}

# Small servers (2 GB) get OOM-killed by `next build`. Give them swap and a
# capped Node heap; ecosystem.config.js also drops to one worker under 3 GB.
ensure_swap() {
  [ "$(id -u)" -eq 0 ] || return 0
  local ram_mb swap_mb
  ram_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  swap_mb=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ "$ram_mb" -lt 4000 ] && [ "$swap_mb" -lt 1000 ]; then
    log "Only ${ram_mb} MB RAM and no swap — creating a 3 GB swap file…"
    if ! [ -f /swapfile ]; then
      fallocate -l 3G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=3072 status=none
      chmod 600 /swapfile && mkswap /swapfile >/dev/null
    fi
    swapon /swapfile 2>/dev/null || true
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl -q vm.swappiness=10 && grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  fi
}

build_heap_mb() {
  local ram_mb; ram_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  local heap=$(( ram_mb * 6 / 10 ))
  [ "$heap" -lt 1024 ] && heap=1024
  [ "$heap" -gt 4096 ] && heap=4096
  echo "$heap"
}

pull_code() {
  cd "$APP_DIR"
  log "Pulling latest ${BRANCH}…"
  git fetch origin "$BRANCH"
  git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH" "origin/${BRANCH}"
  git reset -q --hard "origin/${BRANCH}"
  log "Now at $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"
}

health_check() {
  log "Health check on http://localhost:${PORT} (up to ${HEALTH_TIMEOUT}s)…"
  for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
    if curl -sf -o /dev/null "http://localhost:${PORT}/"; then log "Health check passed ✔"; return 0; fi
    sleep 1
  done
  return 1
}

build_app() {
  log "Installing dependencies (npm ci)…"
  npm ci --no-fund --no-audit
  log "Syncing database schema (prisma db push)…"
  npx prisma db push --accept-data-loss=false 2>/dev/null || npx prisma db push
  log "Seeding (admin, catalog, defaults — idempotent)…"
  npm run db:seed
  if [ -f "docs/Play Time Cards Print.pdf" ]; then
    log "Rendering card artwork from docs/Play Time Cards Print.pdf…"
    npm run cards:import || log "⚠ card artwork import failed — the game falls back to text cards"
  fi
  log "Building (next build, heap $(build_heap_mb) MB)…"
  export NODE_OPTIONS="--max-old-space-size=$(build_heap_mb)"
  NEXT_PUBLIC_PT_BUILD="$(date -u +%Y-%m-%d).$(git rev-parse --short=10 HEAD 2>/dev/null || date +%s)"
  export NEXT_PUBLIC_PT_BUILD
  rm -rf .next-build
  NEXT_DIST_DIR=.next-build npx next build
  # atomic-ish swap: the live workers keep the old .next until reload
  rm -rf .next-prev; [ -d .next ] && mv .next .next-prev; mv .next-build .next
  unset NODE_OPTIONS
  mkdir -p public/uploads
}

cmd="${1:-deploy}"
case "$cmd" in
  setup)
    [ "$(id -u)" -eq 0 ] || fail "setup needs root (sudo)."
    apt-get update -qq >/dev/null
    apt-get install -y -qq git curl ca-certificates gnupg >/dev/null
    ensure_node; ensure_pm2; ensure_swap
    if [ ! -d "$APP_DIR/.git" ]; then
      log "Cloning ${REPO_URL} (${BRANCH}) into ${APP_DIR}…"
      git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    fi
    pull_code
    provision_postgres
    load_env
    if ! grep -q '^AUTH_SECRET=' .env; then echo "AUTH_SECRET=\"$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')\"" >> .env; fi
    if ! grep -q '^SEED_ADMIN_EMAIL=' .env; then echo 'SEED_ADMIN_EMAIL="divinitycomicsinc@gmail.com"' >> .env; fi
    if ! grep -q '^SEED_ADMIN_PASSWORD=' .env; then
      echo "⚠  Add SEED_ADMIN_PASSWORD=\"…\" to ${APP_DIR}/.env before the first deploy to choose the admin password (otherwise one is generated and printed by the seed)."
    fi
    load_env
    build_app
    pm2 start ecosystem.config.js --update-env
    pm2 save
    pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
    health_check || fail "App did not come up. Check: pm2 logs ${SERVICE}"
    provision_caddy
    log "Setup complete → https://${DOMAIN}  (admin at /admin, settings at /admin/settings)"
    ;;
  deploy)
    cd "$APP_DIR" || fail "APP_DIR ${APP_DIR} not found — run setup first."
    ensure_node; ensure_pm2; ensure_swap; load_env
    pull_code
    build_app
    if pm2 describe "$SERVICE" >/dev/null 2>&1; then
      log "Reloading ${SERVICE} (zero-downtime)…"
      pm2 reload ecosystem.config.js --update-env
    else
      pm2 start ecosystem.config.js --update-env
    fi
    pm2 save >/dev/null
    if ! health_check; then
      log "Health check FAILED — rolling back to the previous build…"
      if [ -d .next-prev ]; then rm -rf .next; mv .next-prev .next; pm2 reload ecosystem.config.js --update-env; fi
      fail "Deploy rolled back. Check: pm2 logs ${SERVICE}"
    fi
    rm -rf .next-prev
    provision_caddy
    log "Deployed $(git rev-parse --short HEAD) ✔"
    ;;
  caddy)
    [ "$(id -u)" -eq 0 ] || fail "caddy needs root (sudo)."
    provision_caddy
    systemctl status caddy --no-pager | head -3
    log "Caddy ready — certificate for ${DOMAIN} issues on first request (journalctl -u caddy -f to watch)."
    ;;
  logs) pm2 logs "$SERVICE" --lines 100 ;;
  status) pm2 status "$SERVICE" ;;
  *) fail "Unknown command: $cmd (setup | deploy | caddy | logs | status)" ;;
esac
