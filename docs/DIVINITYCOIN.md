# DivinityCoin integration

Play Time uses **DivinityCoin** as its payment processor. The integration
mirrors the CreatorCredits ↔ IndieCrowdfund contract from the `divinitycoin`
repo (`giftcard-service-spec`, §6.3 and §9): the same endpoint names, request
shapes and `X-Internal-Key` header, plus a hosted-checkout redirect and a
signed webhook for asynchronous results.

Everything is configured in **Admin → Settings → DivinityCoin**. Nothing is
hard-coded.

| Setting | Purpose |
|---|---|
| `DIVINITYCOIN_API_URL` | Base URL of the DivinityCoin API, `https://divinitycoin.com`. The partner API is public HTTPS; no VPN or IP allow-list is needed. |
| `DIVINITYCOIN_API_KEY` | Partner key (`sk_…`), sent in the header named by `DIVINITYCOIN_AUTH_HEADER` on every server-to-server call. |
| `DIVINITYCOIN_AUTH_HEADER` | `Authorization` (default; sends `Bearer <key>`). `X-Internal-Key` for the VPN service. |
| `DIVINITYCOIN_PUBLIC_KEY` | Publishable key, if DivinityCoin issues one alongside the API key. Stored for the hosted checkout; not required by the server-to-server calls. |
| `DIVINITYCOIN_PARTNER_SLUG` | Our partner id on DivinityCoin (`playtimetcg`). Sent as `X-Partner`. |
| `DIVINITYCOIN_WEBHOOK_SECRET` | HMAC-SHA256 secret DivinityCoin signs webhook deliveries with. |
| `DIVINITYCOIN_INTERNAL_PATH` | The partner endpoint, default `/internal`. Every call is `POST <prefix>?action=<name>` with a JSON body. |
| `DIVINITYCOIN_CHECKOUT_PATH` | Hosted checkout endpoint path (default `/api/partner/checkout`). |
| `DIVINITYCOIN_ALLOW_CREDITS` | Let shoppers pay with a redeemed credit balance. |
| `DIVINITYCOIN_TEST_MODE` | Replaces the redirect with a local simulator that posts signed events to our own webhook. |

## Webhook

**Register this URL on DivinityCoin:**

```
https://playtimetcg.com/api/webhooks/divinitycoin
```

Every delivery is a JSON `POST`:

```json
{
  "id": "evt_01H…",
  "type": "payment.completed",
  "created": "2026-09-28T12:00:00Z",
  "data": {
    "reference": "<our order id or subscription id>",
    "paymentId": "pay_…",
    "sessionId": "cs_…",
    "amount": 35.00,
    "currency": "USD",
    "email": "buyer@example.com",
    "platformUserId": "<our user id>",
    "subscriptionId": "sub_…",
    "currentPeriodEnd": "2026-10-28T12:00:00Z",
    "reason": "optional failure/refund reason",
    "metadata": { "orderId": "…" }
  }
}
```

Signature header:

```
X-DivinityCoin-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
```

Deliveries older than 5 minutes are rejected (replay protection). A bare
`sha256=<hex>` over the raw body is also accepted. The handler is idempotent on
`(provider, event.id)` and always answers `200` for a verified event; a
processing error is stored on the `WebhookEvent` row and can be re-run from
**Admin → Webhooks**.

### Event types handled

| Type | Effect |
|---|---|
| `payment.completed` | Order → `paid` (digital items granted, receipt sent, all-digital orders → `fulfilled`). If `reference` is a subscription id → subscription activated. |
| `payment.failed`, `payment.cancelled`, `checkout.expired` | Order → `failed`; pending subscription → `expired`. |
| `payment.refunded` | Order → `refunded`. |
| `subscription.activated`, `subscription.renewed` | Subscription → `active`, `currentPeriodEnd` updated, invoice recorded, online-play starter deck granted, email sent. |
| `subscription.payment_failed` | Subscription → `past_due` (7-day grace for online play), email sent. |
| `subscription.cancelled` | Subscription → `cancelled`, email sent. |
| `ping` | Ignored (200). |

## Outbound calls (Play Time → DivinityCoin)

All `POST`, JSON, with `X-Internal-Key` and `X-Partner`.

### Credits (identical to the IndieCrowdfund client, §9.2)

| Endpoint | Body | Used for |
|---|---|---|
| `POST /internal?action=balance` | `{ platformUserId }` | Checkout "Pay with credits", Account → Credits |
| `POST /internal?action=validate` | `{ code, platformUserId, ipAddress, userAgent }` | Account → Credits → Redeem a code |
| `POST /internal?action=hold` | `{ platformUserId, amount, pledgeId: <orderId>, projectId: "playtimetcg-order", expiresAt }` | Pay with credits (step 1) |
| `POST /internal?action=capture` | `{ pledgeId: <orderId> }` | Pay with credits (step 2) |
| `POST /internal?action=release` | `{ pledgeId: <orderId> }` | Rollback when capture fails |
| `GET /internal/health` | — | Admin dashboard / Settings → Test |

### Hosted checkout

| Endpoint | Body | Response |
|---|---|---|
| `{CHECKOUT_PATH}` | `{ partner, reference, amount, currency, email, platformUserId, description, lineItems[], successUrl, cancelUrl, webhookUrl, metadata }` | `{ checkoutUrl, sessionId }` |
| `{CHECKOUT_PATH}/subscription` | `{ partner, reference, plan, amount, interval, email, platformUserId, description, successUrl, cancelUrl, webhookUrl }` | `{ checkoutUrl, sessionId }` |
| `{CHECKOUT_PATH}/subscription/cancel` | `{ partner, subscriptionId }` | `{ success }` |
| `{CHECKOUT_PATH}/refund` | `{ partner, paymentId, amount?, reason? }` | `{ success, amount }` |

`reference` is always our own id (order or subscription) and comes back in
`data.reference` on the webhook, which is how the two sides are matched.

## Flows

1. **Card checkout** — `/checkout` → `POST /api/checkout` creates the order
   (`pending`), calls hosted checkout, marks `awaiting_payment`, redirects the
   shopper. DivinityCoin sends `payment.completed` → order `paid`. The success
   page shows the live status.
2. **Pay with credits** — same, but `method: "credits"`: balance check → hold
   → capture → `paid` synchronously. Ledger rows are written locally.
3. **Subscriptions** — `POST /api/subscriptions/start` creates a `pending`
   subscription and redirects to subscription checkout. Activation and every
   renewal arrive by webhook. Online play grants the 72-card base deck on
   first activation.
4. **Test mode** — with `DIVINITYCOIN_TEST_MODE=true` the redirect goes to
   `/checkout/simulate`, which posts a correctly signed `payment.completed`
   (or `payment.failed`) to our webhook. Set any long random
   `DIVINITYCOIN_WEBHOOK_SECRET` first.

## Code

- `src/lib/divinitycoin.ts` — client, signature verification, event types
- `src/lib/orders.ts` — pricing, order creation, credits payment, fulfilment, `processDivinityEvent`
- `src/app/api/webhooks/divinitycoin/route.ts` — the webhook
- `src/app/api/checkout/*`, `src/app/api/subscriptions/start` — storefront entry points
- `src/app/api/account/credits/redeem` — code redemption (spec §9.6)
