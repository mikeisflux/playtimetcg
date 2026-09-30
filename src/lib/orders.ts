/* Orders: create from a cart, price it, pay it through DivinityCoin, fulfil
   digital items, and process DivinityCoin webhook events. */
import { prisma } from "./db";
import { getSettings, flag } from "./settings";
import { divinitycoin, cleanOrigin, type CustomerOrigin, type DivinityWebhookEvent } from "./divinitycoin";
import { isSubscriptionReference, onSubscriptionSetupComplete, onSubscriptionChargeEvent } from "./subscriptions";
import { sendTemplate } from "./sendgrid";
import { grantPacks } from "./packs";
import { money } from "./content";
import type { Order, OrderItem, Product } from "@/generated/prisma/client";

export interface CartLineInput { id: string; qty: number; choices?: string[] }
export interface ShippingInput {
  name: string; line1: string; line2?: string; city: string; region: string; postal: string; country: string; phone?: string;
}

export interface PricedCart {
  items: Array<{ product: Product; qty: number; choices: string[]; choiceNames: string[]; unitCents: number; lineCents: number }>;
  subtotalCents: number; shippingCents: number; taxCents: number; totalCents: number; needsShipping: boolean;
  problems: string[];
}

export async function priceCart(lines: CartLineInput[]): Promise<PricedCart> {
  const ids = Array.from(new Set(lines.map((l) => l.id)));
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids }, active: true } }) : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const expansions = await prisma.product.findMany({ where: { kind: "expansion", active: true } });
  const expBySlug = new Map(expansions.map((e) => [e.slug, e]));
  const problems: string[] = [];
  const items: PricedCart["items"] = [];

  for (const l of lines) {
    const p = byId.get(l.id);
    const qty = Math.max(1, Math.min(50, Math.floor(Number(l.qty) || 1)));
    if (!p) { problems.push("An item in your cart is no longer available and was removed."); continue; }
    if (p.kind === "subscription") { problems.push(`${p.name} is a subscription — start it from its product page.`); continue; }
    let choices: string[] = [];
    let choiceNames: string[] = [];
    const rc = p.requiresChoice as { type: string; count: number } | null;
    if (rc && rc.count > 0) {
      choices = (l.choices ?? []).filter((s) => expBySlug.has(s)).slice(0, rc.count);
      if (choices.length !== rc.count) { problems.push(`${p.name}: choose ${rc.count} expansion packs.`); continue; }
      choiceNames = choices.map((s) => expBySlug.get(s)!.name);
    }
    items.push({ product: p, qty, choices, choiceNames, unitCents: p.priceCents, lineCents: p.priceCents * qty });
  }

  const s = await getSettings(["SHIPPING_FLAT_CENTS", "SHIPPING_FREE_OVER_CENTS", "TAX_RATE_PERCENT"]);
  const subtotalCents = items.reduce((n, i) => n + i.lineCents, 0);
  const needsShipping = items.some((i) => !i.product.digital);
  const flat = Number(s.SHIPPING_FLAT_CENTS) || 0;
  const freeOver = Number(s.SHIPPING_FREE_OVER_CENTS) || 0;
  const shippingCents = !needsShipping || subtotalCents === 0 ? 0 : (freeOver > 0 && subtotalCents >= freeOver ? 0 : flat);
  const taxRate = Number(s.TAX_RATE_PERCENT) || 0;
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  return { items, subtotalCents, shippingCents, taxCents, totalCents: subtotalCents + shippingCents + taxCents, needsShipping, problems };
}

export async function createOrder(input: {
  lines: CartLineInput[]; email: string; userId?: string | null; shipping?: ShippingInput | null; notes?: string; discreet?: boolean;
}): Promise<{ order: Order & { items: OrderItem[] }; priced: PricedCart }> {
  const priced = await priceCart(input.lines);
  if (priced.problems.length) throw new Error(priced.problems[0]);
  if (!priced.items.length) throw new Error("Your cart is empty.");
  if (priced.needsShipping && !input.shipping) throw new Error("A shipping address is required.");
  const order = await prisma.order.create({
    data: {
      userId: input.userId ?? null,
      email: input.email.trim().toLowerCase(),
      status: "pending",
      subtotalCents: priced.subtotalCents,
      shippingCents: priced.shippingCents,
      taxCents: priced.taxCents,
      totalCents: priced.totalCents,
      needsShipping: priced.needsShipping,
      shipping: priced.needsShipping && input.shipping ? JSON.parse(JSON.stringify(input.shipping)) : undefined,
      notes: input.notes?.slice(0, 1000) || null,
      discreetPackaging: input.discreet ?? true,
      items: {
        create: priced.items.map((i) => ({
          productId: i.product.id, name: i.product.name, unitCents: i.unitCents, qty: i.qty,
          choices: i.choices.length ? { slugs: i.choices, names: i.choiceNames } : undefined,
        })),
      },
    },
    include: { items: true },
  });
  return { order, priced };
}

