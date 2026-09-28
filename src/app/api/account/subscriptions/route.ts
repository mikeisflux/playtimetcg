import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendTemplate } from "@/lib/sendgrid";
import { cancelSubscription, resumeSubscriptionSetup } from "@/lib/subscriptions";

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
      /* stays active until the period ends; the renewal run then closes it */
      await cancelSubscription(sub.id, sub.status === "pending");
      await sendTemplate("subscription_cancelled", user.email, { subject: "Your Play Time subscription was cancelled", fallbackText: "Your subscription will end at the close of the current period. Your cards stay in your collection.", name: user.name }, { userId: user.id });
      return NextResponse.json({ ok: true });
    }
    if (action === "keep") {
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd < new Date()) return NextResponse.json({ error: "This subscription has already ended — start a new one from the shop." }, { status: 400 });
      await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, cancelledAt: null } });
      return NextResponse.json({ ok: true });
    }
    if (action === "resume" && sub.status === "pending") {
      try { return NextResponse.json({ ok: true, url: await resumeSubscriptionSetup(sub.id, user.id) }); }
      catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start checkout." }, { status: 502 }); }
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
