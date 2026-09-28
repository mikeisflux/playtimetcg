import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/checkout/cancel", { title: "Checkout cancelled", noindex: true });
}

export default async function Cancel({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: id } = await searchParams;
  if (id) await prisma.order.updateMany({ where: { id, status: { in: ["pending", "awaiting_payment"] } }, data: { status: "cancelled" } }).catch(() => {});
  return (
    <section className="wrap section stack gap-28" style={{ maxWidth: 720 }}>
      <div className="eyebrow" style={{ color: "#FF6A3D" }}>Cancelled</div>
      <h1 className="t-h2">No charge was made.</h1>
      <p className="t-lead">Your cart is still here whenever you’re ready.</p>
      <div className="row"><Link className="btn" href="/checkout">Back to checkout</Link><Link className="btn btn--outline" href="/shop">Keep shopping</Link></div>
    </section>
  );
}