/* Start a DivinityCoin hosted checkout for an order. DivinityCoin sends the
   shopper back to returnUrl with ?session_id=cs_… and fires
   checkout.completed + payment.succeeded to our webhook. */
export async function startCheckout(orderId: string, opts: { embed?: boolean; origin?: CustomerOrigin | null } = {}): Promise<{ url: string; sessionId: string | null }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error("Order not found.");
  if (order.status === "paid" || order.status === "fulfilled") throw new Error("This order is already paid.");
  const s = await getSettings(["SITE_URL", "SITE_NAME"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  const res = await divinitycoin.createCheckout({
    reference: order.id,
    amountCents: order.totalCents,
    currency: order.currency,
    email: order.email,
    customerId: platformUserId(order.userId, order.id),
    description: `${s.SITE_NAME || "Play Time"} order #${order.number} — ${order.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}`.slice(0, 200),
    returnUrl: `${base}/checkout/success?order=${order.id}`,
    cancelUrl: `${base}/checkout/cancel?order=${order.id}`,
    embed: opts.embed,
    origin: opts.origin,
  });
  if (!res.success || !res.checkoutUrl) throw new Error(res.error || "Could not start DivinityCoin checkout.");
  const origin = cleanOrigin(opts.origin);
  await prisma.order.update({ where: { id: order.id }, data: { status: "awaiting_payment", paymentMethod: "divinitycoin_checkout", paymentRef: res.sessionId ?? null, ...(origin.ip ? { customerIp: origin.ip, customerUserAgent: origin.userAgent } : {}) } });
  return { url: res.checkoutUrl, sessionId: res.sessionId ?? null };
}

/* DivinityCoin keys credit balances by platformUserId. Signed-in shoppers use
   their user id; guests get a per-order id so nothing is shared. */
export function platformUserId(userId: string | null | undefined, orderId: string): string {
  return userId || `guest_${orderId}`;
}

/* Pay with the shopper's DivinityCoin credit balance: hold → capture. */
export async function payWithCredits(orderId: string, userId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw new Error("Order not found.");
  if (order.status === "paid" || order.status === "fulfilled") return;
  const s = await getSettings(["DIVINITYCOIN_ALLOW_CREDITS"]);
  if (!flag(s.DIVINITYCOIN_ALLOW_CREDITS, true)) throw new Error("Paying with credits is disabled.");
  const amount = order.totalCents / 100;
  const balance = await divinitycoin.getBalance(userId);
  if (balance.available < amount) {
    throw new Error(`Not enough DivinityCoin credit: ${money(Math.round(balance.available * 100))} available, ${money(order.totalCents)} needed.`);
  }
  const hold = await divinitycoin.placeHold(userId, amount, order.id, new Date(Date.now() + 3600_000));
  if (!hold.success) throw new Error(hold.error || "Could not hold credits.");
  await prisma.order.update({ where: { id: order.id }, data: { creditHoldId: hold.holdId ?? null, paymentMethod: "divinitycoin_credits" } });
  await prisma.creditLedger.create({ data: { userId, type: "hold", amountCents: -order.totalCents, reference: order.id, description: `Hold for order #${order.number}` } });
  const cap = await divinitycoin.captureHold(order.id);
  if (!cap.success) {
    await divinitycoin.releaseHold(order.id).catch(() => {});
    throw new Error(cap.error || "Could not capture credits.");
  }
  await prisma.creditLedger.create({ data: { userId, type: "capture", amountCents: -order.totalCents, reference: order.id, description: `Paid order #${order.number} with credits` } });
  await fulfillPaidOrder(order.id, { paymentMethod: "divinitycoin_credits", paymentRef: hold.holdId });
}

/* Idempotent: mark paid, grant digital items, send the receipt. */
export async function fulfillPaidOrder(orderId: string, opts: { paymentRef?: string; paymentMethod?: string } = {}): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } }, user: true } });
  if (!order) throw new Error("Order not found.");
  if (!["paid", "fulfilled", "shipped"].includes(order.status)) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "paid", paidAt: new Date(),
        ...(opts.paymentRef ? { paymentRef: opts.paymentRef } : {}),
        ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
      },
    });
  }
  /* digital grants — once per item */
  if (order.userId) {
    for (const it of order.items) {
      if (it.digitalGranted || !it.product?.digital) continue;
      if (it.product.kind === "digital_pack") await grantPacks(order.userId, it.product.id, it.qty);
      await prisma.orderItem.update({ where: { id: it.id }, data: { digitalGranted: true } });
    }
  }
  const allDigital = order.items.every((i) => i.product?.digital);
  if (allDigital) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "fulfilled", fulfilledAt: new Date() } });
  }
  if (!order.paidAt) {
    const shipping = order.shipping as ShippingInput | null;
    await sendTemplate("order_receipt", order.email, {
      subject: `Your Play Time order #${order.number}`,
      fallbackText: `Thanks for your order #${order.number}. Total ${money(order.totalCents)}.`,
      name: shipping?.name || order.user?.name || "there",
      orderNumber: order.number,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, unit: money(i.unitCents), total: money(i.unitCents * i.qty) })),
      itemsHtml: order.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #2a272e">${i.name} × ${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #2a272e;text-align:right">${money(i.unitCents * i.qty)}</td></tr>`).join(""),
      subtotal: money(order.subtotalCents), shipping: money(order.shippingCents), tax: money(order.taxCents), total: money(order.totalCents),
      shippingAddress: shipping ? [shipping.name, shipping.line1, shipping.line2, `${shipping.city}, ${shipping.region} ${shipping.postal}`, shipping.country].filter(Boolean).join(", ") : "Digital delivery",
      digital: allDigital ? "yes" : "",
    }, { orderId: order.id, userId: order.userId ?? undefined });
  }
}

