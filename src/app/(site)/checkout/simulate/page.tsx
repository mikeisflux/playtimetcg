import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSetting, flag } from "@/lib/settings";
import { money } from "@/lib/content";
import Simulator from "@/components/Simulator";

export const metadata: Metadata = { title: "DivinityCoin test checkout", robots: { index: false, follow: false } };

/* TEST MODE ONLY (Admin → Settings → DivinityCoin → Test mode). Stands in
   for DivinityCoin's hosted checkout: "Pay" posts a correctly signed
   payment.completed event to our own webhook, so the whole order flow can be
   exercised before the real processor is connected. */
export default async function Simulate({ searchParams }: { searchParams: Promise<{ order?: string; subscription?: string; success?: string; cancel?: string }> }) {
  if (!flag(await getSetting("DIVINITYCOIN_TEST_MODE"))) notFound();
  const sp = await searchParams;
  const order = sp.order ? await prisma.order.findUnique({ where: { id: sp.order } }) : null;
  const sub = sp.subscription ? await prisma.subscription.findUnique({ where: { id: sp.subscription } }) : null;
  if (!order && !sub) notFound();
  const amountCents = order ? order.totalCents : sub!.priceCents;
  return (
    <section className="wrap section stack gap-28" style={{ maxWidth: 640 }}>
      <div className="eyebrow" style={{ color: "#FFD23F" }}>DivinityCoin · test mode</div>
      <h1 className="t-h2">Simulated checkout</h1>
      <p className="t-lead">This page stands in for DivinityCoin while test mode is on. Nothing is charged.</p>
      <div className="panel panel--surface">
        <div className="t-item">{order ? `Order #${order.number}` : `Subscription · ${sub!.plan}`}</div>
        <div className="subtotal">{money(amountCents)}</div>
        <Simulator reference={order ? order.id : sub!.id} amount={amountCents / 100} kind={order ? "order" : "subscription"} successUrl={sp.success || "/"} cancelUrl={sp.cancel || "/"} />
      </div>
    </section>
  );
}
