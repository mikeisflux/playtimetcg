/* Subscriptions on top of DivinityCoin, which has no subscription object:
   a `setup`-mode hosted checkout saves the shopper's card, then we charge
   the first period and every renewal ourselves with
   charge-saved-payment-method. Renewals run from runRenewals() (called by
   the in-process scheduler in src/instrumentation.ts). */
import { prisma } from "./db";
import { getSettings } from "./settings";
import { divinitycoin, type DivinityWebhookEvent } from "./divinitycoin";
import { sendTemplate } from "./sendgrid";
import { grantStarterDeck } from "./packs";
import { money } from "./content";
import type { ShippingInput } from "./orders";

export const SUB_REF_PREFIX = "sub:";
export function isSubscriptionReference(ref: string): boolean { return ref.startsWith(SUB_REF_PREFIX); }
/* One reference per billing period: "sub:<subscriptionId>:<periodStart YYYY-MM-DD>". */
function periodReference(subId: string, periodStart: Date): string { return `${SUB_REF_PREFIX}${subId}:${periodStart.toISOString().slice(0, 10)}`; }
function parseReference(ref: string): { subId: string; period: string } | null {
  const m = /^sub:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(ref);
  return m ? { subId: m[1], period: m[2] } : null;
}
function planLabel(plan: string) { return plan === "online_play" ? "Online play" : "Monthly cards"; }
function addInterval(from: Date, interval: string): Date {
  const d = new Date(from);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
  return d;
}

/* Step 1: create the pending subscription and send the shopper to a
   setup-mode checkout to save a card. */
export async function startSubscription(userId: string, productId: string, shipping?: ShippingInput | null, opts: { embed?: boolean } = {}): Promise<{ url: string; subscriptionId: string; sessionId: string | null }> {
  const [user, product] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);
  if (!user || !product || product.kind !== "subscription" || !product.subPlan) throw new Error("Subscription not found.");
  if (product.subPlan === "monthly_cards" && !shipping) throw new Error("A shipping address is required for the monthly cards.");
  const existing = await prisma.subscription.findFirst({ where: { userId, plan: product.subPlan, status: { in: ["active", "past_due"] } } });
  if (existing) throw new Error("You already have this subscription.");
  const sub = await prisma.subscription.create({
    data: { userId, plan: product.subPlan, status: "pending", priceCents: product.priceCents, interval: product.subInterval || "month", shipping: shipping ? JSON.parse(JSON.stringify(shipping)) : undefined },
  });
  try {
    const r = await setupCheckoutUrl(sub.id, user.email, user.id, product.name, opts.embed);
    return { url: r.url, sessionId: r.sessionId, subscriptionId: sub.id };
  } catch (err) {
    await prisma.subscription.delete({ where: { id: sub.id } }).catch(() => {});
    throw err;
  }
}

/* Re-open the card setup for a still-pending subscription. */
export async function resumeSubscriptionSetup(subId: string, userId: string, embed = false): Promise<{ url: string; sessionId: string | null }> {
  const sub = await prisma.subscription.findFirst({ where: { id: subId, userId }, include: { user: true } });
  if (!sub || sub.status !== "pending") throw new Error("This subscription can’t be resumed.");
  const product = await prisma.product.findFirst({ where: { kind: "subscription", subPlan: sub.plan, active: true } });
  return setupCheckoutUrl(sub.id, sub.user.email, sub.userId, product?.name ?? planLabel(sub.plan), embed);
}

