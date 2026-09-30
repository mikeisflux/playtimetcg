# DivinityCoin integration

Play Time uses **DivinityCoin** as its payment processor. Source of truth for
the partner API is the `divinitycoin` repo (`src/app/internal/route.ts`,
`src/lib/partner/webhook.ts`, `docs/PARTNER-API-CHANGES-2026-09.md`) and
https://divinitycoin.com/developers.

Everything is configured in **Admin → Settings → DivinityCoin**. Nothing is
hard-coded.

| Setting | Purpose |
|---|---|
| `DIVINITYCOIN_API_URL` | `https://divinitycoin.com`. The partner API is public HTTPS; no VPN or IP allow-list. |
| `DIVINITYCOIN_API_KEY` | Partner API key (`sk_…`) from the partner page. Sent as `Authorization: Bearer <key>`. |
| `DIVINITYCOIN_PARTNER_SLUG` | Our partner slug, `playtimetcg` (sent as `X-Partner`, informational). |
| `DIVINITYCOIN_WEBHOOK_SECRET` | The partner's webhook secret from the DivinityCoin partner page. |
| `DIVINITYCOIN_WEBHOOK_URL` | Read-only: `https://playtimetcg.com/api/webhooks/divinitycoin` — paste it into the partner record. |
| `DIVINITYCOIN_INTERNAL_PATH` | `/internal` (default). Every call is `POST <path>?action=<name>` with a JSON body. |
| `DIVINITYCOIN_AUTH_HEADER` | `Authorization` (default). |
| `DIVINITYCOIN_ALLOW_CREDITS` | Let shoppers pay with a redeemed DivinityCoin credit balance. |
| `DIVINITYCOIN_TEST_MODE` | Replaces the redirect with a local simulator that posts signed events to our own webhook. |

An HTML 403/404 from DivinityCoin means the URL is wrong; a real auth failure
is JSON, e.g. `{"error":"Invalid or expired API key"}` or
`{"error":"Partner account is not active"}` (activate the partner in the
DivinityCoin admin).

## Embedded checkout (the shopper never leaves playtimetcg.com)

The hosted checkout is mounted in an iframe on `/checkout` and
`/checkout/subscribe` (`src/components/DivinityCheckoutFrame.tsx`), the same
way IndieCrowdfund embeds it. The session is created with
`disableAutoRedirect: true`; DivinityCoin's page talks to ours with
`postMessage` (namespace `divinitycoin-checkout`: `ready`, `resize`,
`complete`). On `complete` we call `/api/checkout/confirm` (or
`/api/subscriptions/confirm`), which asks DivinityCoin for the authoritative
session state (`get-checkout-session`) and settles the order or charges the
first subscription period, then navigates to the success page. A slow poll
backs the message up, and if the frame never loads a button reopens a
non-embedded session in the tab.

**DivinityCoin side:** its proxy sends `Content-Security-Policy:
frame-ancestors` on `/checkout/*` from the `CHECKOUT_FRAME_ANCESTORS`
environment variable. It must include our origin or the browser blocks the
frame:

```
CHECKOUT_FRAME_ANCESTORS="https://indiecrowdfund.com https://*.indiecrowdfund.com https://playtimetcg.com https://www.playtimetcg.com"
```

## Units

Card-side calls and events (`create-checkout-session`, `refund`,
`charge-saved-payment-method`, `payment.*`) use **cents**. The credit ledger
(`balance`, `hold`, `capture`, `release`, `validate`) uses **dollars**.

## Actions we use (`POST /internal?action=…`)

