import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/content";
import type { ShippingInput } from "@/lib/orders";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/account/orders/${id}`);
  const o = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
  if (!o || (o.userId !== user.id && o.email !== user.email)) notFound();
  const sh = o.shipping as ShippingInput | null;
  const canPay = ["pending", "awaiting_payment", "failed"].includes(o.status);
  return (
    <section className="wrap section">
      <AccountNav current="/account/orders" name={user.name} />
      <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
        <div className="stack gap-20">
          <div className="between"><h2 className="t-h3">Order #{o.number}</h2><span className="tag">{o.status.replace("_", " ")}</span></div>
          <div className="label">{o.createdAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}</div>
          <div className="stack">
            {o.items.map((i) => (
              <div key={i.id} className="line">
                <div className="line__bar" style={{ background: i.product?.accent ?? "var(--primary)" }} />
                <div className="stack min0" style={{ flex: 1, gap: 4 }}>
                  <div className="line__name">{i.name}</div>
                  {i.choices && typeof i.choices === "object" && "names" in (i.choices as object) ? <div className="line__unit">{((i.choices as { names: string[] }).names).join(" + ")}</div> : null}
                  <div className="line__unit">{money(i.unitCents)} × {i.qty}{i.product?.digital ? (i.digitalGranted ? " · added to your collection" : " · digital") : ""}</div>
                </div>
                <div className="line__total">{money(i.unitCents * i.qty)}</div>
              </div>
            ))}
          </div>
          <div className="stack" style={{ gap: 6, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{money(o.subtotalCents)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Shipping</span><span>{o.needsShipping ? (o.shippingCents ? money(o.shippingCents) : "Free") : "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tax</span><span>{o.taxCents ? money(o.taxCents) : "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 10, borderTop: "2px solid var(--rule)" }}><span className="label" style={{ fontSize: 12 }}>Total</span><span className="subtotal">{money(o.totalCents)}</span></div>
          </div>
          {canPay && <Link className="btn" href={`/checkout/resume?order=${o.id}`} style={{ alignSelf: "flex-start" }}>Complete payment</Link>}
        </div>
        <div className="stack gap-20">
          {sh && (
            <div className="panel panel--surface">
              <div className="t-item-sm">Shipping to</div>
              <div className="t-body-sm" style={{ whiteSpace: "pre-line" }}>{[sh.name, sh.line1, sh.line2, `${sh.city}, ${sh.region} ${sh.postal}`, sh.country].filter(Boolean).join("\n")}</div>
              {o.discreetPackaging && <div className="note">Plain, discreet packaging.</div>}
              {o.trackingNumber && <div className="note">Tracking: <strong style={{ color: "var(--text-strong)" }}>{o.trackingNumber}</strong>{o.trackingCarrier ? ` (${o.trackingCarrier})` : ""}</div>}
            </div>
          )}
          <div className="panel panel--surface">
            <div className="t-item-sm">Payment</div>
            <div className="t-body-sm">{o.paymentMethod === "divinitycoin_credits" ? "DivinityCoin credits" : o.paymentMethod === "comp" ? "Complimentary" : "DivinityCoin"}{o.paidAt ? ` · paid ${o.paidAt.toLocaleDateString("en-US", { dateStyle: "medium" })}` : ""}</div>
            {o.paymentRef && <div className="note mono">Ref {o.paymentRef}</div>}
          </div>
          <div className="note">Need help with this order? <Link href={`/contact?order=${o.number}`}>Contact us</Link>.</div>
        </div>
      </div>
    </section>
  );
}
