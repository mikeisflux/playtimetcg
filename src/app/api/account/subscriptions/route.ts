import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { divinitycoin } from "@/lib/divinitycoin";
import { getSettings } from "@/lib/settings";
import { sendTemplate } from "@/lib/sendgrid";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const subs = await prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" } });
  return NextResponse.json(subs);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id, action } = await req.json();
    const sub = await prisma.subscription.findFirst({ where: { id: String(id), userId: user.id } });
    if (!sub) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    if (action === "cancel") {
      if (sub.providerRef) {
        const r = await divinitycoin.cancelSubscription(sub.providerRef);
        if (!r.success) return NextResponse.json({ error: r.error || "DivinityCoin could not cancel the subscription. Try again or contact us." }, { status: 502 });
      }
      /* stays active until the period ends; the webhook or the period end flips it */
      await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true, cancelledAt: new Date(), ...(sub.currentPeriodEnd && sub.currentPeriodEnd < new Date() ? { status: "cancelled" } : {}) } });
      await sendTemplate("subscription_cancelled", user.email, { subject: "Your Play Time subscription was cancelled", fallbackText: "Your subscription will end at the close of the current period. Your cards stay in your collection.", name: user.name }, { userId: user.id });
      return NextResponse.json({ ok: true });
    }
    if (action === "keep") {
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd < new Date()) return NextResponse.json({ error: "This subscription has already ended — start a new one from the shop." }, { status: 400 });
      await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, cancelledAt: null } });
      return NextResponse.json({ ok: true });
    }
    if (action === "resume" && sub.status === "pending") {
      const product = await prisma.product.findFirst({ where: { kind: "subscription", subPlan: sub.plan, active: true } });
      const s = await getSettings(["SITE_URL", "SITE_NAME"]);
      const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
      const r = await divinitycoin.createSubscriptionCheckout({
        subscriptionId: sub.id, plan: sub.plan, amount: sub.priceCents / 100, interval: (sub.interval as "month" | "year") || "month",
        email: user.email, customerId: user.id, description: `${s.SITE_NAME || "Play Time"} — ${product?.name ?? sub.plan}`,
        successUrl: `${base}/account/subscriptions?started=${sub.id}`, cancelUrl: `${base}/account/subscriptions?cancelled=${sub.id}`,
      });
      if (!r.success || !r.checkoutUrl) return NextResponse.json({ error: r.error || "Could not start checkout." }, { status: 502 });
      return NextResponse.json({ ok: true, url: r.checkoutUrl });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
