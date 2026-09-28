import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { divinitycoin } from "@/lib/divinitycoin";
import { guard } from "../_lib";

export const dynamic = "force-dynamic";
const PAID = ["paid", "fulfilled", "shipped"];

export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const d7 = new Date(now.getTime() - 7 * 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const rev = async (since?: Date) => (await prisma.order.aggregate({ _sum: { totalCents: true }, _count: true, where: { status: { in: PAID }, ...(since ? { paidAt: { gte: since } } : {}) } }));

  const [today, week, month, lifetime, openOrders, subsByPlan, users, unread, failedEmails, webhookFailures, recentOrders, recentInbox, s, dc] = await Promise.all([
    rev(dayStart), rev(d7), rev(d30), rev(),
    prisma.order.count({ where: { status: { in: ["paid", "awaiting_payment", "pending"] } } }),
    prisma.subscription.groupBy({ by: ["plan"], where: { status: "active" }, _count: true }),
    prisma.user.count(),
    prisma.message.count({ where: { direction: "in", read: false, archived: false } }),
    prisma.message.count({ where: { direction: "out", status: { in: ["failed", "bounced"] } } }),
    prisma.webhookEvent.count({ where: { status: "failed" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, email: true, status: true, totalCents: true, currency: true, createdAt: true } }),
    prisma.message.findMany({ where: { direction: "in", archived: false }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, fromEmail: true, fromName: true, subject: true, read: true, createdAt: true, channel: true } }),
    getSettings(["SENDGRID_API_KEY", "DIVINITYCOIN_API_KEY", "DIVINITYCOIN_WEBHOOK_SECRET", "SITE_URL", "MAIL_FROM", "INBOUND_EMAIL_KEY", "SENDGRID_EVENT_KEY", "DIVINITYCOIN_TEST_MODE"]),
    divinitycoin.healthCheck(),
  ]);

  return NextResponse.json({
    revenue: {
      today: today._sum.totalCents ?? 0, week: week._sum.totalCents ?? 0, month: month._sum.totalCents ?? 0, lifetime: lifetime._sum.totalCents ?? 0,
      ordersToday: today._count, ordersLifetime: lifetime._count,
    },
    openOrders, users, unread, failedEmails, webhookFailures,
    subs: Object.fromEntries(subsByPlan.map((r) => [r.plan, r._count])),
    divinity: dc,
    checks: [
      { label: "SendGrid API key", ok: !!s.SENDGRID_API_KEY, hint: "Settings → SendGrid" },
      { label: "Outgoing from address", ok: !!s.MAIL_FROM, hint: "MAIL_FROM" },
      { label: "DivinityCoin API key", ok: !!s.DIVINITYCOIN_API_KEY, hint: "Settings → DivinityCoin" },
      { label: "DivinityCoin webhook secret", ok: !!s.DIVINITYCOIN_WEBHOOK_SECRET, hint: "DIVINITYCOIN_WEBHOOK_SECRET" },
      { label: "Public site URL", ok: !!s.SITE_URL, hint: "SITE_URL" },
      { label: "Inbound Parse key", ok: !!s.INBOUND_EMAIL_KEY, hint: "INBOUND_EMAIL_KEY" },
      { label: "SendGrid event key", ok: !!s.SENDGRID_EVENT_KEY, hint: "SENDGRID_EVENT_KEY" },
      { label: "DivinityCoin test mode OFF", ok: !/^(1|true|yes|on)$/i.test(s.DIVINITYCOIN_TEST_MODE || ""), hint: "DIVINITYCOIN_TEST_MODE" },
    ],
    recentOrders, recentInbox,
  });
}
