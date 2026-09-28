import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { money } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";
import ClearCart from "@/components/ClearCart";
import { confirmCheckoutSession } from "@/lib/orders";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/checkout/success", { title: "Thank you", noindex: true });
}

export default async function Success({ searchParams }: { searchParams: Promise<{ order?: string; session_id?: string }> }) {
  const { order: id, session_id } = await searchParams;
  /* DivinityCoin appends ?session_id=cs_… on the way back. If its webhook
     hasn't landed yet, ask DivinityCoin directly and settle now. */
  if (id && session_id) await confirmCheckoutSession(id, session_id).catch(() => {});
  const order = id ? await prisma.order.findUnique({ where: { id }, include: { items: true } }) : null;
  const paid = order && ["paid", "fulfilled", "shipped"].includes(order.status);
  return (
    <section className="wrap section grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
      <ClearCart />
      <div className="stack gap-28">
        <div className="eyebrow" style={{ color: "#3FD6C8" }}>{paid ? "Paid" : "Almost"}</div>
        <h1 className="t-h2">{paid ? "Thank you. Enjoy the night." : "We’re confirming your payment."}</h1>
        <p className="t-lead">
          {paid
            ? "Your receipt is on its way. Physical items ship within two business days; digital items are already in your account."
            : "DivinityCoin is confirming the payment. This page will update on refresh — usually within a few seconds. Your receipt email confirms it too."}
        </p>
        <div className="row">
          <Link className="btn" href="/account/orders">View your orders</Link>
          <Link className="btn btn--outline" href="/shop">Keep shopping</Link>
        </div>
      </div>
      {order && (
        <div className="panel panel--surface">
          <div className="t-item">Order #{order.number}</div>
          <div className="stack">
            {order.items.map((i) => (
              <div key={i.id} className="row" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                <span className="t-item-sm">{i.name} × {i.qty}</span><span className="mono" style={{ fontSize: 14 }}>{money(i.unitCents * i.qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span className="label">Total</span><span className="subtotal">{money(order.totalCents)}</span></div>
          <div className="tag" style={{ alignSelf: "flex-start" }}>{order.status.replace("_", " ")}</div>
        </div>
      )}
    </section>
  );
}
