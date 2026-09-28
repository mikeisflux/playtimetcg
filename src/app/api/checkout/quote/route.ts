import { NextResponse } from "next/server";
import { priceCart } from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const { lines } = await req.json();
    const q = await priceCart(Array.isArray(lines) ? lines : []);
    return NextResponse.json({ subtotalCents: q.subtotalCents, shippingCents: q.shippingCents, taxCents: q.taxCents, totalCents: q.totalCents, needsShipping: q.needsShipping, problems: q.problems });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not price the cart." }, { status: 500 });
  }
}
