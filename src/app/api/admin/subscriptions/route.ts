import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { guard, pageParams, paged, toCsv, csvResponse } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") || "";
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const where: Prisma.SubscriptionWhereInput = {
    ...(plan ? { plan } : {}), ...(status ? { status } : {}),
    ...(q ? { OR: [{ user: { email: { contains: q, mode: "insensitive" } } }, { user: { name: { contains: q, mode: "insensitive" } } }, { providerRef: q }, { id: q }] } : {}),
  };
  const view = url.searchParams.get("view");
  if (view === "fulfillment") {
    const rows = await prisma.subscription.findMany({ where: { plan: "monthly_cards", status: "active" }, include: { user: { select: { name: true, email: true, addresses: { where: { isDefault: true }, take: 1 } } } }, orderBy: { startedAt: "asc" } });
    const list = rows.map((s) => {
      const sh = (s.shipping as Record<string, string> | null) ?? (s.user.addresses[0] as unknown as Record<string, string> | undefined) ?? null;
      return { id: s.id, email: s.user.email, name: sh?.name || s.user.name, line1: sh?.line1 || "", line2: sh?.line2 || "", city: sh?.city || "", region: sh?.region || "", postal: sh?.postal || "", country: sh?.country || "US", phone: sh?.phone || "", currentPeriodEnd: s.currentPeriodEnd, startedAt: s.startedAt, hasAddress: !!sh?.line1 };
    });
    if (url.searchParams.get("format") === "csv") {
      return csvResponse(`monthly-cards-${new Date().toISOString().slice(0, 7)}.csv`, toCsv(["name", "email", "line1", "line2", "city", "region", "postal", "country", "phone", "periodEnd"],
        list.map((r) => [r.name, r.email, r.line1, r.line2, r.city, r.region, r.postal, r.country, r.phone, r.currentPeriodEnd])));
    }
    return NextResponse.json({ rows: list });
  }
  const { page, size, skip, take } = pageParams(url);
  const [total, rows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({ where, skip, take, orderBy: { startedAt: "desc" }, include: { user: { select: { id: true, email: true, name: true } }, _count: { select: { invoices: true } } } }),
  ]);
  return NextResponse.json(paged(rows, total, page, size));
}
