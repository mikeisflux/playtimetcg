import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { divinitycoin } from "@/lib/divinitycoin";
import { guard, bad, notFound, readJson } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.subscription.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, name: true } }, invoices: { orderBy: { createdAt: "desc" } } } });
  return row ? NextResponse.json({ row }) : notFound();
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return notFound();
  const b = await readJson<{ action?: string; months?: number }>(req);
  const before = { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd };
  switch (b.action) {
    case "cancel": {
      if (sub.providerRef) {
        const r = await divinitycoin.cancelSubscription(sub.providerRef);
        if (!r.success) return bad(`DivinityCoin cancel failed: ${r.error || "unknown"}`, 502);
      }
      await prisma.subscription.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date(), cancelAtPeriodEnd: false } });
      break;
    }
    case "past_due": await prisma.subscription.update({ where: { id }, data: { status: "past_due" } }); break;
    case "activate": await prisma.subscription.update({ where: { id }, data: { status: "active", cancelledAt: null } }); break;
    case "expire": await prisma.subscription.update({ where: { id }, data: { status: "expired" } }); break;
    case "extend": {
      const months = Math.max(1, Math.min(24, Number(b.months) || 1));
      const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? new Date(sub.currentPeriodEnd) : new Date();
      base.setMonth(base.getMonth() + months);
      await prisma.subscription.update({ where: { id }, data: { currentPeriodEnd: base, status: sub.status === "expired" ? "active" : sub.status } });
      break;
    }
    default: return bad("Unknown action");
  }
  const after = await prisma.subscription.findUnique({ where: { id }, select: { status: true, currentPeriodEnd: true } });
  await audit(g.id, `subscription.${b.action}`, "subscription", id, before, after);
  return NextResponse.json({ ok: true });
}
