import type { Metadata } from "next";
import Link from "next/link";
import { ImageSlot, Includes } from "@/components/ui";
import AddToCart from "@/components/AddToCart";
import { activeProducts } from "@/lib/catalog";
import { money } from "@/lib/content";
import { buildMetadata, jsonLdFor } from "@/lib/seo";
import { getSettings, flag } from "@/lib/settings";
import { isAgeVerified } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/shop", {
    title: "Shop — Base Set, Bundles, Expansions & Online Play",
    description: "Buy the Play Time base set, the Couple’s bundle, the Collector edition, six expansion packs, digital packs and the monthly 3-card subscription.",
    keywords: ["buy Play Time card game", "couples card game shop", "expansion packs", "monthly card subscription"],
  });
}

export default async function Shop() {
  const [sets, expansions, subs, digital, s, ageOk, jsonLd] = await Promise.all([
    activeProducts("set"), activeProducts("expansion"), activeProducts("subscription"), activeProducts("digital_pack"),
    getSettings(["DISCREET_PACKAGING"]), isAgeVerified(), jsonLdFor("/shop"),
  ]);
  const discreet = flag(s.DISCREET_PACKAGING);

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <section className="wrap section" style={{ paddingBottom: "clamp(40px, 5vw, 64px)" }} data-screen-label="Shop">
        <div className="between" style={{ marginBottom: 40 }}>
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "var(--primary)" }}>Shop</div>
            <h1 className="t-h2">Get the deck</h1>
          </div>
          <div className="label" style={{ fontSize: 12 }}>Every set includes the 12-sided die{discreet ? " · ships discreetly" : ""}</div>
        </div>
        <div className="grid g-300" id="bundles">
          {sets.map((p) => (
            <div key={p.id} className={`prod${p.featured ? " prod--featured" : ""}`}>
              <Link href={`/shop/${p.slug}`}><ImageSlot src={ageOk ? p.imageUrl : null} alt={p.name} hint={`${p.name} · product photo · 1600 × 1200 px`} /></Link>
              <div className="prod__body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <Link href={`/shop/${p.slug}`} className="prod__name" style={{ color: "var(--text-strong)" }}>{p.name}</Link>
                  <div className="price">{money(p.priceCents)}</div>
                </div>
                {p.tag && <div className="prod__tag" style={{ color: p.accent }}>{p.tag}</div>}
                <Includes items={p.includes} />
                <div style={{ flex: 1 }} />
                <AddToCart product={p} className={`btn btn--md${p.featured ? " btn--featured" : ""}`} label={p.requiresChoice ? "Choose your packs" : "Add to cart"} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="expansions" className="surface">
        <div className="wrap section">
          <div className="between" style={{ marginBottom: 28 }}>
            <div className="stack gap-12">
              <div className="eyebrow" style={{ color: "#5AB8F0" }}>Expansions</div>
              <h2 className="t-h3">Six packs. Twelve cards each.</h2>
            </div>
            <div style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 360 }}>Shuffle them into the base deck, or play one on its own for a themed night.</div>
          </div>
          <div className="grid g-190">
            {expansions.map((k) => (
              <div key={k.id} className="pack">
                <div className="pack__band" style={{ background: k.accent }} />
                <div className="pack__body">
                  <Link href={`/shop/${k.slug}`} className="pack__name" style={{ color: "var(--text-strong)" }}>{k.name}</Link>
                  <div className="pack__hook">{k.tag}</div>
                  <div className="pack__foot">
                    <div className="pack__price">{money(k.priceCents)}</div>
                    <AddToCart product={k} className="btn btn--sm" style={{ "--accent": k.accent } as React.CSSProperties} label="Add" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="subscriptions" className="wrap section grid g-420" style={{ gap: "clamp(40px, 6vw, 96px)" }}>
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#FFD23F" }}>Subscriptions</div>
            <h2 className="t-h2m">Keep it going</h2>
            <p className="t-body">Two ways to keep the deck growing: three new physical cards every month, or the whole game online with your partner, wherever they are.</p>
          </div>
          <div className="stack gap-16">
            {subs.map((p) => (
              <div key={p.id} className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div className="t-item">{p.name}</div>
                  <div className="price">{money(p.priceCents)}<span className="label" style={{ marginLeft: 6 }}>/ {p.subInterval || "month"}</span></div>
                </div>
                {p.tag && <div className="prod__tag" style={{ color: p.accent }}>{p.tag}</div>}
                <p className="t-body-sm">{p.description}</p>
                <Includes items={p.includes} />
                <Link href={`/shop/${p.slug}`} className="btn btn--md" style={{ alignSelf: "flex-start" }}>Subscribe</Link>
              </div>
            ))}
          </div>
        </div>
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#A68CF5" }}>Digital packs</div>
            <h2 className="t-h2m">Tear them open on screen</h2>
            <p className="t-body">Three random cards from a set, added to your online collection the moment the order is paid. Needs an online play subscription.</p>
          </div>
          <div className="grid g-190">
            {digital.map((k) => (
              <div key={k.id} className="pack">
                <div className="pack__band" style={{ background: k.accent }} />
                <div className="pack__body">
                  <Link href={`/shop/${k.slug}`} className="pack__name" style={{ color: "var(--text-strong)" }}>{k.name}</Link>
                  <div className="pack__hook">{k.tag}</div>
                  <div className="pack__foot">
                    <div className="pack__price">{money(k.priceCents)}</div>
                    <AddToCart product={k} className="btn btn--sm" style={{ "--accent": k.accent } as React.CSSProperties} label="Add" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