export async function markOrderFailed(orderId: string, reason: string) {
  await prisma.order.updateMany({ where: { id: orderId, status: { in: ["pending", "awaiting_payment"] } }, data: { status: "failed", notes: reason.slice(0, 500) } });
}

/* ───────── Subscriptions ───────── */

/* ───────── Webhook processing (DivinityCoin → us) ─────────
   Envelope { event, timestamp, data }; `data.pledgeId` is our reference: an
   order id, or "sub:<subscriptionId>:<period>" for subscription charges. */
export async function processDivinityEvent(evt: { id: string; type: string; data: Record<string, unknown> }): Promise<{ status: "processed" | "ignored"; note?: string }> {
  const d = evt.data as DivinityWebhookEvent["data"];
  const ref = String(d.pledgeId || "");
  const amountCents = typeof d.amount === "number" ? Math.round(d.amount) : undefined;

  if (ref && isSubscriptionReference(ref)) return onSubscriptionChargeEvent(evt.type, ref, d);

  switch (evt.type) {
    case "test.ping":
      return { status: "ignored", note: "ping" };

    case "checkout.completed": {
      if (d.mode === "setup") return onSubscriptionSetupComplete(d);
      if (!ref) return { status: "ignored", note: "no pledgeId" };
      const order = await prisma.order.findUnique({ where: { id: ref } });
      if (!order) return { status: "ignored", note: "unknown order" };
      /* payment.succeeded carries the authoritative amount; if it already
         arrived this is a no-op, otherwise settle now and let it re-confirm. */
      await settleCheckoutPayment(order.id, d.paymentIntentId, amountCents);
      return { status: "processed", note: `order #${order.number} checkout complete` };
    }

    case "payment.succeeded": {
      if (!ref) return { status: "ignored", note: "no pledgeId" };
      const order = await prisma.order.findUnique({ where: { id: ref } });
      if (!order) return { status: "ignored", note: "unknown order" };
      if (amountCents !== undefined && amountCents < order.totalCents) {
        await prisma.order.update({ where: { id: order.id }, data: { notes: [order.notes, `DivinityCoin paid ${amountCents}¢ but the order total is ${order.totalCents}¢ — check before shipping.`].filter(Boolean).join("\n") } });
        return { status: "ignored", note: "amount mismatch" };
      }
      await settleCheckoutPayment(order.id, d.paymentIntentId, amountCents);
      return { status: "processed", note: `order #${order.number} paid` };
    }

    case "payment.failed":
    case "checkout.failed":
    case "checkout.expired":
    case "checkout.canceled": {
      if (!ref) return { status: "ignored" };
      const reason = d.error || d.declineCode || d.code || evt.type;
      await markOrderFailed(ref, `${evt.type}: ${reason}`);
      return { status: "processed", note: String(reason) };
    }

    case "refund.completed": {
      if (!ref && !d.paymentIntentId) return { status: "ignored" };
      const order = ref ? await prisma.order.findUnique({ where: { id: ref } })
        : await prisma.order.findFirst({ where: { paymentRef: String(d.paymentIntentId) } });
      if (!order) return { status: "ignored", note: "unknown order" };
      if (d.partial) {
        await prisma.order.update({ where: { id: order.id }, data: { notes: [order.notes, `Partial refund ${money(amountCents ?? 0)} (${d.refundId ?? "?"})`].filter(Boolean).join("\n") } });
        return { status: "processed", note: "partial refund noted" };
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: "refunded", notes: [order.notes, `Refunded ${money(amountCents ?? order.totalCents)} via DivinityCoin (${d.refundId ?? "?"})`].filter(Boolean).join("\n") } });
      return { status: "processed", note: `order #${order.number} refunded` };
    }

    case "dispute.created": {
      const pi = String(d.stripePaymentIntentId || d.paymentIntentId || "");
      const order = ref ? await prisma.order.findUnique({ where: { id: ref } })
        : pi ? await prisma.order.findFirst({ where: { paymentRef: pi } }) : null;
      if (!order) return { status: "ignored", note: "unknown order" };
      const note = `⚠ Chargeback opened ${new Date().toISOString().slice(0, 10)} — ${d.reason ?? "no reason"} (${d.disputeId ?? "?"}). Evidence due ${d.evidenceDueBy ?? "?"}. Do not ship.`;
      await prisma.order.update({ where: { id: order.id }, data: { status: "disputed", notes: [order.notes, note].filter(Boolean).join("\n") } });
      const s = await getSettings(["SUPPORT_EMAIL", "MAIL_BCC_ADMIN"]);
      const to = s.MAIL_BCC_ADMIN || s.SUPPORT_EMAIL;
      if (to) await sendTemplate("admin_dispute", to, { subject: `Chargeback on order #${order.number}`, fallbackText: `${note}\nOrder: /admin/orders/${order.id}`, orderNumber: String(order.number), reason: String(d.reason ?? ""), amount: money(amountCents ?? order.totalCents) }, { orderId: order.id }).catch(() => {});
      return { status: "processed", note: `order #${order.number} disputed` };
    }

    default:
      return { status: "ignored", note: `unhandled event ${evt.type}` };
  }
}

