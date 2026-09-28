/* Orders: create from a cart, price it, pay it through DivinityCoin, fulfil
   digital items, and process DivinityCoin webhook events. */
import { prisma } from "./db";
import { getSettings, flag } from "./settings";
import { divinitycoin, type DivinityWebhookEvent } from "./divinitycoin";
import { sendTemplate } from "./sendgrid";
import { grantPacks, grantStarterDeck } from "./packs";
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

/* Start a DivinityCoin hosted checkout for an order. */
export async function startCheckout(orderId: string): Promise<{ url: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error("Order not found.");
  if (order.status === "paid" || order.status === "fulfilled") throw new Error("This order is already paid.");
  const s = await getSettings(["SITE_URL", "SITE_NAME"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  const res = await divinitycoin.createCheckout({
    orderId: order.id,
    amount: order.totalCents / 100,
    currency: order.currency,
    email: order.email,
    customerId: order.userId ?? undefined,
    description: `${s.SITE_NAME || "Play Time"} order #${order.number}`,
    lineItems: order.items.map((i) => ({ name: i.name, quantity: i.qty, unitAmount: i.unitCents / 100 })),
    successUrl: `${base}/checkout/success?order=${order.id}`,
    cancelUrl: `${base}/checkout/cancel?order=${order.id}`,
    metadata: { orderNumber: String(order.number) },
  });
  if (!res.success || !res.checkoutUrl) throw new Error(res.error || "Could not start DivinityCoin checkout.");
  await prisma.order.update({ where: { id: order.id }, data: { status: "awaiting_payment", paymentMethod: "divinitycoin_checkout", paymentRef: res.sessionId ?? null } });
  return { url: res.checkoutUrl };
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

export async function startSubscription(userId: string, productId: string, shipping?: ShippingInput | null): Promise<{ url: string; subscriptionId: string }> {
  const [user, product] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);
  if (!user || !product || product.kind !== "subscription" || !product.subPlan) throw new Error("Subscription not found.");
  if (product.subPlan === "monthly_cards" && !shipping) throw new Error("A shipping address is required for the monthly cards.");
  const existing = await prisma.subscription.findFirst({ where: { userId, plan: product.subPlan, status: { in: ["active", "past_due"] } } });
  if (existing) throw new Error("You already have this subscription.");
  const sub = await prisma.subscription.create({
    data: {
      userId, plan: product.subPlan, status: "pending", priceCents: product.priceCents,
      interval: product.subInterval || "month",
      shipping: shipping ? JSON.parse(JSON.stringify(shipping)) : undefined,
    },
  });
  const s = await getSettings(["SITE_URL", "SITE_NAME"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  const res = await divinitycoin.createSubscriptionCheckout({
    subscriptionId: sub.id, plan: product.subPlan, amount: product.priceCents / 100,
    interval: (product.subInterval as "month" | "year") || "month", email: user.email, customerId: user.id,
    description: `${s.SITE_NAME || "Play Time"} — ${product.name}`,
    successUrl: `${base}/account/subscriptions?started=${sub.id}`,
    cancelUrl: `${base}/account/subscriptions?cancelled=${sub.id}`,
  });
  if (!res.success || !res.checkoutUrl) {
    await prisma.subscription.delete({ where: { id: sub.id } });
    throw new Error(res.error || "Could not start DivinityCoin checkout.");
  }
  return { url: res.checkoutUrl, subscriptionId: sub.id };
}

export async function activateSubscription(subId: string, data: { providerRef?: string; periodEnd?: Date; amountCents?: number; paymentRef?: string; periodStart?: Date }) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { user: true } });
  if (!sub) return;
  const periodEnd = data.periodEnd ?? new Date(Date.now() + (sub.interval === "year" ? 365 : 31) * 86400_000);
  const wasActive = sub.status === "active";
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "active", providerRef: data.providerRef ?? sub.providerRef, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false },
  });
  await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId: sub.id, amountCents: data.amountCents ?? sub.priceCents, status: "paid",
      periodStart: data.periodStart ?? new Date(), periodEnd, paymentRef: data.paymentRef ?? null,
    },
  });
  if (sub.plan === "online_play") await grantStarterDeck(sub.userId);
  await sendTemplate(wasActive ? "subscription_renewed" : "subscription_started", sub.user.email, {
    subject: wasActive ? "Your Play Time subscription renewed" : "Welcome to Play Time",
    fallbackText: wasActive ? "Your subscription renewed. Thanks for playing." : "Your subscription is active.",
    name: sub.user.name, plan: sub.plan === "online_play" ? "Online play" : "Monthly cards",
    amount: money(data.amountCents ?? sub.priceCents), periodEnd: periodEnd.toLocaleDateString("en-US", { dateStyle: "long" }),
  }, { userId: sub.userId });
}

/* ───────── Webhook processing (DivinityCoin → us) ───────── */

