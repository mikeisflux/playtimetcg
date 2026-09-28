#!/usr/bin/env bash
# Play Time — build & deploy script (PM2 + PostgreSQL + Caddy).
#
#   First-time server setup:   sudo ./scripts/deploy.sh setup
#   Deploy latest code:        sudo ./scripts/deploy.sh          (zero-downtime)
#   Install/repair Caddy+TLS:  sudo ./scripts/deploy.sh caddy
#   Fetch + render card art:   ./scripts/deploy.sh cards
#   Fetch the promo video:     ./scripts/deploy.sh video
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
  if grep -q "max_size 60MB" /etc/caddy/Caddyfile 2>/dev/null; then rm -f /etc/caddy/Caddyfile; fi
  if ! grep -q "$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
    log "Writing Caddyfile for ${DOMAIN}…"
    cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN}, www.${DOMAIN} {
	encode zstd gzip
	# SendGrid inbound parse can post large multipart bodies (attachments)
	request_body {
		max_size 512MB
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

# Card artwork source. The print PDF lives on Google Drive (shared link);
# the server can fetch it directly, this sandboxless path is what the
# `cards` subcommand and every deploy use. Override with CARDS_PDF_URL or
# CARDS_DRIVE_ID, or drop the file at docs/Play Time Cards Print.pdf.
CARDS_DRIVE_ID="${CARDS_DRIVE_ID:-1Mdsskz4jE-lmqdbANsJGY7dUotfkjDrq}"
CARDS_PDF="${CARDS_PDF:-$APP_DIR/private-assets/cards-print.pdf}"

fetch_cards_pdf() {
  if [ -f "$APP_DIR/docs/Play Time Cards Print.pdf" ]; then CARDS_PDF="$APP_DIR/docs/Play Time Cards Print.pdf"; return 0; fi
  [ -f "$CARDS_PDF" ] && [ "$(stat -c %s "$CARDS_PDF")" -gt 1000000 ] && return 0
  mkdir -p "$(dirname "$CARDS_PDF")"
  local url="${CARDS_PDF_URL:-https://drive.usercontent.google.com/download?id=${CARDS_DRIVE_ID}&export=download&confirm=t}"
  log "Downloading the cards PDF from Google Drive…"
  curl -fsSL -o "$CARDS_PDF.part" "$url" || { log "⚠ download failed"; rm -f "$CARDS_PDF.part"; return 1; }
  if ! head -c 5 "$CARDS_PDF.part" | grep -q '%PDF'; then
    # large files get an interstitial "virus scan" page: follow its form
    local uuid; uuid=$(grep -o 'name="uuid" value="[^"]*"' "$CARDS_PDF.part" | head -1 | sed 's/.*value="//;s/"//')
    curl -fsSL -o "$CARDS_PDF.part" "https://drive.usercontent.google.com/download?id=${CARDS_DRIVE_ID}&export=download&confirm=t&uuid=${uuid}" || true
  fi
  if head -c 5 "$CARDS_PDF.part" | grep -q '%PDF'; then
    mv "$CARDS_PDF.part" "$CARDS_PDF"; log "Cards PDF saved to $CARDS_PDF ($(du -h "$CARDS_PDF" | cut -f1))"; return 0
  fi
  rm -f "$CARDS_PDF.part"; log "⚠ Google Drive did not return a PDF — is the file shared as “Anyone with the link”?"; return 1
}

# Promo video ("playtime commercial final.mp4" on Google Drive) → public/uploads/promo.mp4,
# used by the Home hero and the first-visit intro. Idempotent.
PROMO_DRIVE_ID="${PROMO_DRIVE_ID:-1o75itsQZhDbiTMjO9Milw1GmAwCoL1si}"
PROMO_FILE="${PROMO_FILE:-$APP_DIR/public/uploads/promo.mp4}"

fetch_promo_video() {
  [ -f "$PROMO_FILE" ] && [ "$(stat -c %s "$PROMO_FILE")" -gt 1000000 ] && return 0
  mkdir -p "$(dirname "$PROMO_FILE")"
  log "Downloading the promo video from Google Drive…"
  local url="https://drive.usercontent.google.com/download?id=${PROMO_DRIVE_ID}&export=download&confirm=t"
  curl -fsSL -o "$PROMO_FILE.part" "$url" || { rm -f "$PROMO_FILE.part"; log "⚠ video download failed"; return 1; }
  if head -c 512 "$PROMO_FILE.part" | grep -q '<html'; then
    local uuid; uuid=$(grep -o 'name="uuid" value="[^"]*"' "$PROMO_FILE.part" | head -1 | sed 's/.*value="//;s/"//')
    curl -fsSL -o "$PROMO_FILE.part" "${url}&uuid=${uuid}" || true
  fi
  if head -c 512 "$PROMO_FILE.part" | grep -q '<html'; then rm -f "$PROMO_FILE.part"; log "⚠ Google Drive did not return the video — is it shared as “Anyone with the link”?"; return 1; fi
  mv "$PROMO_FILE.part" "$PROMO_FILE"; chmod 644 "$PROMO_FILE"
  log "Promo video saved ($(du -h "$PROMO_FILE" | cut -f1))"
}

set_video_settings() {
  # fills INTRO_VIDEO_URL only when it is unset, so an admin override sticks
  [ -f "$PROMO_FILE" ] || return 0
  cd "$APP_DIR"; load_env
  node --experimental-strip-types scripts/set-setting.mjs INTRO_VIDEO_URL /uploads/promo.mp4 --if-unset 2>&1 | grep -v -E "Warning|Reparsing|eliminate|trace-warnings" || log "⚠ could not write INTRO_VIDEO_URL — set it in Admin → Settings → Site"
}

import_cards() {
  cd "$APP_DIR"; load_env
  fetch_cards_pdf || return 1
  log "Rendering card artwork from $(basename "$CARDS_PDF")…"
  npm run cards:import -- "$CARDS_PDF"
}

# The seven colored card backs (one page each, die order) — a separate PDF
# on Google Drive. Override with BACKS_PDF_URL / BACKS_DRIVE_ID.
BACKS_DRIVE_ID="${BACKS_DRIVE_ID:-1XhQM2KkJlt9PleobLFmlIfI4EvleIdTi}"
BACKS_PDF="${BACKS_PDF:-$APP_DIR/private-assets/card-backs.pdf}"

fetch_backs_pdf() {
  [ -f "$BACKS_PDF" ] && head -c 5 "$BACKS_PDF" | grep -q '%PDF' && return 0
  mkdir -p "$(dirname "$BACKS_PDF")"
  local url="${BACKS_PDF_URL:-https://drive.usercontent.google.com/download?id=${BACKS_DRIVE_ID}&export=download&confirm=t}"
  log "Downloading the card backs PDF from Google Drive…"
  curl -fsSL -o "$BACKS_PDF.part" "$url" || { log "⚠ download failed"; rm -f "$BACKS_PDF.part"; return 1; }
  if ! head -c 5 "$BACKS_PDF.part" | grep -q '%PDF'; then
    local uuid; uuid=$(grep -o 'name="uuid" value="[^"]*"' "$BACKS_PDF.part" | head -1 | sed 's/.*value="//;s/"//')
    curl -fsSL -o "$BACKS_PDF.part" "https://drive.usercontent.google.com/download?id=${BACKS_DRIVE_ID}&export=download&confirm=t&uuid=${uuid}" || true
  fi
  if head -c 5 "$BACKS_PDF.part" | grep -q '%PDF'; then
    mv "$BACKS_PDF.part" "$BACKS_PDF"; log "Card backs PDF saved to $BACKS_PDF"; return 0
  fi
  rm -f "$BACKS_PDF.part"; log "⚠ Google Drive did not return a PDF for the card backs — is it shared as “Anyone with the link”?"; return 1
}

import_backs() {
  cd "$APP_DIR"; load_env
  fetch_backs_pdf || return 1
  log "Rendering the seven card backs…"
  npm run backs:import -- "$BACKS_PDF"
}

pull_code() {
  cd "$APP_DIR"
  log "Pulling latest ${BRANCH}…"
  git fetch origin "$BRANCH"
  local before; before=$(git rev-parse HEAD 2>/dev/null || echo "")
  git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH" "origin/${BRANCH}"
  git reset -q --hard "origin/${BRANCH}"
  if [ -n "$before" ] && [ "$before" != "$(git rev-parse HEAD)" ]; then
    log "Changes since $(git rev-parse --short "$before"):"
    git --no-pager log --reverse --pretty="   %h %s" "${before}..HEAD" | head -40
    git --no-pager diff --stat=110 "${before}..HEAD" | tail -60
  else
    log "Already up to date."
  fi
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
  fetch_promo_video && set_video_settings
  import_cards || log "⚠ card artwork not imported — the site falls back to text cards (run ./scripts/deploy.sh cards to retry)"
  import_backs || log "⚠ card backs not imported — the game falls back to colored CSS backs (run ./scripts/deploy.sh backs to retry)"
  log "Building (next build, heap $(build_heap_mb) MB)…"
  export NODE_OPTIONS="--max-old-space-size=$(build_heap_mb)"
  NEXT_PUBLIC_PT_BUILD="$(date -u +%Y-%m-%d).$(git rev-parse --short=10 HEAD 2>/dev/null || date +%s)"
  export NEXT_PUBLIC_PT_BUILD
  rm -rf .next-build
  # The live build's generated route types are picked up by tsconfig's
  # "**/*.ts" include; after a route is removed they no longer resolve and
  # fail the type check. They are not needed at runtime, so drop them.
  rm -rf .next/types .next-prev/types
  NEXT_DIST_DIR=.next-build npx next build
  # atomic-ish swap: the live workers keep the old .next until reload
  rm -rf .next-prev; [ -d .next ] && mv .next .next-prev; mv .next-build .next
  unset NODE_OPTIONS
  mkdir -p public/uploads
}

main() {
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
    if [ -z "${DEPLOY_PULLED:-}" ]; then
      pull_code
      # the pull may have replaced this very script — run the new one
      DEPLOY_PULLED=1 exec bash "$APP_DIR/scripts/deploy.sh" deploy
    fi
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
  cards)
    import_cards && log "Card artwork imported ✔ (already live — no restart needed)"
    ;;
  backs)
    rm -f "$BACKS_PDF"; import_backs && log "Card backs imported ✔ (already live — no restart needed)"
    ;;
  video)
    cd "$APP_DIR"; fetch_promo_video && set_video_settings || fail "Promo video not in place."
    pm2 describe "$SERVICE" >/dev/null 2>&1 && pm2 reload ecosystem.config.js --update-env >/dev/null && log "Reloaded ${SERVICE} so the new file is served"
    log "Promo video in place ✔"
    ;;
  caddy)
    [ "$(id -u)" -eq 0 ] || fail "caddy needs root (sudo)."
    provision_caddy
    systemctl status caddy --no-pager | head -3
    log "Caddy ready — certificate for ${DOMAIN} issues on first request (journalctl -u caddy -f to watch)."
    ;;
  logs) pm2 logs "$SERVICE" --lines 100 ;;
  status) pm2 status "$SERVICE" ;;
  *) fail "Unknown command: $cmd (setup | deploy | cards | video | caddy | logs | status)" ;;
esac
}

main "$@"
