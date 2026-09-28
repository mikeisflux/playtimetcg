import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { type ShippingInput } from "@/lib/orders";
import { startSubscription } from "@/lib/subscriptions";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const body = await req.json();
    let shipping: ShippingInput | null = null;
    if (body.shipping) {
      const sh = body.shipping;
      for (const k of ["name", "line1", "city", "region", "postal", "country"]) if (!sh[k]) return NextResponse.json({ error: "Please complete the shipping address." }, { status: 400 });
      shipping = { name: sh.name, line1: sh.line1, line2: sh.line2 || undefined, city: sh.city, region: sh.region, postal: sh.postal, country: String(sh.country).toUpperCase().slice(0, 2), phone: sh.phone || undefined };
    }
    const r = await startSubscription(user.id, String(body.productId), shipping);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start the subscription." }, { status: 400 });
  }
}
