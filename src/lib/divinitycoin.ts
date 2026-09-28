/* DivinityCoin payment processor client.

   DivinityCoin's partner API is one public HTTPS endpoint,
       POST https://divinitycoin.com/internal?action=<name>
   authenticated with  Authorization: Bearer <partner API key>.
   (Source of truth: the divinitycoin repo — src/app/internal/route.ts,
   src/lib/partner/webhook.ts, docs/PARTNER-API-CHANGES-2026-09.md.)

   Units: card-side actions (create-checkout-session, refund, charge-saved-
   payment-method, payment.* webhooks) are in CENTS; the credit ledger
   (balance / hold / capture / release / validate) is in DOLLARS.

   Payment paths:
     1. Hosted checkout — createCheckout() → shopper pays on divinitycoin.com
        → back to returnUrl?session_id=cs_… → webhooks checkout.completed and
        payment.succeeded (the charge is auto-held as credits under our
        order id; we `capture` it so it settles to us).
     2. Credit balance — the shopper redeemed a DivinityCoin code here; we
        hold → capture the order total in dollars.
     3. Subscriptions — a `setup`-mode checkout saves a card; the first period
        and every renewal are charge-saved-payment-method calls from our side
        (DivinityCoin has no subscription object). See src/lib/renewals.ts.

   Webhooks land on /api/webhooks/divinitycoin, signed with
       X-Webhook-Signature: t=<unix>,v1=<HMAC-SHA256(secret, "<t>.<raw body>")>
   and shaped { event, timestamp, data }. */

import { createHmac, timingSafeEqual } from "crypto";
import { getSettings, flag } from "./settings";

export interface CreditBalance { available: number; held: number; total: number }
export interface HoldResult { success: boolean; holdId?: string; error?: string; message?: string }
export interface RedeemResult { success: boolean; amount?: number; balanceAfter?: number; error?: string; message?: string }
export interface SimpleResult { success: boolean; amount?: number; error?: string; message?: string }

export interface CheckoutInput {
  reference: string;       // our order id → DivinityCoin pledgeId
  amountCents: number;
  currency?: string;
  email: string;
  customerId: string;      // our user id (or guest id) → platformUserId
  description: string;
  returnUrl: string;       // DivinityCoin appends ?session_id=cs_…
  cancelUrl: string;
  expiresInMinutes?: number;
}
export interface CheckoutResult { success: boolean; checkoutUrl?: string; sessionId?: string; expiresAt?: string; error?: string }

export interface SetupInput { reference: string; email: string; customerId: string; description: string; returnUrl: string; cancelUrl: string }

export interface CheckoutSession {
  sessionId: string; status: "pending" | "complete" | "expired" | "canceled" | "failed";
  mode: "payment" | "setup"; amount: number | null; pledgeId: string | null;
  paymentIntentId: string | null; setupIntentId: string | null; paymentMethodId: string | null; platformUserId: string;
}

export interface ChargeResult {
  success: boolean; status?: string; paymentIntentId?: string; holdId?: string;
  error?: string; code?: string; declineCode?: string; httpStatus?: number;
}

export type DivinityEventType =
  | "checkout.completed" | "checkout.failed" | "checkout.expired" | "checkout.canceled"
  | "payment.succeeded" | "payment.failed" | "refund.completed" | "dispute.created" | "test.ping";

async function config() {
  const s = await getSettings(["DIVINITYCOIN_API_URL", "DIVINITYCOIN_API_KEY", "DIVINITYCOIN_WEBHOOK_SECRET", "DIVINITYCOIN_PARTNER_SLUG", "DIVINITYCOIN_INTERNAL_PATH", "DIVINITYCOIN_AUTH_HEADER", "DIVINITYCOIN_TEST_MODE", "DIVINITYCOIN_ALLOW_CREDITS", "SITE_URL"]);
  return {
    baseUrl: (s.DIVINITYCOIN_API_URL || "https://divinitycoin.com").replace(/\/$/, ""),
    apiKey: s.DIVINITYCOIN_API_KEY,
    webhookSecret: s.DIVINITYCOIN_WEBHOOK_SECRET,
    partner: s.DIVINITYCOIN_PARTNER_SLUG || "playtimetcg",
    internalPath: (s.DIVINITYCOIN_INTERNAL_PATH || "/internal").replace(/\/$/, ""),
    authHeader: s.DIVINITYCOIN_AUTH_HEADER || "Authorization",
    testMode: flag(s.DIVINITYCOIN_TEST_MODE),
    allowCredits: flag(s.DIVINITYCOIN_ALLOW_CREDITS, true),
    webhookUrl: `${(s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "")}/api/webhooks/divinitycoin`,
  };
}