/* A hosted-checkout charge lands on DivinityCoin as credits held under our
   order id. Capture the hold so it settles to us, then fulfil. Idempotent. */
async function settleCheckoutPayment(orderId: string, paymentIntentId: string | undefined, amountCents: number | undefined) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  if (!["paid", "fulfilled", "shipped", "refunded", "disputed"].includes(order.status)) {
    try {
      const cap = await divinitycoin.captureHold(order.id);
      if (!cap.success) console.warn(`[divinitycoin] capture for order ${order.id} not confirmed:`, cap.error || cap.message);
    } catch (err) {
      /* The card was charged either way; capture can be retried from Admin → Webhooks. */
      console.error(`[divinitycoin] capture failed for order ${order.id}:`, err);
    }
  }
  await fulfillPaidOrder(order.id, { paymentRef: paymentIntentId || order.paymentRef || undefined, paymentMethod: "divinitycoin_checkout" });
  void amountCents;
}

/* Authoritative outcome of a hosted checkout, asked of DivinityCoin (which
   self-heals against the processor). Used by the embedded frame's confirm
   call and by the success page. Settles the order when complete. */
export type CheckoutOutcome = { ok: true; status: "complete" } | { ok: false; status: "pending" | "failed" | "expired" | "canceled" | "unknown"; message: string };
export async function confirmCheckoutSession(orderId: string, sessionId: string): Promise<CheckoutOutcome> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, status: "unknown", message: "Order not found." };
  if (["paid", "fulfilled", "shipped"].includes(order.status)) return { ok: true, status: "complete" };
  if (sessionId.startsWith("cs_test_")) {
    /* test mode: the simulator already posted the webhook */
    return ["paid", "fulfilled", "shipped"].includes(order.status) ? { ok: true, status: "complete" } : { ok: false, status: "pending", message: "Waiting for the simulated webhook." };
  }
  if (!sessionId.startsWith("cs_") || (order.paymentRef && order.paymentRef.startsWith("cs_") && order.paymentRef !== sessionId)) return { ok: false, status: "unknown", message: "That checkout session doesn’t belong to this order." };
  const sess = await divinitycoin.getCheckoutSession(sessionId);
  if (!sess || sess.pledgeId !== order.id) return { ok: false, status: "unknown", message: "DivinityCoin has no checkout for this order." };
  if (sess.status === "pending") return { ok: false, status: "pending", message: "Checkout is still in progress." };
  if (sess.status === "failed") return { ok: false, status: "failed", message: "Your card couldn’t be processed. Please try a different card." };
  if (sess.status === "expired") return { ok: false, status: "expired", message: "The checkout session expired. Please try again." };
  if (sess.status === "canceled") return { ok: false, status: "canceled", message: "Checkout was cancelled. Nothing was charged." };
  if (sess.amount !== null && sess.amount < order.totalCents) return { ok: false, status: "unknown", message: "The amount paid doesn’t match the order. Contact us." };
  await settleCheckoutPayment(order.id, sess.paymentIntentId ?? undefined, sess.amount ?? undefined);
  return { ok: true, status: "complete" };
}
