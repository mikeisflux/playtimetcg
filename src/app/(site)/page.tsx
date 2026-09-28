import type { Metadata } from "next";
import Link from "next/link";
import { RampStrip, ImageSlot, RarityFrame, SpiceMeter, Includes, JsonLd } from "@/components/ui";
import TryARoll from "@/components/TryARoll";
import AddToCart from "@/components/AddToCart";
import HeroVideo from "@/components/HeroVideo";
import { HOW_STEPS, RARITIES, HEAT_LEVELS, money } from "@/lib/content";
import { activeProducts, sampleCards, type PublicProduct } from "@/lib/catalog";
import { buildMetadata, jsonLdFor, organizationLd, websiteLd } from "@/lib/seo";
import { getSettings, flag } from "@/lib/settings";
import { isAgeVerified } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/", {
    title: "Play Time — The Card Game for Couples (18+)",
    absolute: true,
    description: "72 cards, one 12-sided die, and a better night than the one you were planning. An adult card game for couples, written by a practicing sex therapist.",
    keywords: ["couples card game", "adult card game", "sex therapist game", "date night game", "intimacy game for couples", "Play Time card game"],
  });
}

export default async function Home() {
  const [products, kits, expansions, s, ageOk, jsonLd, samples, orgLd, siteLd] = await Promise.all([
    activeProducts("set"), activeProducts("kit"), activeProducts("expansion"),
    getSettings(["DISCREET_PACKAGING", "INTRO_VIDEO_URL", "INTRO_VIDEO_POSTER", "HERO_VIDEO_URL", "HERO_VIDEO_ENABLED", "HERO_VIDEO_AUTOPLAY"]), isAgeVerified(), jsonLdFor("/"), sampleCards(),
    organizationLd(), websiteLd(),
  ]);
  const base = products.find((p) => p.slug === "base");
  const basePrice = base ? money(base.priceCents) : "$35";
  const discreet = flag(s.DISCREET_PACKAGING);
  const heroVideo = flag(s.HERO_VIDEO_ENABLED, true) ? (s.HERO_VIDEO_URL || s.INTRO_VIDEO_URL) : "";

  return (
    <>
      {/* Organization + WebSite graph (an Admin → SEO override for "/" replaces it) */}
      <JsonLd data={jsonLd || [orgLd, siteLd]} />

      {/* 3. Hero */}
      <section id="top" className={`wrap hero${heroVideo ? "" : " hero--photo"}`} style={{ paddingBlock: "clamp(48px, 8vw, 104px) clamp(56px, 8vw, 96px)" }} data-screen-label="Hero">
        <div className="hero__head">
          <div className="eyebrow">A card game for couples · 18+</div>
          <h1 className={`t-hero${heroVideo ? " t-hero--video" : ""}`}>Roll the die.<br /><span className="hl">Raise the heat.</span></h1>
          <p className="t-lead" style={{ maxWidth: 520 }}>72 cards, one 12-sided die, and a better night than the one you were planning. Written by a practicing sex therapist to be easy to say yes to — and just as easy to say no.</p>
          {!heroVideo && <HeroCta base={base} basePrice={basePrice} />}
        </div>
        <div className="hero__media">
          {heroVideo ? (
            <>
              <HeroVideo src={heroVideo} poster={s.INTRO_VIDEO_POSTER || undefined} autoplay={flag(s.HERO_VIDEO_AUTOPLAY, true)} />
              <RampStrip h={10} />
              <div className="label" style={{ marginTop: 14 }}>Watch the trailer · sound on with one tap</div>
              <div className="hero__cta"><HeroCta base={base} basePrice={basePrice} /></div>
            </>
          ) : (
            <>
              <ImageSlot src={ageOk ? base?.imageUrl && base.imageSlot === "site-hero" ? base.imageUrl : null : null} alt="A couple with the Play Time deck on the bed" hint="Hero · suggestive, not explicit · couple + deck on the bed · 1600 × 2000 px" aspect="4 / 5" priority />
              <RampStrip h={10} />
            </>
          )}
        </div>
      </section>

      {/* 4. Statement */}
      <section className="surface" data-screen-label="Statement">
        <div className="wrap grid g-380" style={{ paddingBlock: "clamp(56px, 8vw, 104px)", gap: "clamp(28px, 4vw, 64px)", alignItems: "end" }}>
          <h2 className="t-h2s">Most couples fall into a rut.</h2>
          <div className="stack gap-16">
            <p className="t-20">Same moves. Same nights. Same routine. You don’t need another self-help book. You need something you actually want to play.</p>
            <p className="t-item hl">No complicated rules. No awkward lectures.</p>
          </div>
        </div>
      </section>

      {/* 5. How it works */}
      <section id="how" className="wrap section" data-screen-label="How it works">
        <div className="stack gap-12" style={{ marginBottom: 48 }}>
          <div className="eyebrow" style={{ color: "var(--primary)" }}>How it works</div>
          <h2 className="t-h2">Learn it in a minute.</h2>
        </div>
        <div className="grid g-230" style={{ gap: 0, borderTop: "2px solid var(--text)" }}>
          {HOW_STEPS.map((st) => (
            <div key={st.n} className="step">
              <div className="step__n" style={{ color: st.col }}>{st.n}</div>
              <h3 className="t-item">{st.title}</h3>
              <div className="t-body">{st.body}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 32 }}>
          <Link className="btn btn--outline" href="/how-to-play">Read the full rules</Link>
          <Link className="btn btn--outline" href="/faq">Questions, answered</Link>
        </div>
      </section>

      {/* 6. Try a roll */}
      <section id="deck" className="surface" data-screen-label="Try a roll">
        <div className="wrap section stack" style={{ gap: 32 }}>
          <TryARoll cards={samples} />
          <div className="nextup"><span className="nextup__label">See every category</span><Link href="/the-deck">The deck: seven categories, one die</Link></div>
        </div>
      </section>

      {/* 7. Rarity and heat */}
      <section className="wrap section grid g-420" style={{ gap: "clamp(40px, 6vw, 96px)" }} data-screen-label="Rarity and heat">
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#E86BD8" }}>Collect them</div>
            <h2 className="t-h2m">Three rarities</h2>
          </div>
          <div className="stack gap-20">
            {RARITIES.map((r) => (
              <div key={r.name} className="row" style={{ gap: 20, flexWrap: "nowrap" }}>
                <RarityFrame frame={r.frame} />
                <div className="stack min0" style={{ gap: 6 }}>
                  <div className="t-item-md">{r.name}</div>
                  <div className="t-body-sm">{r.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#FF6A3D" }}>Set your ceiling</div>
            <h2 className="t-h2m">Five heat levels</h2>
          </div>
          <div className="rows">
            {HEAT_LEVELS.map((h) => (
              <div key={h.level} className="row" style={{ gap: 18, padding: "14px 0", flexWrap: "nowrap" }}>
                <SpiceMeter n={h.level} color={h.color} tall />
                <div className="t-item-sm" style={{ width: 84, flex: "none" }}>{h.name}</div>
                <div className="t-body-sm min0" style={{ lineHeight: 1.45 }}>{h.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Shop */}
      <section id="shop" className="surface" style={{ borderBottom: 0 }} data-screen-label="Shop">
        <div className="wrap" style={{ paddingBlock: "var(--section-y) clamp(40px, 5vw, 64px)" }}>
          <div className="between" style={{ marginBottom: 40 }}>
            <div className="stack gap-12">
              <div className="eyebrow" style={{ color: "var(--primary)" }}>Shop</div>
              <h2 className="t-h2">Get the deck</h2>
            </div>
            <div className="label" style={{ fontSize: 12 }}>Every set includes the 12-sided die{discreet ? " · ships discreetly" : ""}</div>
          </div>
          <div className="grid g-300" id="bundles">
            {products.map((p) => (
              <div key={p.id} className={`prod${p.featured ? " prod--featured" : ""}`}>
                <ImageSlot src={ageOk ? p.imageUrl : null} alt={`${p.name} — Play Time card game box`} hint={`${p.name} · product photo · 1600 × 1200 px`} />
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
        </div>
        {kits.length > 0 && (
          <div className="wrap kitrow">
            {kits.map((p) => (
              <div key={p.id} className="prod prod--kit">
                <ImageSlot src={ageOk ? p.imageUrl : null} alt={`${p.name} — Play Time accessories kit`} hint={`${p.name} · product photo · 1600 × 1200 px`} />
                <div className="prod__body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <Link href={`/shop/${p.slug}`} className="prod__name" style={{ color: "var(--text-strong)" }}>{p.name}</Link>
                    <div className="price">{money(p.priceCents)}</div>
                  </div>
                  {p.tag && <div className="prod__tag" style={{ color: p.accent }}>{p.tag}</div>}
                  <Includes items={p.includes} />
                  <div style={{ flex: 1 }} />
                  <AddToCart product={p} className="btn btn--md" label="Add to cart" />
                </div>
              </div>
            ))}
          </div>
        )}
        <div id="expansions" className="wrap" style={{ paddingBlock: "clamp(40px, 5vw, 64px) var(--section-y)" }}>
          <div className="between" style={{ marginBottom: 28, borderTop: "2px solid var(--rule)", paddingTop: 40 }}>
            <div className="stack gap-12">
              <div className="eyebrow" style={{ color: "#5AB8F0" }}>Expansions</div>
              <h3 className="t-h3">Six packs. Twelve cards each.</h3>
            </div>
            <div style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 360 }}>Shuffle them into the base deck, or play one on its own for a themed night. <Link href="/expansions" style={{ color: "var(--text-strong)", textDecoration: "underline" }}>See all expansions</Link> or <Link href="/pricing" style={{ color: "var(--text-strong)", textDecoration: "underline" }}>compare the sets</Link>.</div>
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

      {/* 9. Close */}
      <section style={{ background: "var(--primary)", color: "var(--ink)" }} data-screen-label="Close">
        <div className="wrap section grid g-420" style={{ gap: 40, alignItems: "end" }}>
          <h2 className="t-poster">Keep it fun.<br />Keep it hot.</h2>
          <div className="stack" style={{ gap: 22, alignItems: "flex-start" }}>
            <p style={{ fontSize: 20, lineHeight: 1.5, fontWeight: 500, maxWidth: 440 }}>Written by a practicing sex therapist. Built so either of you can pass, tweak or stop — any card, any time.</p>
            {base ? <AddToCart product={base} className="btn btn--dark" label={`Buy the base set — ${basePrice}`} /> : <Link className="btn btn--dark" href="/shop">Buy the base set — {basePrice}</Link>}
          </div>
        </div>
      </section>
    </>
  );
}

function HeroCta({ base, basePrice }: { base: PublicProduct | undefined; basePrice: string }) {
  return (
    <>
      <div className="row">
        {base ? <AddToCart product={base} label={`Buy the base set — ${basePrice}`} /> : <Link className="btn" href="/shop">Buy the base set — {basePrice}</Link>}
        <a className="btn btn--outline" href="#how">See how it works</a>
      </div>
      <div className="row" style={{ gap: 24, borderTop: "2px solid var(--rule)", paddingTop: 20, alignItems: "flex-start" }}>
        {[["72", "Cards"], ["d12", "One die"], ["7", "Categories"], ["5", "Heat levels"]].map(([v, l]) => (
          <div key={l} className="stack" style={{ gap: 4 }}>
            <div className="num">{v}</div>
            <div className="label">{l}</div>
          </div>
        ))}
      </div>
    </>
  );
}