function authHeaders(c: { authHeader: string; apiKey: string; partner: string }): Record<string, string> {
  const value = /^authorization$/i.test(c.authHeader) ? `Bearer ${c.apiKey}` : c.apiKey;
  return { [c.authHeader]: value, "X-Partner": c.partner };
}

/* The "project" every Play Time charge is filed under on DivinityCoin. */
export const DC_PROJECT_ID = "playtimetcg-store";

export async function divinityConfigured(): Promise<boolean> { return !!(await config()).apiKey; }
export async function divinityTestMode(): Promise<boolean> { return (await config()).testMode; }
export async function divinityWebhookUrl(): Promise<string> { return (await config()).webhookUrl; }

export class DivinityApiError extends Error {
  constructor(message: string, public status: number, public body: Record<string, unknown>) { super(message); }
}

class DivinityCoinClient {
  /* One call = POST <base><internalPath>?action=<action>. Non-2xx throws
     DivinityApiError carrying the JSON body (DivinityCoin always answers
     JSON; an HTML body means the URL is wrong). */
  private async call<T>(action: string, body: object, method: "POST" | "GET" = "POST"): Promise<T> {
    const c = await config();
    if (!c.apiKey) throw new Error("DivinityCoin is not configured (Admin → Settings → DivinityCoin).");
    const url = `${c.baseUrl}${c.internalPath}?action=${encodeURIComponent(action)}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders(c) },
      body: method === "GET" ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text().catch(() => "");
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) }; }
    if (!res.ok) {
      const msg = String(json.error || json.message || `HTTP ${res.status}`);
      console.error(`[divinitycoin] ${method} ${url} -> HTTP ${res.status}: ${msg}`);
      throw new DivinityApiError(`DivinityCoin ${res.status}: ${msg}`, res.status, json);
    }
    return json as T;
  }

  /* ─── credits (dollars) ─── */
  getBalance(userId: string) { return this.call<CreditBalance>("balance", { platformUserId: userId }); }
  redeemCode(code: string, userId: string, ipAddress: string, userAgent?: string): Promise<RedeemResult> {
    return this.call<RedeemResult>("validate", { code: code.toUpperCase().replace(/-/g, ""), platformUserId: userId, ipAddress, userAgent })
      .catch((e): RedeemResult => { if (e instanceof DivinityApiError) return { success: false, error: String(e.body.message || e.body.error || e.message) }; throw e; });
  }
  placeHold(userId: string, amountDollars: number, reference: string, expiresAt?: Date): Promise<HoldResult> {
    return this.call<HoldResult>("hold", { platformUserId: userId, amount: amountDollars, pledgeId: reference, projectId: DC_PROJECT_ID, expiresAt: expiresAt?.toISOString() })
      .catch((e): HoldResult => { if (e instanceof DivinityApiError) return { success: false, error: String(e.body.message || e.body.error || e.message) }; throw e; });
  }
  releaseHold(reference: string) { return this.call<SimpleResult>("release", { pledgeId: reference }); }
  captureHold(reference: string) { return this.call<SimpleResult>("capture", { pledgeId: reference }); }

  /* ─── hosted checkout (cents) ─── */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const c = await config();
    if (c.testMode) {
      const q = new URLSearchParams({ order: input.reference, success: input.returnUrl, cancel: input.cancelUrl });
      return { success: true, checkoutUrl: `/checkout/simulate?${q}`, sessionId: `cs_test_${input.reference}` };
    }
    try {
      const d = await this.call<{ success: boolean; sessionId: string; checkoutUrl: string; expiresAt: string }>("create-checkout-session", {
        platformUserId: input.customerId, email: input.email, mode: "payment",
        amount: Math.round(input.amountCents), currency: (input.currency || "usd").toLowerCase(),
        pledgeId: input.reference, projectId: DC_PROJECT_ID,
        returnUrl: input.returnUrl, cancelUrl: input.cancelUrl, description: input.description,
        expiresInMinutes: input.expiresInMinutes ?? 60,
      });
      if (!d.checkoutUrl) return { success: false, error: "DivinityCoin did not return a checkout URL." };
      return { success: true, checkoutUrl: d.checkoutUrl, sessionId: d.sessionId, expiresAt: d.expiresAt };
    } catch (err) { return { success: false, error: String(err instanceof Error ? err.message : err) }; }
  }

  /* Save a card for later off-session charges (subscriptions). */
  async createSetupCheckout(input: SetupInput): Promise<CheckoutResult> {
    const c = await config();
    if (c.testMode) {
      const q = new URLSearchParams({ subscription: input.reference, success: input.returnUrl, cancel: input.cancelUrl });
      return { success: true, checkoutUrl: `/checkout/simulate?${q}`, sessionId: `cs_test_setup_${input.reference}` };
    }
    try {
      const d = await this.call<{ success: boolean; sessionId: string; checkoutUrl: string; expiresAt: string }>("create-checkout-session", {
        platformUserId: input.customerId, email: input.email, mode: "setup",
        returnUrl: input.returnUrl, cancelUrl: input.cancelUrl, description: input.description, expiresInMinutes: 60,
      });
      if (!d.checkoutUrl) return { success: false, error: "DivinityCoin did not return a checkout URL." };
      return { success: true, checkoutUrl: d.checkoutUrl, sessionId: d.sessionId, expiresAt: d.expiresAt };
    } catch (err) { return { success: false, error: String(err instanceof Error ? err.message : err) }; }
  }

  async getCheckoutSession(sessionId: string): Promise<CheckoutSession | null> {
    if ((await config()).testMode) return null;
    try {
      const d = await this.call<{ success: boolean; session: CheckoutSession }>("get-checkout-session", { sessionId });
      return d.session ?? null;
    } catch (err) {
      if (err instanceof DivinityApiError && err.status === 404) return null;
      throw err;
    }
  }

  async verifyPayment(paymentIntentId: string): Promise<{ status: string; amount: number; pledgeId: string | null; holdId: string | null } | null> {
    try { return await this.call("verify-payment", { paymentIntentId }); }
    catch (err) { if (err instanceof DivinityApiError && err.status === 404) return null; throw err; }
  }

  /* ─── saved cards (subscriptions) ─── */
  async chargeSavedCard(input: { customerId: string; paymentMethodId: string; amountCents: number; reference: string; description: string; idempotencyKey: string }): Promise<ChargeResult> {
    if ((await config()).testMode) return { success: true, status: "succeeded", paymentIntentId: `pi_test_${input.reference}` };
    try {
      const d = await this.call<{ success: boolean; status: string; paymentIntentId: string; holdId?: string }>("charge-saved-payment-method", {
        platformUserId: input.customerId, paymentMethodId: input.paymentMethodId,
        amount: Math.round(input.amountCents), currency: "usd",
        pledgeId: input.reference, projectId: DC_PROJECT_ID, description: input.description,
        idempotencyKey: input.idempotencyKey.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 64),
      });
      return { success: !!d.success, status: d.status, paymentIntentId: d.paymentIntentId, holdId: d.holdId };
    } catch (err) {
      if (err instanceof DivinityApiError) {
        const b = err.body;
        return { success: false, httpStatus: err.status, status: String(b.status || "failed"), error: String(b.error || err.message), code: b.code ? String(b.code) : undefined, declineCode: b.declineCode ? String(b.declineCode) : undefined, paymentIntentId: b.paymentIntentId ? String(b.paymentIntentId) : undefined };
      }
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    }
  }
  async listPaymentMethods(customerId: string): Promise<Array<{ id: string; brand?: string; last4?: string; expMonth?: number; expYear?: number }>> {
    try { return (await this.call<{ paymentMethods: Array<{ id: string; brand?: string; last4?: string; expMonth?: number; expYear?: number }> }>("list-payment-methods", { platformUserId: customerId })).paymentMethods ?? []; }
    catch { return []; }
  }
  detachPaymentMethod(customerId: string, paymentMethodId: string) {
    return this.call<SimpleResult>("detach-payment-method", { platformUserId: customerId, paymentMethodId }).catch(() => ({ success: false }));
  }

  /* ─── refunds (cents) ─── */
  /* Full refund unless `partial` (then `amountCents` is required). A full
     refund also voids the gift card and releases the hold on DivinityCoin. */
  async refund(paymentIntentId: string, amountCents?: number, reason?: string, reference?: string, partial = false): Promise<SimpleResult & { refundId?: string }> {
    if ((await config()).testMode) return { success: true, amount: amountCents };
    try {
      const d = await this.call<{ success: boolean; refundId: string; amount: number; partial: boolean; status: string }>("refund", {
        paymentIntentId, amount: amountCents ? Math.round(amountCents) : undefined, reason, pledgeId: reference, partial,
      });
      return { success: !!d.success, amount: d.amount, refundId: d.refundId };
    } catch (err) { return { success: false, error: String(err instanceof Error ? err.message : err) }; }
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      const c = await config();
      if (!c.apiKey) return { ok: false, detail: "API key not set" };
      const url = `${c.baseUrl}${c.internalPath}?action=health`;
      const res = await fetch(url, { headers: authHeaders(c), signal: AbortSignal.timeout(8000) });
      const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 300);
      const server = res.headers.get("server") || "unknown";
      if (!res.ok) {
        console.error(`[divinitycoin] GET ${url} -> HTTP ${res.status} (server: ${server}; partner: ${c.partner}; key: ${c.apiKey.slice(0, 4)}…${c.apiKey.slice(-4)}) body: ${body}`);
        return { ok: false, detail: `HTTP ${res.status}${body ? `: ${body}` : ""}` };
      }
      return { ok: true, detail: body };
    } catch (err) { return { ok: false, detail: String(err) }; }
  }
}

export const divinitycoin = new DivinityCoinClient();

/* ─── webhook signature ───
   X-Webhook-Signature: t=<unix>,v1=<hex>, v1 = HMAC-SHA256(secret, `${t}.${rawBody}`).
   Deliveries older than 5 minutes are rejected. A bare hex HMAC over the raw
   body is also accepted (used by the local simulator). */
export async function verifyWebhookSignature(rawBody: string, header: string | null, secretOverride?: string): Promise<{ ok: boolean; reason?: string }> {
  const secret = secretOverride ?? (await config()).webhookSecret;
  if (!secret) return { ok: false, reason: "DIVINITYCOIN_WEBHOOK_SECRET not configured" };
  if (!header) return { ok: false, reason: "missing signature header" };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  let expected: string;
  let provided: string;
  if (parts.v1 && parts.t) {
    const age = Math.abs(Date.now() / 1000 - Number(parts.t));
    if (!Number.isFinite(age) || age > 300) return { ok: false, reason: "timestamp outside tolerance" };
    expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
    provided = parts.v1;
  } else {
    expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    provided = header.replace(/^sha256=/, "").trim();
  }
  const a = Buffer.from(provided, "hex"), b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0 || !timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}

export function signWebhookPayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;
}

/* Envelope DivinityCoin delivers: { event, timestamp, data }. */
export interface DivinityWebhookEvent {
  event: DivinityEventType | string;
  timestamp?: string;
  data: {
    sessionId?: string; mode?: "payment" | "setup"; status?: string;
    paymentIntentId?: string; setupIntentId?: string; paymentMethodId?: string;
    amount?: number;           // cents
    currency?: string;
    platformUserId?: string; email?: string;
    pledgeId?: string; projectId?: string;
    hold?: { holdId: string; amount: number; status: string } | null;
    paymentMethod?: { type?: string; brand?: string; last4?: string } | null;
    type?: "initial" | "upcharge";
    error?: string; code?: string; declineCode?: string;
    refundId?: string; partial?: boolean;
    disputeId?: string; stripePaymentIntentId?: string; reason?: string; evidenceDueBy?: string;
    [k: string]: unknown;
  };
}
