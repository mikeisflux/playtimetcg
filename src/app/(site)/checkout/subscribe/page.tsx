import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { productBySlug } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { money } from "@/lib/content";
import SubscribeForm from "@/components/SubscribeForm";

export const metadata: Metadata = { title: "Subscribe", robots: { index: false, follow: false } };

/* Monthly-cards subscription needs a shipping address before DivinityCoin. */
export default async function Subscribe({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: slug } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/subscribe?product=${slug ?? ""}`)}`);
  const p = slug ? await productBySlug(slug) : null;
  if (!p || p.kind !== "subscription") notFound();
  const addr = await prisma.address.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return (
    <section className="wrap section grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <div className="eyebrow" style={{ color: p.accent }}>Subscription</div>
        <h1 className="t-h2">{p.name}</h1>
        <div className="price" style={{ fontSize: 32 }}>{money(p.priceCents)} <span className="label">/ {p.subInterval || "month"}</span></div>
        <p className="t-lead">{p.description}</p>
        <p className="note">Billed to your card every {p.subInterval || "month"}. Cancel anytime from your account; the current period runs out, no partial refunds.</p>
      </div>
      <SubscribeForm productId={p.id} needsShipping={p.subPlan === "monthly_cards"} address={addr ? { name: addr.name, line1: addr.line1, line2: addr.line2 ?? "", city: addr.city, region: addr.region, postal: addr.postal, country: addr.country, phone: addr.phone ?? "" } : { name: user.name }} />
    </section>
  );
}
