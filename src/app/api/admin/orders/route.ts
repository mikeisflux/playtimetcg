import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { guard, pageParams, paged, toCsv, csvResponse } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : []),
        { id: q }, { paymentRef: q }, { trackingNumber: q },
      ],
    } : {}),
  };
  if (url.searchParams.get("format") === "csv") {
    const rows = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true }, take: 5000 });
    const csv = toCsv(
      ["number", "date", "status", "email", "subtotal", "shipping", "tax", "discount", "total", "currency", "paymentMethod", "paymentRef", "items", "shipTo", "tracking", "carrier", "paidAt", "fulfilledAt"],
      rows.map((o) => {
        const sh = (o.shipping ?? {}) as Record<string, string>;
        const shipTo = o.shipping ? [sh.name, sh.line1, sh.line2, sh.city, sh.region, sh.postal, sh.country].filter(Boolean).join(", ") : "";
        return [o.number, o.createdAt, o.status, o.email, o.subtotalCents / 100, o.shippingCents / 100, o.taxCents / 100, o.discountCents / 100, o.totalCents / 100, o.currency, o.paymentMethod, o.paymentRef,
          o.items.map((i) => `${i.qty}× ${i.name}`).join("; "), shipTo, o.trackingNumber, o.trackingCarrier, o.paidAt, o.fulfilledAt];
      }),
    );
    return csvResponse(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }
  const { page, size, skip, take } = pageParams(url);
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { items: { select: { name: true, qty: true } }, user: { select: { id: true, name: true } } } }),
  ]);
  return NextResponse.json(paged(rows, total, page, size));
}
