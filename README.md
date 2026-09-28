# Play Time — [playtimetcg.com](https://playtimetcg.com)

**The adult card game for couples.** 72 cards, one 12-sided die, written by a
practicing sex therapist. This repository is the whole site: direct
storefront, subscriptions, online play with digital card collections, and the
admin console. Built and operated by **Divinity Comics Inc**.

## What's here

| Area | Where |
|---|---|
| Storefront (age-gated, intro video on first visit) | `/`, `/shop`, `/shop/[slug]`, `/cart`, `/checkout` |
| Marketing | `/how-to-play`, `/the-deck`, `/expansions`, `/pricing` |
| Legal / help (owner-edited copy) | `/privacy`, `/terms`, `/shipping`, `/returns`, `/contact` |
| Accounts (email + password only) | `/signup`, `/login`, `/forgot`, `/reset`, `/account/*` |
| Subscriptions | Monthly 3-card drop (shipped) and Online play — `/shop/monthly-cards`, `/shop/online-play` |
| Online play | `/play` (rooms, d12, draw/read/answer), `/play/collection`, `/play/packs` (tear-open animation) |
| Payments | DivinityCoin — hosted checkout, credit balance, subscriptions. Webhook: `/api/webhooks/divinitycoin` — see [docs/DIVINITYCOIN.md](docs/DIVINITYCOIN.md) |
| Admin | `/admin` — dashboard, orders, products, cards (CSV import), users, subscriptions, email inbox/compose/templates/logs (SendGrid, attachments, rich HTML), SEO manager, pages, games, webhooks, `/admin/settings` for every API key |

## Stack

Next.js 16 (App Router) · React 19.3 · TypeScript 7 · Node 22 · Prisma 7.10 ·
PostgreSQL · plain CSS from `design/handoff/tokens.json` · SendGrid (mail send,
Inbound Parse, Event Webhook) · DivinityCoin · PM2 + Caddy.

## Local development

```bash
cp .env.example .env            # set DATABASE_URL (PostgreSQL) and SEED_ADMIN_PASSWORD
npm install                     # also runs prisma generate
npm run setup                   # prisma db push + seed (admin, catalog, sample cards, settings)
npm run dev
```

Admin: `divinitycomicsinc@gmail.com` with the password from `SEED_ADMIN_PASSWORD`
(a random one is printed once if unset). Configure SendGrid, DivinityCoin, SEO
ids etc. in **/admin/settings** — they are stored in the database, not in `.env`.

## Deploy (Ubuntu, root)

Full walkthrough with DNS, firewall, SSL and post-install configuration: [docs/SERVER-SETUP.md](docs/SERVER-SETUP.md).

```bash
git clone https://github.com/mikeisflux/playtimetcg.git /opt/playtime
echo 'SEED_ADMIN_PASSWORD="…"' >> /opt/playtime/.env
sudo /opt/playtime/scripts/deploy.sh setup     # Node 22, PostgreSQL, PM2, Caddy (TLS), build, seed
sudo /opt/playtime/scripts/deploy.sh           # later deploys, zero-downtime with rollback
```

Then in DivinityCoin's partner settings, register the webhook
`https://playtimetcg.com/api/webhooks/divinitycoin` and paste the API key and
webhook secret into **/admin/settings → DivinityCoin**. Point SendGrid Inbound
Parse at `/api/webhooks/sendgrid/inbound?key=<INBOUND_EMAIL_KEY>` and the Event
Webhook at `/api/webhooks/sendgrid/events?key=<SENDGRID_EVENT_KEY>`.

## Owner to-dos (from the design handoff)

1. Confirm the expansion pack price (seeded at the $14 placeholder).
2. Write Privacy, Terms, Shipping, Returns in Admin → Pages.
3. Upload product photos for the four image slots and the intro video (Admin → Settings / Products).
4. Import the real 72-card deck (Admin → Cards → CSV import) — placeholders are seeded so online play works today.
5. Confirm DivinityCoin's adult-product and age-verification requirements before launch.

## Design handoff

`design/handoff/` holds the spec (`README.md`), tokens, content JSON and the
hi-fi Home prototype. The site recreates it; the prototype's runtime files are
reference only and are not shipped.
