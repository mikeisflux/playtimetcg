import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageSlot, Includes, GameCard, JsonLd } from "@/components/ui";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductBuy from "@/components/ProductBuy";
import { activeProducts, productBySlug } from "@/lib/catalog";
import { money, SAMPLE_CARDS } from "@/lib/content";
import { buildMetadata, jsonLdFor, productLd } from "@/lib/seo";
import { getSessionUser, isAgeVerified } from "@/lib/auth";
import { getSettings, flag } from "@/lib/settings";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) return { title: "Not found", robots: { index: false, follow: false } };
  const kind = p.kind === "expansion" ? "expansion pack" : p.kind === "subscription" ? "subscription" : p.kind === "digital_pack" ? "digital pack" : p.kind === "kit" ? "accessories kit" : "card game";
  const fallback = `${p.name}: ${p.tag ? `${p.tag}. ` : ""}${p.includes.join(", ")}. Buy the Play Time ${kind} for ${money(p.priceCents)}.`;
  const description = (p.description || fallback).replace(/\s+/g, " ").trim();
  return buildMetadata(`/shop/${slug}`, {
    title: `${p.name} — ${money(p.priceCents)}`,
    description: description.length > 160 ? `${description.slice(0, 157).replace(/\s+\S*$/, "")}…` : description,
    type: "website",
  });
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) notFound();
  const [expansions, user, ageOk, s, jsonLd, ld] = await Promise.all([
    activeProducts("expansion"), getSessionUser(), isAgeVerified(), getSettings(["DISCREET_PACKAGING"]), jsonLdFor(`/shop/${slug}`), productLd(p),
  ]);
  const setCards = p.cardSetId ? await prisma.card.findMany({ where: { setId: p.cardSetId, active: true }, orderBy: { sortIndex: "asc" }, take: 3 }) : [];
  const gallery = [p.imageUrl, ...(p.kind === "set" ? [null, null] : [])];
  const parent = p.kind === "expansion" ? { name: "Expansions", href: "/expansions" } : { name: "Shop", href: "/shop" };

  return (
    <>
      <JsonLd data={jsonLd || ld} />
      <Breadcrumbs items={[parent, { name: p.name, href: `/shop/${p.slug}` }]} />
      <section className="wrap section grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }} data-screen-label="Product">
        <div className="stack gap-16">
          {p.kind === "expansion" || p.kind === "digital_pack" ? (
            <div style={{ position: "relative" }}>
              <div style={{ height: 12, background: p.accent }} />
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12, padding: "24px 0" }}>
                {(setCards.length ? setCards : SAMPLE_CARDS.slice(0, 3)).map((c) => (
                  <GameCard key={c.code} small setName={p.name.replace(/ — digital pack$/, "")} card={{ code: c.code, title: c.title, category: c.category as never, rarity: c.rarity as never, spice: c.spice, time: c.time, text: p.kind === "digital_pack" ? "Tear the pack open online to reveal which cards you get." : c.text, art: "imageUrl" in c && c.imageUrl ? `/api/cards/art/${c.code}` : null }} />
                ))}
              </div>
            </div>
          ) : (
            gallery.map((src, i) => (
              <ImageSlot key={i} src={ageOk ? src : null} alt={i === 0 ? `${p.name} — Play Time card game box` : `${p.name} — detail photo ${i}`} hint={i === 0 ? `${p.name} · product photo · 1600 × 1200 px` : `${p.name} · detail ${i + 1} · 1600 × 1200 px`} priority={i === 0} />
            ))
          )}
        </div>
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: p.accent }}>{p.kind === "subscription" ? "Subscription" : p.kind === "expansion" ? "Expansion pack" : p.kind === "digital_pack" ? "Digital pack" : p.kind === "kit" ? "Play kit" : "The deck"}</div>
            <h1 className="t-h2">{p.name}</h1>
            {p.tag && <div className="prod__tag" style={{ color: p.accent, fontSize: 12 }}>{p.tag}</div>}
          </div>
          {p.description && <p className="t-lead">{p.description}</p>}
          <Includes items={p.includes} />
          <ProductBuy product={p} expansions={expansions} user={user ? { id: user.id } : null} />
          <div className="note">
            {p.digital ? "Digital — delivered to your account instantly." : `Ships within 2 business days.${flag(s.DISCREET_PACKAGING) ? " Plain, discreet packaging." : ""}`}{" "}
            Paid securely through DivinityCoin. <Link href="/shipping">Shipping</Link> · <Link href="/returns">Returns</Link> · <Link href="/how-to-play">How to play</Link> · <Link href="/faq">FAQ</Link>
          </div>
        </div>
      </section>
    </>
  );
}