async function setupCheckoutUrl(subId: string, email: string, userId: string, productName: string, embed = false): Promise<{ url: string; sessionId: string | null }> {
  const s = await getSettings(["SITE_URL", "SITE_NAME"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  const res = await divinitycoin.createSetupCheckout({
    reference: subId, email, customerId: userId,
    description: `${s.SITE_NAME || "Play Time"} — ${productName} (${money((await prisma.subscription.findUnique({ where: { id: subId } }))?.priceCents ?? 0)} per period, cancel anytime)`,
    returnUrl: `${base}/account/subscriptions?started=${subId}`,
    cancelUrl: `${base}/account/subscriptions?cancelled=${subId}`,
    embed,
  });
  if (!res.success || !res.checkoutUrl) throw new Error(res.error || "Could not start DivinityCoin checkout.");
  await prisma.subscription.update({ where: { id: subId }, data: { providerRef: res.sessionId ? `cs:${res.sessionId}` : null } });
  return { url: res.checkoutUrl, sessionId: res.sessionId ?? null };
}

/* Embedded-frame confirm (and account-page self-heal): ask DivinityCoin how
   the setup session ended; on complete, keep the card and charge the first
   period. Idempotent with the checkout.completed webhook. */
export type SetupOutcome = { ok: true; status: "complete" } | { ok: false; status: "pending" | "failed" | "expired" | "canceled" | "unknown"; message: string };
export async function confirmSubscriptionSetup(subId: string, userId: string, sessionId: string): Promise<SetupOutcome> {
  const sub = await prisma.subscription.findFirst({ where: { id: subId, userId } });
  if (!sub) return { ok: false, status: "unknown", message: "Subscription not found." };
  if (sub.status === "active") return { ok: true, status: "complete" };
  if (sessionId.startsWith("cs_test_")) return sub.status === "active" ? { ok: true, status: "complete" } : { ok: false, status: "pending", message: "Waiting for the simulated webhook." };
  if (sub.providerRef !== `cs:${sessionId}` && !sub.providerRef?.startsWith("pm:")) return { ok: false, status: "unknown", message: "That checkout session doesn’t belong to this subscription." };
  const sess = await divinitycoin.getCheckoutSession(sessionId);
  if (!sess) return { ok: false, status: "unknown", message: "DivinityCoin has no checkout session for this subscription." };
  if (sess.status === "pending") return { ok: false, status: "pending", message: "Card setup is still in progress." };
  if (sess.status !== "complete") return { ok: false, status: sess.status, message: sess.status === "failed" ? "Your card couldn’t be saved. Please try a different card." : sess.status === "expired" ? "The session expired. Please try again." : "Setup was cancelled. Nothing was charged." };
  if (!sess.paymentMethodId) return { ok: false, status: "unknown", message: "DivinityCoin didn’t return a saved card. Please try again." };
  const r = await onSubscriptionSetupComplete({ sessionId, mode: "setup", paymentMethodId: sess.paymentMethodId });
  const fresh = await prisma.subscription.findUnique({ where: { id: subId } });
  if (fresh?.status === "active") return { ok: true, status: "complete" };
  return { ok: false, status: "failed", message: r.note?.startsWith("first charge failed") ? `Your card was saved but the first charge was declined (${r.note.replace("first charge failed: ", "")}).` : "The first charge didn’t go through. Try another card from your account page." };
}

/* Step 2 (webhook checkout.completed, mode=setup): remember the card and
   charge the first period. Also reachable from the success page self-heal. */
export async function onSubscriptionSetupComplete(d: DivinityWebhookEvent["data"]): Promise<{ status: "processed" | "ignored"; note?: string }> {
  const sessionId = String(d.sessionId || "");
  const sub = sessionId ? await prisma.subscription.findFirst({ where: { providerRef: `cs:${sessionId}` } }) : null;
  if (!sub) {
    /* already converted to pm:… by the embedded-frame confirm → idempotent */
    return { status: "ignored", note: "no pending subscription for setup session (already confirmed?)" };
  }
  if (!d.paymentMethodId) return { status: "ignored", note: "setup completed without a payment method" };
  await prisma.subscription.update({ where: { id: sub.id }, data: { providerRef: `pm:${d.paymentMethodId}` } });
  const r = await chargePeriod(sub.id, new Date());
  return r.ok ? { status: "processed", note: "subscription started" } : { status: "processed", note: `first charge failed: ${r.error}` };
}

/* Charge one billing period with the saved card, then activate/renew.
   Idempotent per (subscription, period start date). */
export async function chargePeriod(subId: string, periodStart: Date): Promise<{ ok: boolean; error?: string; declined?: boolean }> {
  const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { user: true } });
  if (!sub) return { ok: false, error: "subscription not found" };
  const pm = sub.providerRef?.startsWith("pm:") ? sub.providerRef.slice(3) : null;
  const ref = periodReference(sub.id, periodStart);
  if (!pm) {
    /* No card on file (setup never completed, or a legacy row): record the
       failure so the renewal pass retries daily and ends it after a week. */
    await recordFailedPeriod(sub.id, sub.priceCents, periodStart, "no saved card on file");
    return { ok: false, error: "no saved card" };
  }
  const already = await prisma.subscriptionInvoice.findFirst({ where: { subscriptionId: sub.id, status: "paid", paymentRef: { startsWith: `${ref}|` } } });
  if (already) return { ok: true };
  const s = await getSettings(["SITE_NAME"]);
  const charge = await divinitycoin.chargeSavedCard({
    customerId: sub.userId, paymentMethodId: pm, amountCents: sub.priceCents, reference: ref,
    description: `${s.SITE_NAME || "Play Time"} — ${planLabel(sub.plan)}`, idempotencyKey: ref,
  });
  if (!charge.success) {
    await recordFailedPeriod(sub.id, sub.priceCents, periodStart, charge.error || charge.status || "charge failed");
    return { ok: false, error: charge.error, declined: charge.httpStatus === 402 };
  }
  /* The charge is auto-held as credits under `ref`; capture so it settles. */
  try { await divinitycoin.captureHold(ref); } catch (err) { console.error(`[divinitycoin] capture failed for ${ref}:`, err); }
  await activateSubscription(sub.id, { periodStart, amountCents: sub.priceCents, paymentRef: `${ref}|${charge.paymentIntentId ?? ""}` });
  return { ok: true };
}

