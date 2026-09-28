import type { Metadata } from "next";
import Link from "next/link";
import { ImageSlot, Includes, JsonLd } from "@/components/ui";
import Breadcrumbs from "@/components/Breadcrumbs";
import AddToCart from "@/components/AddToCart";
import { money } from "@/lib/content";
import { activeProducts, type PublicProduct } from "@/lib/catalog";
import { buildMetadata, jsonLdFor, itemListLd } from "@/lib/seo";
import { isAgeVerified } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/pricing", {
    title: "Pricing — Base Set, Couple’s Bundle or Collector",
    description: "Compare the three Play Time sets: the 72-card base set, the Couple’s bundle with two expansion packs, and the Collector edition with all six packs and Rares.",
    keywords: ["Play Time price", "couples card game bundle", "collector edition card game", "Play Time base set", "adult card game pricing"],
  });
}

const FALLBACK: Record<string, string> = { base: "$35", bundle: "$59", collector: "$99" };

function Yes() { return <span className="yes">Yes</span>; }
function No() { return <span className="no">—</span>; }

export default async function Pricing() {
  const [sets, subs, ageOk, jsonLd] = await Promise.all([
    activeProducts("set"), activeProducts("subscription"), isAgeVerified(), jsonLdFor("/pricing"),
  ]);
  const listLd = await itemListLd("Play Time sets", "/pricing", [...sets, ...subs]);
  const by = (slug: string): PublicProduct | undefined => sets.find((p) => p.slug === slug);
  const price = (slug: string) => { const p = by(slug); return p ? money(p.priceCents) : FALLBACK[slug] ?? "—"; };
  const cols: { slug: string; head: string }[] = [
    { slug: "base", head: by("base")?.name ?? "Base" },
    { slug: "bundle", head: by("bundle")?.name ?? "Couple’s bundle" },
    { slug: "collector", head: by("collector")?.name ?? "Collector" },
  ];
  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: "Cards", cells: ["72", "72", "72"] },
    { label: "12-sided die", cells: [<Yes key="b" />, <Yes key="u" />, <Yes key="c" />] },
    { label: "Drawstring bag", cells: [<Yes key="b" />, <Yes key="u" />, <Yes key="c" />] },
    { label: "Expansion packs", cells: ["0", "2", "6"] },
    { label: "Premium storage box", cells: [<No key="b" />, <No key="u" />, <Yes key="c" />] },
    { label: "Exclusive Rares", cells: [<No key="b" />, <No key="u" />, <Yes key="c" />] },
    { label: "Price", cells: cols.map((c) => <strong key={c.slug} style={{ color: "var(--highlight)", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20 }}>{price(c.slug)}</strong>) },
  ];

  return (
    <>
      <JsonLd data={jsonLd || listLd} />
      <Breadcrumbs items={[{ name: "Pricing", href: "/pricing" }]} />

      {/* Header */}
      <section id="top" className="wrap" style={{ paddingBlock: "clamp(48px, 8vw, 104px) clamp(40px, 6vw, 72px)" }} data-screen-label="Pricing header">
        <div className="between">
          <div className="stack gap-12" style={{ maxWidth: 760 }}>
            <div className="eyebrow" style={{ color: "var(--primary)" }}>Pricing</div>
            <h1 className="t-h2">Pick your night.</h1>
            <p className="t-lead" style={{ marginTop: 8 }}>Three ways to buy the same 72-card game. The difference is how many expansion packs come in the box, and what the box is made of.</p>
          </div>
          <div className="label" style={{ fontSize: 12 }}>Every set includes the 12-sided die</div>
        </div>
      </section>

      {/* Sets */}
      <section id="sets" className="wrap" style={{ paddingBottom: "var(--section-y)" }} data-screen-label="Sets">
        {sets.length === 0 && (
          <div className="empty" style={{ borderTop: "2px solid var(--rule)" }}>
            <div className="t-item">Sets are on their way</div>
            <p className="t-body">The shop is not stocked yet. Check back soon.</p>
          </div>
        )}
        <div className="grid g-380" style={{ gap: 24 }}>
          {sets.map((p) => (
            <div key={p.id} className={`prod${p.featured ? " prod--featured" : ""}`}>
              <ImageSlot src={ageOk ? p.imageUrl : null} alt={`${p.name} — Play Time card game box`} hint={`${p.name} · product photo · 1600 × 1200 px`} />
              <div className="prod__body" style={{ padding: 28, gap: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <h2 className="prod__name" style={{ margin: 0, fontSize: 28 }}><Link href={`/shop/${p.slug}`} style={{ color: "var(--text-strong)" }}>{p.name}</Link></h2>
                  <div className="price" style={{ fontSize: 28 }}>{money(p.priceCents)}</div>
                </div>
                {p.tag && <div className="prod__tag" style={{ color: p.accent }}>{p.tag}</div>}
                {p.description && <p className="t-body-sm">{p.description}</p>}
                <Includes items={p.includes} />
                <div style={{ flex: 1 }} />
                <AddToCart product={p} className={`btn btn--md${p.featured ? " btn--featured" : ""}`} label={p.requiresChoice ? "Choose your packs" : "Add to cart"} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="surface" data-screen-label="Compare">
        <div className="wrap section">
          <div className="stack gap-12" style={{ marginBottom: 40 }}>
            <div className="eyebrow" style={{ color: "#A68CF5" }}>Side by side</div>
            <h2 className="t-h2">What’s in each box</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="compare" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col"><span className="sr">Feature</span></th>
                  {cols.map((c) => <th key={c.slug} scope="col">{c.head}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    {r.cells.map((cell, i) => <td key={cols[i].slug}>{cell}</td>)}
                  </tr>
                ))}
                <tr>
                  <td />
                  {cols.map((c) => {
                    const p = by(c.slug);
                    return (
                      <td key={c.slug} style={{ borderBottom: 0, paddingTop: 20 }}>
                        {p
                          ? <AddToCart product={p} className="btn btn--sm" style={{ "--accent": p.accent } as React.CSSProperties} label={p.requiresChoice ? "Choose packs" : "Add"} />
                          : <Link className="btn btn--sm" href="/shop">Shop</Link>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Subscriptions */}
      {subs.length > 0 && (
        <section id="subscriptions" className="wrap section" data-screen-label="Subscriptions">
          <div className="grid g-380" style={{ gap: "clamp(32px, 5vw, 80px)", alignItems: "start" }}>
            <div className="stack gap-12">
              <div className="eyebrow" style={{ color: "#3FD6C8" }}>Play online</div>
              <h2 className="t-h3">Subscriptions</h2>
              <p className="t-body" style={{ fontSize: 17, maxWidth: 420, marginTop: 8 }}>Play from your phones with a digital deck. Cancel any time.</p>
            </div>
            <div className="rows">
              {subs.map((s) => (
                <Link key={s.id} href={`/shop/${s.slug}`} className="between" style={{ padding: "22px 0", gap: 16, alignItems: "flex-start", color: "inherit" }}>
                  <div className="stack min0" style={{ gap: 6, flex: "1 1 260px" }}>
                    <div className="t-item">{s.name}</div>
                    {s.description && <div className="t-body-sm">{s.description}</div>}
                  </div>
                  <div className="price" style={{ flex: "none" }}>{money(s.priceCents)}<span className="label" style={{ marginLeft: 6 }}>/month</span></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Close */}
      <section style={{ background: "var(--primary)", color: "var(--ink)" }} data-screen-label="Close">
        <div className="wrap section grid g-420" style={{ gap: 40, alignItems: "end" }}>
          <h2 className="t-poster">Ready when<br />you are.</h2>
          <div className="stack" style={{ gap: 22, alignItems: "flex-start" }}>
            <p style={{ fontSize: 20, lineHeight: 1.5, fontWeight: 500, maxWidth: 440 }}>Not sure? Start with the base set. Every pack plugs into it later, and the rules never change.</p>
            <div className="row"><Link className="btn btn--dark" href="/shop/base">Buy the base set</Link><Link className="btn btn--dark" href="/faq">Questions, answered</Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
