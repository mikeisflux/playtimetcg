/* DivinityCoin payment processor client.

   Mirrors the CreatorCredits/IndieCrowdfund integration (divinitycoin repo,
   giftcard-service-spec §9): a server-to-server client authenticated with the
   partner key in `X-Internal-Key`, using the same endpoint names and shapes
   (/internal/balance, /internal/validate, /internal/hold, /internal/release,
   /internal/capture, /internal/health), plus the hosted-checkout path that
   redirects the shopper to DivinityCoin and reports back through the signed
   webhook at  https://playtimetcg.com/api/webhooks/divinitycoin .

   Two payment paths:
     1. Hosted checkout — createCheckout() → redirect → webhook `payment.completed`
     2. Credit balance  — the shopper redeemed a DivinityCoin code here; we
        place a hold for the order total and capture it immediately.
   Subscriptions use createSubscriptionCheckout(); renewals arrive as
   `subscription.renewed` / `subscription.payment_failed` webhooks. */

import { createHmac, timingSafeEqual } from "crypto";
import { getSettings, flag } from "./settings";

export interface CreditBalance {
  available: number; held: number; total: number;
  activeHolds: Array<{ holdId: string; amount: number; pledgeId: string; projectId: string; createdAt: string }>;
}
export interface HoldResult { success: boolean; holdId?: string; error?: string }
export interface RedeemResult { success: boolean; amount?: number; balanceAfter?: number; error?: string }
export interface SimpleResult { success: boolean; amount?: number; error?: string }

export interface CheckoutInput {
  orderId: string;
  amount: number;          // dollars
  currency?: string;
  email: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;     // our user id → platformUserId
  metadata?: Record<string, string>;
  lineItems?: Array<{ name: string; quantity: number; unitAmount: number }>;
}
export interface CheckoutResult { success: boolean; checkoutUrl?: string; sessionId?: string; error?: string }

export interface SubscriptionCheckoutInput {
  subscriptionId: string;  // our id
  plan: string;
  amount: number;          // dollars per interval
  interval: "month" | "year";
  email: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerId: string;
}

async function config() {
  const s = await getSettings(["DIVINITYCOIN_API_URL", "DIVINITYCOIN_API_KEY", "DIVINITYCOIN_WEBHOOK_SECRET", "DIVINITYCOIN_PARTNER_SLUG", "DIVINITYCOIN_CHECKOUT_PATH", "DIVINITYCOIN_TEST_MODE", "DIVINITYCOIN_ALLOW_CREDITS", "SITE_URL"]);
  return {
    baseUrl: (s.DIVINITYCOIN_API_URL || "https://divinitycoin.com").replace(/\/$/, ""),
    apiKey: s.DIVINITYCOIN_API_KEY,
    webhookSecret: s.DIVINITYCOIN_WEBHOOK_SECRET,
    partner: s.DIVINITYCOIN_PARTNER_SLUG || "playtimetcg",
    checkoutPath: s.DIVINITYCOIN_CHECKOUT_PATH || "/api/partner/checkout",
    testMode: flag(s.DIVINITYCOIN_TEST_MODE),
    allowCredits: flag(s.DIVINITYCOIN_ALLOW_CREDITS, true),
    webhookUrl: `${(s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "")}/api/webhooks/divinitycoin`,
  };
}

export async function divinityConfigured(): Promise<boolean> {
  const c = await config();
  return !!c.apiKey;
}

export async function divinityWebhookUrl(): Promise<string> {
  return (await config()).webhookUrl;
}