async function recordFailedPeriod(subId: string, amountCents: number, periodStart: Date, reason: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { user: true } });
  if (!sub) return;
  const wasActive = sub.status === "active" || sub.status === "past_due";
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: wasActive ? "past_due" : "pending" } });
  await prisma.subscriptionInvoice.create({ data: { subscriptionId: sub.id, amountCents, status: "failed", periodStart, periodEnd: addInterval(periodStart, sub.interval), paymentRef: reason.slice(0, 190) } });
  await sendTemplate("subscription_payment_failed", sub.user.email, {
    subject: wasActive ? "We couldn’t renew your Play Time subscription" : "Your Play Time subscription didn’t start",
    fallbackText: `The card on file was declined (${reason}). Update your card from your account to keep playing.`, name: sub.user.name, reason,
  }, { userId: sub.userId }).catch(() => {});
}

export async function activateSubscription(subId: string, data: { periodEnd?: Date; amountCents?: number; paymentRef?: string; periodStart?: Date }) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { user: true } });
  if (!sub) return;
  const periodStart = data.periodStart ?? new Date();
  const periodEnd = data.periodEnd ?? addInterval(periodStart, sub.interval);
  const wasActive = sub.status === "active" || sub.status === "past_due";
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false } });
  await prisma.subscriptionInvoice.create({ data: { subscriptionId: sub.id, amountCents: data.amountCents ?? sub.priceCents, status: "paid", periodStart, periodEnd, paymentRef: data.paymentRef ?? null } });
  if (sub.plan === "online_play") await grantStarterDeck(sub.userId);
  await sendTemplate(wasActive ? "subscription_renewed" : "subscription_started", sub.user.email, {
    subject: wasActive ? "Your Play Time subscription renewed" : "Welcome to Play Time",
    fallbackText: wasActive ? "Your subscription renewed. Thanks for playing." : "Your subscription is active.",
    name: sub.user.name, plan: planLabel(sub.plan), amount: money(data.amountCents ?? sub.priceCents),
    periodEnd: periodEnd.toLocaleDateString("en-US", { dateStyle: "long" }),
  }, { userId: sub.userId }).catch(() => {});
}

/* payment.succeeded / payment.failed for a "sub:…" reference. The
   synchronous charge call normally handles it; this covers a timed-out call. */