| Action | Used for |
|---|---|
| `create-checkout-session` (mode `payment`) | Store checkout. Body: `platformUserId`, `email`, `amount` (cents), `currency`, `pledgeId` = our order id, `projectId` = `playtimetcg-store`, `returnUrl`, `cancelUrl`, `description`. Returns `checkoutUrl` (`https://divinitycoin.com/checkout/cs_…`). |
| `create-checkout-session` (mode `setup`) | Subscriptions: saves a card. Returns `checkoutUrl`; completion delivers `paymentMethodId`. |
| `get-checkout-session` | Success-page self-heal when the webhook is late. |
| `charge-saved-payment-method` | First subscription period and every renewal. `pledgeId` = `sub:<subscriptionId>:<period start>`; `idempotencyKey` = the same string so retries never double-charge. A decline is HTTP 402 with `code` / `declineCode`. |
| `capture` | After any successful charge: DivinityCoin auto-holds the amount as credits under our `pledgeId`; capture moves it to settlement. |
| `refund` | Admin → Orders → Refund. `paymentIntentId` (`pi_…`, stored as the order's `paymentRef`), optional `amount` + `partial: true`. |
| `validate` / `balance` / `hold` / `release` / `capture` | Paying with a redeemed credit code (dollars). |
| `health` (GET) | Admin → Settings → Test DivinityCoin. |

`GET /internal?action=settlements|captures` exist for reconciliation; not used
by the site yet.

## Customer origin (fraud disputes and ban matching)

Every call that creates a charge carries two optional fields DivinityCoin
asks partners for: `customerIpAddress` and `customerUserAgent` — the buyer's
browser, not our server. Without them a chargeback dispute has no evidence
and a banned backer can come back under a new email.

- Captured in the handler serving the browser (`requestOrigin()` in
  `src/lib/auth.ts`: first entry of `X-Forwarded-For`, which Caddy sets, or
  `X-Real-IP`, plus `User-Agent`) and threaded through `startCheckout`,
  `startSubscription` and `resumeSubscriptionSetup` into
  `create-checkout-session` (both modes).
- Stored on the order (`customerIp`, `customerUserAgent` — shown on the
  admin order page as "Placed from") and on the subscription (`cardIp`,
  `cardUserAgent`, recorded when the card-saving checkout was started).
- Renewals run on a cron with no browser present, so
  `charge-saved-payment-method` sends the origin recorded when the card was
  saved. When none was recorded the fields are omitted — never the server's
  own address.
- `cleanOrigin()` in `src/lib/divinitycoin.ts` drops anything that is not
  3–45 chars of IPv4/IPv6, and any loopback, private or link-local address
  (which would mean we were sending our own infrastructure). User-Agent is
  truncated at 512 chars. A bad value never blocks a charge.

Sanity check on the box: the "Placed from" value on recent orders should vary
between buyers and look residential or mobile. If it is always the same, the
proxy is not forwarding the client address.

## Webhook

**Register this URL on the partner record:**

```
https://playtimetcg.com/api/webhooks/divinitycoin
```

Every delivery is `POST` JSON `{ "event", "timestamp", "data" }` with

```
X-Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
X-Webhook-Event: <event>
```

Deliveries older than five minutes are rejected; duplicates (DivinityCoin
retries up to three times on non-2xx) are dropped on `(event, object id)`.

| Event | What we do |
|---|---|
| `checkout.completed` (mode payment) | Capture the hold for `data.pledgeId` (our order) and fulfil the order. |
| `checkout.completed` (mode setup) | Store `data.paymentMethodId` on the pending subscription, charge the first period, activate. |
| `payment.succeeded` | Same as above for orders (idempotent); for `sub:…` references, records the period if the synchronous charge call timed out. |
| `payment.failed`, `checkout.failed/expired/canceled` | Order → failed with the decline reason; subscription period → failed invoice, status `past_due`. |
| `refund.completed` | Order → refunded (partial refunds are noted). |
| `dispute.created` | Order → `disputed`, note with the reason and evidence deadline, email to the admin address. Do not ship. |
| `test.ping` | Ignored (200). |

Failed processing is stored on the `WebhookEvent` row and can be re-run from
Admin → Webhooks.

## Subscriptions and renewals

DivinityCoin has no subscription object. A subscription here is: a saved card
(`providerRef` = `pm:<paymentMethodId>`) plus our own billing loop.
`runRenewals()` in `src/lib/subscriptions.ts` runs every 15 minutes inside
the Next.js server (`src/instrumentation.ts`; a Postgres advisory lock keeps
PM2 workers from double-running). It charges every active or past-due
subscription whose period has ended, retries a decline once a day for seven
days, then ends the subscription. Set `PT_DISABLE_SCHEDULER=1` to turn the
loop off (e.g. on a second server).

## Test mode

With `DIVINITYCOIN_TEST_MODE=true` the frame loads `/checkout/simulate` (same postMessage protocol),
which posts correctly signed `payment.succeeded` / `payment.failed` (orders)
or setup-mode `checkout.completed` (subscriptions) events to our webhook, and
saved-card charges succeed without calling DivinityCoin. Turn it off to use
the real sandbox.