export async function processDivinityEvent(evt: { id: string; type: string; data: Record<string, unknown> }): Promise<{ status: "processed" | "ignored"; note?: string }> {
  const d = evt.data as DivinityWebhookEvent["data"];
  const ref = String(d.reference || d.orderId || d.metadata?.orderId || "");
  const amountCents = typeof d.amount === "number" ? Math.round(d.amount * 100) : undefined;

  switch (evt.type) {
    case "ping": return { status: "ignored", note: "ping" };

    case "payment.completed": {
      if (!ref) return { status: "ignored", note: "no reference" };
      const order = await prisma.order.findUnique({ where: { id: ref } });
      if (order) {
        if (amountCents !== undefined && amountCents < order.totalCents) {
          await prisma.order.update({ where: { id: order.id }, data: { notes: `Webhook amount ${amountCents} < total ${order.totalCents}` } });
          return { status: "ignored", note: "amount mismatch" };
        }
        await fulfillPaidOrder(order.id, { paymentRef: d.paymentId || d.sessionId, paymentMethod: "divinitycoin_checkout" });
        return { status: "processed", note: `order #${order.number} paid` };
      }
      const sub = await prisma.subscription.findUnique({ where: { id: ref } });
      if (sub) {
        await activateSubscription(sub.id, { providerRef: d.subscriptionId, amountCents, paymentRef: d.paymentId, periodEnd: d.currentPeriodEnd ? new Date(d.currentPeriodEnd) : undefined });
        return { status: "processed", note: "subscription activated" };
      }
      return { status: "ignored", note: "unknown reference" };
    }

    case "payment.failed":
    case "payment.cancelled":
    case "checkout.expired": {
      if (!ref) return { status: "ignored" };
      await markOrderFailed(ref, `${evt.type}${d.reason ? `: ${d.reason}` : ""}`);
      await prisma.subscription.updateMany({ where: { id: ref, status: "pending" }, data: { status: "expired" } });
      return { status: "processed" };
    }

    case "payment.refunded": {
      if (!ref) return { status: "ignored" };
      const order = await prisma.order.findUnique({ where: { id: ref } });
      if (!order) return { status: "ignored", note: "unknown order" };
      await prisma.order.update({ where: { id: order.id }, data: { status: "refunded", notes: d.reason ? `Refunded: ${d.reason}` : order.notes } });
      return { status: "processed", note: `order #${order.number} refunded` };
    }

    case "subscription.activated":
    case "subscription.renewed": {
      const sub = ref ? await prisma.subscription.findUnique({ where: { id: ref } })
        : d.subscriptionId ? await prisma.subscription.findUnique({ where: { providerRef: d.subscriptionId } }) : null;
      if (!sub) return { status: "ignored", note: "unknown subscription" };
      await activateSubscription(sub.id, {
        providerRef: d.subscriptionId, amountCents, paymentRef: d.paymentId,
        periodStart: d.periodStart ? new Date(d.periodStart) : undefined,
        periodEnd: d.periodEnd ? new Date(d.periodEnd) : d.currentPeriodEnd ? new Date(d.currentPeriodEnd) : undefined,
      });
      return { status: "processed" };
    }

    case "subscription.payment_failed": {
      const sub = ref ? await prisma.subscription.findUnique({ where: { id: ref }, include: { user: true } })
        : d.subscriptionId ? await prisma.subscription.findUnique({ where: { providerRef: d.subscriptionId }, include: { user: true } }) : null;
      if (!sub) return { status: "ignored" };
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
      await prisma.subscriptionInvoice.create({ data: { subscriptionId: sub.id, amountCents: amountCents ?? sub.priceCents, status: "failed", periodStart: new Date(), periodEnd: sub.currentPeriodEnd ?? new Date(), paymentRef: d.paymentId ?? null } });
      await sendTemplate("subscription_payment_failed", sub.user.email, { subject: "We couldn’t renew your Play Time subscription", fallbackText: "Your renewal payment failed. Update your payment on DivinityCoin to keep playing.", name: sub.user.name }, { userId: sub.userId });
      return { status: "processed" };
    }

    case "subscription.cancelled": {
      const sub = ref ? await prisma.subscription.findUnique({ where: { id: ref }, include: { user: true } })
        : d.subscriptionId ? await prisma.subscription.findUnique({ where: { providerRef: d.subscriptionId }, include: { user: true } }) : null;
      if (!sub) return { status: "ignored" };
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", cancelledAt: new Date() } });
      await sendTemplate("subscription_cancelled", sub.user.email, { subject: "Your Play Time subscription was cancelled", fallbackText: "Your subscription is cancelled. Your cards stay in your collection.", name: sub.user.name }, { userId: sub.userId });
      return { status: "processed" };
    }

    default:
      return { status: "ignored", note: `unhandled type ${evt.type}` };
  }
}
