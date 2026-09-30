import { NextResponse } from "next/server";
import { getSessionUser, requestOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { confirmCheckoutSession, startCheckout } from "@/lib/orders";

/* Embedded DivinityCoin checkout → our page. The frame posts "complete";
   we ask DivinityCoin for the authoritative outcome and settle the order.
   Guests are allowed: the order id + session id pair is the proof. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || ""), sessionId = String(body.sessionId || "");
  if (!orderId || !sessionId) return NextResponse.json({ error: "orderId and sessionId are required." }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, paymentRef: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.paymentRef && order.paymentRef.startsWith("cs_") && order.paymentRef !== sessionId) return NextResponse.json({ error: "Session mismatch." }, { status: 400 });
  if (body.reopen) {
    /* fallback when the frame can't load: a fresh top-level session that navigates back to us on its own */
    try { const r = await startCheckout(orderId, { embed: false, origin: await requestOrigin() }); return NextResponse.json({ ok: true, url: r.url }); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not reopen checkout." }, { status: 400 }); }
  }
  try {
    const r = await confirmCheckoutSession(orderId, sessionId);
    if (r.ok) return NextResponse.json({ ok: true, status: r.status, redirect: `/checkout/success?order=${orderId}` });
    return NextResponse.json({ ok: false, status: r.status, message: r.message }, { status: r.status === "pending" ? 202 : 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not verify the payment." }, { status: 502 });
  }
}
