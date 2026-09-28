import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { sendTemplate } from "@/lib/sendgrid";
import { divinitycoin } from "@/lib/divinitycoin";
import { fulfillPaidOrder } from "@/lib/orders";
import { guard, bad, notFound, readJson, str } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { slug: true, kind: true, digital: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const order = await load(id);
  if (!order) return notFound();
  const [emails, audits] = await Promise.all([
    prisma.message.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" }, select: { id: true, subject: true, status: true, toEmail: true, createdAt: true, templateSlug: true } }),
    prisma.adminAuditLog.findMany({ where: { resource: "order", resourceId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { admin: { select: { name: true } } } }),
  ]);
  return NextResponse.json({ order, emails, audits });
}

function receiptVars(o: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const sh = (o.shipping ?? null) as Record<string, string> | null;
  const money = (c: number) => (c / 100).toFixed(2);
  const items = o.items.map((i) => ({ name: i.name, qty: i.qty, unit: money(i.unitCents), total: money(i.unitCents * i.qty) }));
  const itemsHtml = items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #2a272e;color:#f2f0f4">${i.qty}× ${i.name.replace(/</g, "&lt;")}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #2a272e;color:#f2f0f4">$${i.total}</td></tr>`).join("");
  return {
    orderNumber: o.number, name: sh?.name || o.user?.name || o.email, email: o.email,
    items, itemsHtml, subtotal: money(o.subtotalCents), shipping: money(o.shippingCents), tax: money(o.taxCents), discount: money(o.discountCents), total: money(o.totalCents),
    shippingAddress: sh ? [sh.name, sh.line1, sh.line2, `${sh.city || ""}${sh.region ? ", " + sh.region : ""} ${sh.postal || ""}`, sh.country].filter(Boolean).join("\n") : "",
    trackingNumber: o.trackingNumber || "", trackingCarrier: o.trackingCarrier || "",
  };
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const order = await load(id);
  if (!order) return notFound();
  const body = await readJson<{ action?: string; trackingNumber?: string; trackingCarrier?: string; note?: string; reason?: string; amountCents?: number }>(req);
  const action = body.action;
  const before = { status: order.status, trackingNumber: order.trackingNumber, notes: order.notes };

  switch (action) {
    case "mark_paid": {
      if (["paid", "fulfilled", "shipped"].includes(order.status)) return bad("Order is already paid.");
      await fulfillPaidOrder(order.id, { paymentMethod: "comp" });
      break;
    }
    case "fulfill":
    case "ship": {
      const trackingNumber = str(body.trackingNumber, 120).trim() || order.trackingNumber;
      const trackingCarrier = str(body.trackingCarrier, 60).trim() || order.trackingCarrier;
      const status = action === "ship" ? "shipped" : "fulfilled";
      await prisma.order.update({ where: { id }, data: { status, trackingNumber, trackingCarrier, fulfilledAt: order.fulfilledAt ?? new Date() } });
      if (action === "ship" && order.needsShipping) {
        const v = receiptVars({ ...order, trackingNumber, trackingCarrier });
        await sendTemplate("order_shipped", order.email, { ...v, subject: `Your order #${order.number} has shipped`, fallbackText: `Order #${order.number} shipped${trackingNumber ? ` — ${trackingCarrier || ""} ${trackingNumber}` : ""}.` }, { orderId: order.id, userId: order.userId ?? undefined });
      }
      break;
    }
    case "cancel": {
      if (["shipped", "refunded"].includes(order.status)) return bad(`Cannot cancel a ${order.status} order.`);
      await prisma.order.update({ where: { id }, data: { status: "cancelled" } });
      break;
    }
    case "refund": {
      if (!["paid", "fulfilled", "shipped"].includes(order.status)) return bad("Only paid orders can be refunded.");
      const amountCents = Number.isFinite(body.amountCents) && Number(body.amountCents) > 0 ? Math.min(Number(body.amountCents), order.totalCents) : order.totalCents;
      if (order.paymentRef && order.paymentMethod !== "comp") {
        const r = await divinitycoin.refund(order.paymentRef, amountCents / 100, str(body.reason, 300) || "Admin refund");
        if (!r.success) return bad(`DivinityCoin refund failed: ${r.error || "unknown error"}`, 502);
      }
      await prisma.order.update({ where: { id }, data: { status: "refunded", notes: [order.notes, `Refunded $${(amountCents / 100).toFixed(2)} by ${g.name} on ${new Date().toISOString()}${body.reason ? ` — ${str(body.reason, 300)}` : ""}`].filter(Boolean).join("\n") } });
      break;
    }
    case "note": {
      const note = str(body.note, 2000).trim();
      if (!note) return bad("Note is empty.");
      await prisma.order.update({ where: { id }, data: { notes: [order.notes, `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${g.name}] ${note}`].filter(Boolean).join("\n") } });
      break;
    }
    case "resend_receipt": {
      const v = receiptVars(order);
      const r = await sendTemplate("order_receipt", order.email, { ...v, subject: `Receipt for order #${order.number}`, fallbackText: `Thanks for your order #${order.number}. Total $${v.total}.` }, { orderId: order.id, userId: order.userId ?? undefined });
      if (!r.ok) return bad(r.error || "Send failed", 502);
      break;
    }
    case "set_status": {
      const status = str((body as { status?: string }).status, 30);
      if (!["pending", "awaiting_payment", "paid", "fulfilled", "shipped", "cancelled", "refunded", "failed"].includes(status)) return bad("Bad status");
      await prisma.order.update({ where: { id }, data: { status } });
      break;
    }
    default: return bad("Unknown action");
  }
  const after = await prisma.order.findUnique({ where: { id }, select: { status: true, trackingNumber: true, notes: true } });
  await audit(g.id, `order.${action}`, "order", id, before, after);
  return NextResponse.json({ ok: true, order: await load(id) });
}
