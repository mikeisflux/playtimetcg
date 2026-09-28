# Server setup — playtimetcg.com

Step by step for a brand-new Ubuntu 24.04 server (any provider: Hetzner,
DigitalOcean, Vultr, Linode…). One box runs everything: Node 22, PostgreSQL,
PM2 and Caddy (which handles HTTPS automatically via Let's Encrypt).

Minimum size: 2 vCPU / 4 GB RAM / 40 GB disk.

## 1. DNS first (so SSL works on the first try)

At your DNS provider, point both names at the server's public IPv4:

| Type | Name | Value |
|---|---|---|
| A | `@` (playtimetcg.com) | `SERVER_IP` |
| A | `www` | `SERVER_IP` |

If the server has IPv6, add matching `AAAA` records. Wait until
`ping playtimetcg.com` resolves to the server before step 5 (Caddy needs the
name to resolve to issue the certificate).

## 2. SSH in as root

```bash
ssh root@SERVER_IP
```

(If your provider gave you a non-root user: `sudo -i` after logging in.)

## 3. Base packages and firewall

```bash
apt update && apt upgrade -y
apt install -y git curl ca-certificates gnupg ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Port 3000 (the Node app) stays closed; only Caddy on 80/443 is public.

## 4. Get the code and set the secrets

```bash
git clone --branch main https://github.com/mikeisflux/playtimetcg.git /opt/playtime
cd /opt/playtime
cat > .env <<'EOF'
SEED_ADMIN_EMAIL="divinitycomicsinc@gmail.com"
SEED_ADMIN_PASSWORD="PUT-THE-ADMIN-PASSWORD-HERE"
EOF
chmod 600 .env
```

`DATABASE_URL` and `AUTH_SECRET` are generated and appended to this file by
the setup script. Everything else (SendGrid, DivinityCoin, SEO ids) is entered
in the admin panel afterwards, not here.

If the code is still on the feature branch rather than `main`, use
`--branch claude/trusting-cori-9iu50l` on the clone and `BRANCH=claude/trusting-cori-9iu50l`
on the deploy commands below.

## 5. Run the setup script

```bash
DOMAIN=playtimetcg.com ./scripts/deploy.sh setup
```

This installs Node 22, PostgreSQL 16 and PM2; creates the database and role;
writes `DATABASE_URL`; runs `prisma db push`; seeds the admin account, the
catalog, the 72-card base deck and default settings; builds the app; starts it
under PM2 in cluster mode (2 workers, auto-restart on reboot); installs Caddy
and writes a Caddyfile for `playtimetcg.com` + `www`; then health-checks it.

Caddy obtains the Let's Encrypt certificate automatically the first time it
sees traffic for the domain. Give it 30–60 seconds after the script finishes,
then open **https://playtimetcg.com**. HTTP redirects to HTTPS, `www`
redirects to the bare domain's certificate too, and renewal is automatic.

Check status any time:

```bash
./scripts/deploy.sh status      # PM2 process list
./scripts/deploy.sh logs        # app logs
systemctl status caddy          # web server / TLS
journalctl -u caddy -n 50       # if the certificate didn't issue
```

## 6. Sign in and configure

1. Go to `https://playtimetcg.com/admin` → sign in with the admin email and the
   password from `.env`.
2. **Settings → Site:** confirm `SITE_URL = https://playtimetcg.com`, set the
   support email, upload the intro video (MP4/H.264) and poster.
3. **Settings → SendGrid:** paste the API key, set the verified From address
   and name, then click **Test SendGrid** (sends you an email).
   - In SendGrid → Settings → Inbound Parse: MX for your inbound subdomain →
     `mx.sendgrid.net`, destination URL
     `https://playtimetcg.com/api/webhooks/sendgrid/inbound?key=<INBOUND_EMAIL_KEY>`
     (make up a long random key and save it in Settings).
   - In SendGrid → Settings → Mail Settings → Event Webhook: URL
     `https://playtimetcg.com/api/webhooks/sendgrid/events?key=<SENDGRID_EVENT_KEY>`,
     enable delivered / opened / clicked / bounced / dropped / spam report.
4. **Emails → Templates:** click **Create default templates**.
5. **Settings → DivinityCoin:** paste the API URL, partner API key and webhook
   signing secret. Copy the webhook URL shown there
   (`https://playtimetcg.com/api/webhooks/divinitycoin`) into DivinityCoin's
   partner settings. Click **Test DivinityCoin**. Leave **Test mode** off in
   production (turn it on temporarily to walk an order through with no money).
6. **Settings → SEO & analytics:** GA4 measurement id, Meta pixel, Search
   Console and Bing verification strings.
7. **Pages:** create privacy, terms, shipping, returns and paste your legal copy.
8. **Products:** confirm the expansion price, upload the product photos.
9. **Cards:** import the real 72-card deck via CSV (columns
   `code,set,title,category,rarity,spice,time,text`).

## 7. Deploying updates later

```bash
cd /opt/playtime && ./scripts/deploy.sh
```

Pulls the branch, installs, syncs the schema, re-seeds (idempotent), builds
into a side folder and hot-swaps it under PM2 with a health check and
automatic rollback if the new build doesn't come up.

## 8. Backups

Nightly database dump, kept for 14 days:

```bash
mkdir -p /opt/playtime/backups
cat > /etc/cron.d/playtime-backup <<'EOF'
15 3 * * * root set -a; . /opt/playtime/.env; set +a; pg_dump "$DATABASE_URL" | gzip > /opt/playtime/backups/playtime-$(date +\%F).sql.gz && find /opt/playtime/backups -name '*.sql.gz' -mtime +14 -delete
EOF
```

Uploaded media lives in `/opt/playtime/public/uploads` — include that folder
in any off-server backup.

## Troubleshooting

- **Certificate not issuing:** DNS not pointing at the server yet, or port 80
  blocked. `journalctl -u caddy -n 100` shows the ACME error. Fix DNS, then
  `systemctl reload caddy`.
- **502 from Caddy:** the app isn't listening. `./scripts/deploy.sh logs`.
- **Locked out of admin:** on the server, set a new password with
  `SEED_ADMIN_PASSWORD="new-pass" npm run db:seed` in `/opt/playtime`.
- **Root SSH login:** see the notes in the README if the provider image ships
  with password auth disabled (`/etc/ssh/sshd_config.d/50-cloud-init.conf`).
