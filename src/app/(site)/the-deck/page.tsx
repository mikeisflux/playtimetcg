import type { Metadata } from "next";
import Link from "next/link";
import { GameCard, RarityFrame, SpiceMeter } from "@/components/ui";
import TryARoll from "@/components/TryARoll";
import { DIE, RARITIES, HEAT_LEVELS } from "@/lib/content";
import { sampleCards } from "@/lib/catalog";
import { buildMetadata, jsonLdFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/the-deck", {
    title: "The Deck — Seven Categories, One Die | Play Time (18+)",
    description: "72 cards across seven categories, three rarities and five heat levels, all picked by a single 12-sided die. Try a roll and see one sample card from every category in the Play Time couples card game.",
    keywords: ["Play Time deck", "couples card game categories", "card game heat levels", "12-sided die card game", "rare cards couples game"],
  });
}

const INSIDE: [string, string][] = [
  ["72", "Cards"],
  ["1", "12-sided die"],
  ["1", "Quick start card"],
  ["3", "Rarity levels"],
];

export default async function TheDeck() {
  const samples = await sampleCards();
  const jsonLd = await jsonLdFor("/the-deck");
  const legend = DIE.map((d) => `${d.label} ${d.category}`).join(" · ");

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}

      {/* Header */}
      <section id="top" className="wrap" style={{ paddingBlock: "clamp(48px, 8vw, 104px) clamp(48px, 7vw, 88px)" }} data-screen-label="The deck header">
        <div className="stack gap-12" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "#A68CF5" }}>The deck</div>
          <h1 className="t-h2">Seven categories. One die.</h1>
          <p className="t-lead" style={{ marginTop: 8 }}>Cool colors are gentler, hot colors are bolder, and the die decides which pile you draw from. Every card tells you its category, its spice level and roughly how long it takes before you say yes.</p>
          <div className="label" style={{ fontSize: 12, marginTop: 8 }}>{legend}</div>
        </div>
      </section>

      {/* Try a roll */}
      <section id="deck" className="surface" data-screen-label="Try a roll">
        <div className="wrap section"><TryARoll cards={samples} /></div>
      </section>

      {/* One card from every category */}
      <section id="cards" className="wrap section" data-screen-label="One card from every category">
        <div className="between" style={{ marginBottom: 40 }}>
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#5AB8F0" }}>Sample cards</div>
            <h2 className="t-h2">One card from every category</h2>
          </div>
          <div className="label" style={{ fontSize: 12, maxWidth: 360 }}>Seven categories, one sample from each. Roll the die above to see them in play.</div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 24, justifyItems: "start" }}>
          {samples.map((c) => <GameCard key={c.code} card={c} />)}
        </div>
      </section>

      {/* Rarity and heat */}
      <section className="surface" data-screen-label="Rarity and heat">
        <div className="wrap section grid g-420" style={{ gap: "clamp(40px, 6vw, 96px)" }}>
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
        </div>
      </section>

      {/* What's inside */}
      <section id="inside" className="wrap section" data-screen-label="What's inside">
        <div className="stack gap-12" style={{ marginBottom: 40 }}>
          <div className="eyebrow" style={{ color: "#FFD23F" }}>What’s inside</div>
          <h2 className="t-h2">Everything in the bag</h2>
        </div>
        <div className="grid g-230" style={{ gap: 0, borderTop: "2px solid var(--text)" }}>
          {INSIDE.map(([v, l]) => (
            <div key={l} className="stack" style={{ gap: 10, padding: "28px 24px 32px 0", borderBottom: "2px solid var(--rule)" }}>
              <div className="num" style={{ fontSize: 48 }}>{v}</div>
              <div className="label">{l}</div>
            </div>
          ))}
        </div>
        <p className="t-body" style={{ marginTop: 28, maxWidth: 560 }}>Every set ships with the full 72-card base deck, the 12-sided die and a drawstring bag. Expansion packs add twelve cards each and shuffle straight in by color.</p>
      </section>

      {/* Close */}
      <section style={{ background: "var(--primary)", color: "var(--ink)" }} data-screen-label="Close">
        <div className="wrap section grid g-420" style={{ gap: 40, alignItems: "end" }}>
          <h2 className="t-poster">Ready when<br />you are.</h2>
          <div className="stack" style={{ gap: 22, alignItems: "flex-start" }}>
            <p style={{ fontSize: 20, lineHeight: 1.5, fontWeight: 500, maxWidth: 440 }}>Seven categories, three rarities, five heat levels and one die to pick the mood. The base set has all of it.</p>
            <Link className="btn btn--dark" href="/shop/base">Buy the base set</Link>
          </div>
        </div>
      </section>
    </>
  );
}
