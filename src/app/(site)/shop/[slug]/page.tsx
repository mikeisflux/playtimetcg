import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageSlot, Includes, GameCard } from "@/components/ui";
import ProductBuy from "@/components/ProductBuy";
import { activeProducts, productBySlug } from "@/lib/catalog";
import { money, SAMPLE_CARDS } from "@/lib/content";
import { buildMetadata, jsonLdFor } from "@/lib/seo";
import { getSessionUser, isAgeVerified } from "@/lib/auth";
import { getSettings, flag } from "@/lib/settings";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) return { title: "Not found" };
  return buildMetadata(`/shop/${slug}`, {
    title: `${p.name} — ${money(p.priceCents)}`,
    description: p.description || `${p.name}. ${p.tag ?? ""} ${p.includes.join(", ")}.`.trim(),
    type: "website",
  });
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) notFound();
  const [expansions, user, ageOk, s, jsonLd] = await Promise.all([
    activeProducts("expansion"), getSessionUser(), isAgeVerified(), getSettings(["DISCREET_PACKAGING", "SITE_URL"]), jsonLdFor(`/shop/${slug}`),
  ]);
  const setCards = p.cardSetId ? await prisma.card.findMany({ where: { setId: p.cardSetId, active: true }, orderBy: { sortIndex: "asc" }, take: 3 }) : [];
  const gallery = [p.imageUrl, ...(p.kind === "set" ? [null, null] : [])];
  const productLd = JSON.stringify({
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description || p.tag || undefined,
    image: p.imageUrl ? [p.imageUrl] : undefined, brand: { "@type": "Brand", name: "Play Time" },
    offers: { "@type": "Offer", priceCurrency: "USD", price: (p.priceCents / 100).toFixed(2), availability: "https://schema.org/InStock", url: `${(s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "")}/shop/${p.slug}` },
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd || productLd }} />
      <section className="wrap section grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }} data-screen-label="Product">
        <div className="stack gap-16">
          {p.kind === "expansion" || p.kind === "digital_pack" ? (
            <div style={{ position: "relative" }}>
              <div style={{ height: 12, background: p.accent }} />
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12, padding: "24px 0" }}>
                {(setCards.length ? setCards : SAMPLE_CARDS.slice(0, 3)).map((c) => (
                  <GameCard key={c.code} small setName={p.name.replace(/ — digital pack$/, "")} card={{ code: c.code, title: c.title, category: c.category as never, rarity: c.rarity as never, spice: c.spice, time: c.time, text: p.kind === "digital_pack" ? "Tear the pack open online to reveal which cards you get." : c.text }} />
                ))}
              </div>
            </div>
          ) : (
            gallery.map((src, i) => (
              <ImageSlot key={i} src={ageOk ? src : null} alt={`${p.name} photo ${i + 1}`} hint={i === 0 ? `${p.name} · product photo · 1600 × 1200 px` : `${p.name} · detail ${i + 1} · 1600 × 1200 px`} />
            ))
          )}
        </div>
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: p.accent }}>{p.kind === "subscription" ? "Subscription" : p.kind === "expansion" ? "Expansion pack" : p.kind === "digital_pack" ? "Digital pack" : "The deck"}</div>
            <h1 className="t-h2">{p.name}</h1>
            {p.tag && <div className="prod__tag" style={{ color: p.accent, fontSize: 12 }}>{p.tag}</div>}
          </div>
          {p.description && <p className="t-lead">{p.description}</p>}
          <Includes items={p.includes} />
          <ProductBuy product={p} expansions={expansions} user={user ? { id: user.id } : null} />
          <div className="note">
            {p.digital ? "Digital — delivered to your account instantly." : `Ships within 2 business days.${flag(s.DISCREET_PACKAGING) ? " Plain, discreet packaging." : ""}`}{" "}
            Paid securely through DivinityCoin. <Link href="/shipping">Shipping</Link> · <Link href="/returns">Returns</Link>
          </div>
        </div>
      </section>
    </>
  );
}