class DivinityCoinClient {
  private async request<T>(endpoint: string, body: object, method = "POST"): Promise<T> {
    const c = await config();
    if (!c.apiKey) throw new Error("DivinityCoin is not configured (Admin → Settings → DivinityCoin).");
    const res = await fetch(`${c.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": c.apiKey,
        "X-Partner": c.partner,
      },
      body: method === "GET" ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[divinitycoin] ${method} ${c.baseUrl}${endpoint} -> HTTP ${res.status} ${txt.slice(0, 300)}`);
      throw new Error(`DivinityCoin ${res.status}: ${txt.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  /* ─── credits (spec §9.2) ─── */
  getBalance(userId: string) {
    return this.request<CreditBalance>("/internal/balance", { platformUserId: userId });
  }
  redeemCode(code: string, userId: string, ipAddress: string, userAgent?: string) {
    return this.request<RedeemResult>("/internal/validate", {
      code: code.toUpperCase().replace(/-/g, ""), platformUserId: userId, ipAddress, userAgent,
    });
  }
  placeHold(userId: string, amount: number, orderId: string, expiresAt?: Date) {
    /* pledgeId/projectId keep the CreatorCredits field names; for a store the
       "pledge" is the order and the "project" is this partner. */
    return this.request<HoldResult>("/internal/hold", {
      platformUserId: userId, amount, pledgeId: orderId, projectId: "playtimetcg-order",
      expiresAt: expiresAt?.toISOString(),
    });
  }
  releaseHold(orderId: string) {
    return this.request<SimpleResult>("/internal/release", { pledgeId: orderId });
  }
  captureHold(orderId: string) {
    return this.request<SimpleResult>("/internal/capture", { pledgeId: orderId });
  }
  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      const c = await config();
      if (!c.apiKey) return { ok: false, detail: "API key not set" };
      const res = await fetch(`${c.baseUrl}/internal/health`, { headers: { "X-Internal-Key": c.apiKey }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) console.error(`[divinitycoin] GET ${c.baseUrl}/internal/health -> HTTP ${res.status}`);
      return { ok: res.ok, detail: res.ok ? await res.text() : `HTTP ${res.status}` };
    } catch (err) { return { ok: false, detail: String(err) }; }
  }

  /* ─── hosted checkout ─── */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const c = await config();
    if (c.testMode) {
      /* Test mode: bounce straight to a local simulator page that lets the
         operator "pay" — it POSTs a signed payload to our own webhook. */
      const q = new URLSearchParams({ order: input.orderId, success: input.successUrl, cancel: input.cancelUrl });
      return { success: true, checkoutUrl: `/checkout/simulate?${q}`, sessionId: `test_${input.orderId}` };
    }
    try {
      const data = await this.request<{ checkoutUrl?: string; url?: string; sessionId?: string; id?: string; error?: string }>(c.checkoutPath, {
        partner: c.partner,
        reference: input.orderId,
        amount: Number(input.amount.toFixed(2)),
        currency: input.currency || "USD",
        email: input.email,
        platformUserId: input.customerId,
        description: input.description,
        lineItems: input.lineItems,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        webhookUrl: c.webhookUrl,
        metadata: { ...input.metadata, orderId: input.orderId },
      });
      const checkoutUrl = data.checkoutUrl || data.url;
      if (!checkoutUrl) return { success: false, error: data.error || "DivinityCoin did not return a checkout URL." };
      return { success: true, checkoutUrl, sessionId: data.sessionId || data.id };
    } catch (err) { return { success: false, error: String(err) }; }
  }

  async createSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<CheckoutResult> {
    const c = await config();
    if (c.testMode) {
      const q = new URLSearchParams({ subscription: input.subscriptionId, success: input.successUrl, cancel: input.cancelUrl });
      return { success: true, checkoutUrl: `/checkout/simulate?${q}`, sessionId: `test_sub_${input.subscriptionId}` };
    }
    try {
      const data = await this.request<{ checkoutUrl?: string; url?: string; sessionId?: string; id?: string; error?: string }>(`${c.checkoutPath}/subscription`, {
        partner: c.partner,
        reference: input.subscriptionId,
        plan: input.plan,
        amount: Number(input.amount.toFixed(2)),
        interval: input.interval,
        email: input.email,
        platformUserId: input.customerId,
        description: input.description,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        webhookUrl: c.webhookUrl,
      });
      const checkoutUrl = data.checkoutUrl || data.url;
      if (!checkoutUrl) return { success: false, error: data.error || "DivinityCoin did not return a checkout URL." };
      return { success: true, checkoutUrl, sessionId: data.sessionId || data.id };
    } catch (err) { return { success: false, error: String(err) }; }
  }

  async cancelSubscription(providerRef: string): Promise<SimpleResult> {
    const c = await config();
    if (c.testMode) return { success: true };
    try { return await this.request<SimpleResult>(`${c.checkoutPath}/subscription/cancel`, { partner: c.partner, subscriptionId: providerRef }); }
    catch (err) { return { success: false, error: String(err) }; }
  }

  async refund(paymentRef: string, amount?: number, reason?: string): Promise<SimpleResult> {
    const c = await config();
    if (c.testMode) return { success: true, amount };
    try { return await this.request<SimpleResult>(`${c.checkoutPath}/refund`, { partner: c.partner, paymentId: paymentRef, amount, reason }); }
    catch (err) { return { success: false, error: String(err) }; }
  }
}

export const divinitycoin = new DivinityCoinClient();

/* ─── webhook signature ───
   DivinityCoin signs each delivery:  X-DivinityCoin-Signature: t=<unix>,v1=<hex>
   where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). Deliveries older than
   5 minutes are rejected (replay protection). A bare hex signature over the
   raw body is also accepted for simpler senders. */
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

/* Event shapes we accept. `type` follows <resource>.<event>. */
export interface DivinityWebhookEvent {
  id: string;
  type:
    | "payment.completed" | "payment.failed" | "payment.refunded" | "payment.cancelled"
    | "subscription.activated" | "subscription.renewed" | "subscription.payment_failed" | "subscription.cancelled"
    | "checkout.expired" | "ping";
  created?: string | number;
  data: {
    reference?: string;        // our order id / subscription id
    orderId?: string;
    subscriptionId?: string;   // DivinityCoin's subscription id
    paymentId?: string;
    sessionId?: string;
    amount?: number;           // dollars
    currency?: string;
    email?: string;
    platformUserId?: string;
    currentPeriodEnd?: string;
    periodStart?: string;
    periodEnd?: string;
    reason?: string;
    metadata?: Record<string, string>;
  };
}
