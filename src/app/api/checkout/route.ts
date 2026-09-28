import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOrder, startCheckout, payWithCredits, type ShippingInput } from "@/lib/orders";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const email = String(user?.email || body.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    let shipping: ShippingInput | null = null;
    if (body.shipping) {
      const sh = body.shipping;
      const req_ = ["name", "line1", "city", "region", "postal", "country"];
      for (const k of req_) if (!sh[k] || !String(sh[k]).trim()) return NextResponse.json({ error: "Please complete the shipping address." }, { status: 400 });
      shipping = { name: String(sh.name).slice(0, 120), line1: String(sh.line1).slice(0, 200), line2: sh.line2 ? String(sh.line2).slice(0, 200) : undefined, city: String(sh.city).slice(0, 100), region: String(sh.region).slice(0, 100), postal: String(sh.postal).slice(0, 20), country: String(sh.country).slice(0, 2).toUpperCase(), phone: sh.phone ? String(sh.phone).slice(0, 40) : undefined };
    }
    const { order, priced } = await createOrder({ lines: body.lines ?? [], email, userId: user?.id ?? null, shipping, notes: body.notes ? String(body.notes) : undefined, discreet: body.discreet !== false });
    if (priced.items.some((i) => i.product.digital) && !user) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled", notes: "digital item without account" } });
      return NextResponse.json({ error: "Digital items need an account. Sign in first so we can add them to your collection." }, { status: 400 });
    }
    if (user && shipping) {
      const existing = await prisma.address.findFirst({ where: { userId: user.id, line1: shipping.line1, postal: shipping.postal } });
      if (!existing) await prisma.address.create({ data: { userId: user.id, ...shipping, line2: shipping.line2 ?? null, phone: shipping.phone ?? null, isDefault: true } });
    }
    if (body.method === "credits") {
      if (!user) return NextResponse.json({ error: "Sign in to pay with credits." }, { status: 401 });
      await payWithCredits(order.id, user.id);
      return NextResponse.json({ ok: true, url: `${await siteUrl()}/checkout/success?order=${order.id}` });
    }
    const { url } = await startCheckout(order.id);
    return NextResponse.json({ ok: true, url, orderId: order.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed." }, { status: 400 });
  }
}