export async function onSubscriptionChargeEvent(type: string, ref: string, d: DivinityWebhookEvent["data"]): Promise<{ status: "processed" | "ignored"; note?: string }> {
  const parsed = parseReference(ref);
  if (!parsed) return { status: "ignored", note: "bad subscription reference" };
  const sub = await prisma.subscription.findUnique({ where: { id: parsed.subId } });
  if (!sub) return { status: "ignored", note: "unknown subscription" };
  if (type === "payment.succeeded") {
    const paid = await prisma.subscriptionInvoice.findFirst({ where: { subscriptionId: sub.id, status: "paid", paymentRef: { startsWith: `${ref}|` } } });
    if (paid) return { status: "ignored", note: "period already recorded" };
    try { await divinitycoin.captureHold(ref); } catch { /* retry from Admin → Webhooks */ }
    await activateSubscription(sub.id, { periodStart: new Date(parsed.period), amountCents: typeof d.amount === "number" ? Math.round(d.amount) : undefined, paymentRef: `${ref}|${d.paymentIntentId ?? ""}` });
    return { status: "processed", note: "subscription period paid (webhook)" };
  }
  if (type === "payment.failed") {
    const failed = await prisma.subscriptionInvoice.findFirst({ where: { subscriptionId: sub.id, status: "failed", periodStart: new Date(parsed.period) } });
    if (!failed) await recordFailedPeriod(sub.id, sub.priceCents, new Date(parsed.period), String(d.error || d.declineCode || d.code || "declined"));
    return { status: "processed" };
  }
  return { status: "ignored", note: `unhandled ${type} for subscription` };
}

/* Cancel: no DivinityCoin call needed; we simply stop charging. */
export async function cancelSubscription(subId: string, immediate: boolean) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } });
  if (!sub) return;
  const ended = immediate || !sub.currentPeriodEnd || sub.currentPeriodEnd < new Date();
  await prisma.subscription.update({ where: { id: sub.id }, data: ended ? { status: "cancelled", cancelledAt: new Date(), cancelAtPeriodEnd: false } : { cancelAtPeriodEnd: true, cancelledAt: new Date() } });
}

/* ───────── Renewals ─────────
   Charges every active/past_due subscription whose period has ended, retries
   declines daily for 7 days, then cancels. Serialised across PM2 workers with
   a Postgres advisory lock. Returns a summary for the caller/log. */
export async function runRenewals(): Promise<{ charged: number; failed: number; ended: number; skipped: boolean }> {
  const lock = await prisma.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_lock(7231984) AS ok`;
  if (!lock[0]?.ok) return { charged: 0, failed: 0, ended: 0, skipped: true };
  const out = { charged: 0, failed: 0, ended: 0, skipped: false };
  try {
    const now = new Date();
    const due = await prisma.subscription.findMany({ where: { status: { in: ["active", "past_due"] }, currentPeriodEnd: { lte: now } }, orderBy: { currentPeriodEnd: "asc" }, take: 200 });
    for (const sub of due) {
      if (sub.cancelAtPeriodEnd) { await cancelSubscription(sub.id, true); out.ended++; continue; }
      const periodStart = sub.currentPeriodEnd ?? now;
      /* Retry a failed period at most once per day, up to 7 days past the period end. */
      const lastFail = await prisma.subscriptionInvoice.findFirst({ where: { subscriptionId: sub.id, status: "failed", periodStart }, orderBy: { createdAt: "desc" } });
      if (lastFail && now.getTime() - lastFail.createdAt.getTime() < 86400_000) continue;
      if (now.getTime() - periodStart.getTime() > 7 * 86400_000) {
        await cancelSubscription(sub.id, true); out.ended++;
        const u = await prisma.user.findUnique({ where: { id: sub.userId } });
        if (u) await sendTemplate("subscription_cancelled", u.email, { subject: "Your Play Time subscription ended", fallbackText: "We couldn’t collect payment for a week, so the subscription has ended. Your cards stay in your collection; subscribe again any time.", name: u.name }, { userId: u.id }).catch(() => {});
        continue;
      }
      const r = await chargePeriod(sub.id, periodStart);
      if (r.ok) out.charged++; else out.failed++;
    }
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(7231984)`;
  }
  return out;
}
