import type { Metadata } from "next";
import Link from "next/link";
import AddToCart from "@/components/AddToCart";
import { JsonLd } from "@/components/ui";
import Breadcrumbs from "@/components/Breadcrumbs";
import { money } from "@/lib/content";
import { activeProducts } from "@/lib/catalog";
import { buildMetadata, jsonLdFor, itemListLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/expansions", {
    title: "Expansion Packs — Six Packs, Twelve Cards Each",
    description: "Six expansion packs for the Play Time couples card game. Shuffle one into the base deck by color, or play a single pack on its own for a themed night.",
    keywords: ["Play Time expansions", "couples card game expansion pack", "date night card game add-on", "themed card game night", "Play Time packs"],
  });
}

const PLAYING = [
  { title: "Just shuffle them in", body: "Same colored backs as the base deck. Shuffle them straight in." },
  { title: "Themed night", body: "One pack’s 12 cards don’t cover every face of the die. Keep the pack as a small deck of its own. Look for a match there first, then in the base deck." },
  { title: "No-die night", body: "Or skip the die. Shuffle one pack on its own and take turns drawing from the top. This works best for Date Night and Travel, where the cards follow the evening rather than the roll." },
  { title: "Pack for the trip", body: "Date Night, Weekend Getaway and Travel cards often need somewhere you aren’t yet. Pull them before you leave and take a small stack with you." },
  { title: "Ceiling still applies", body: "Expansion cards follow your Spice ceiling like any other. Quick & Dirty leans hot: most of its cards are Spice 4." },
];

export default async function Expansions() {
  const [packs, jsonLd] = await Promise.all([activeProducts("expansion"), jsonLdFor("/expansions")]);
  const listLd = await itemListLd("Play Time expansion packs", "/expansions", packs);

  return (
    <>
      <JsonLd data={jsonLd || listLd} />
      <Breadcrumbs items={[{ name: "Expansions", href: "/expansions" }]} />

      {/* Header */}
      <section id="top" className="wrap" style={{ paddingBlock: "clamp(48px, 8vw, 104px) clamp(40px, 6vw, 72px)" }} data-screen-label="Expansions header">
        <div className="stack gap-12" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "#5AB8F0" }}>Expansions</div>
          <h1 className="t-h2">New nights. Same partner.<br />More reasons to roll the die.</h1>
          <p className="t-lead" style={{ marginTop: 8 }}>Six expansions, twelve cards each. Shuffle one into the base deck, or play a single pack on its own for a themed night.</p>
        </div>
      </section>

      {/* Packs */}
      <section id="packs" className="wrap" style={{ paddingBottom: "var(--section-y)" }} data-screen-label="Packs">
        {packs.length === 0 && (
          <div className="empty" style={{ borderTop: "2px solid var(--rule)" }}>
            <div className="t-item">Packs are on their way</div>
            <p className="t-body">The expansion packs are not in the shop yet. Check back soon, or start with the base set.</p>
          </div>
        )}
        <div className="stack" style={{ borderTop: packs.length ? "2px solid var(--rule)" : undefined }}>
          {packs.map((p) => (
            <div key={p.id} id={p.slug} style={{ borderBottom: "2px solid var(--rule)", paddingTop: 28 }}>
              <div style={{ height: 8, background: p.accent }} aria-hidden />
              <div className="between" style={{ alignItems: "flex-start", gap: 32, padding: "28px 0 40px" }}>
                <div className="stack gap-12" style={{ maxWidth: 720, flex: "1 1 360px" }}>
                  <h2 className="t-h3" style={{ margin: 0 }}><Link href={`/shop/${p.slug}`} style={{ color: "var(--text-strong)" }}>{p.name}</Link></h2>
                  {p.tag && <div className="t-item-sm" style={{ color: p.accent }}>{p.tag}</div>}
                  {p.description
                    ? <p className="t-body" style={{ fontSize: 17, marginTop: 6 }}>{p.description}</p>
                    : <p className="t-body muted" style={{ fontSize: 17, marginTop: 6, fontStyle: "italic" }}>Longer description coming soon.</p>}
                </div>
                <div className="stack" style={{ gap: 12, alignItems: "flex-start", flex: "0 0 auto" }}>
                  <div className="label">12 cards</div>
                  <div className="price">{money(p.priceCents)}</div>
                  <AddToCart product={p} className="btn btn--sm" style={{ "--accent": p.accent } as React.CSSProperties} label="Add" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Playing with expansions */}
      <section id="playing" className="surface" data-screen-label="Playing with expansions">
        <div className="wrap section grid g-380" style={{ gap: "clamp(32px, 5vw, 80px)", alignItems: "start" }}>
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#A68CF5" }}>Mix and match</div>
            <h2 className="t-h3">Playing with expansions</h2>
            <p className="t-body" style={{ fontSize: 17, maxWidth: 420, marginTop: 8 }}>Five ways to use a pack. None of them changes the rules you already know.</p>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>No expansion includes Free Play cards. A 12 always draws from the base four.</div>
          </div>
          <div className="rows">
            {PLAYING.map((r, j) => (
              <div key={r.title} className="numrow">
                <div className="numrow__n" style={{ color: "#5AB8F0" }}>{String(j + 1).padStart(2, "0")}</div>
                <div className="numrow__body">
                  <h3 className="t-item">{r.title}</h3>
                  <div className="t-body">{r.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section style={{ background: "var(--primary)", color: "var(--ink)" }} data-screen-label="Close">
        <div className="wrap section grid g-420" style={{ gap: 40, alignItems: "end" }}>
          <h2 className="t-poster">Ready when<br />you are.</h2>
          <div className="stack" style={{ gap: 22, alignItems: "flex-start" }}>
            <p style={{ fontSize: 20, lineHeight: 1.5, fontWeight: 500, maxWidth: 440 }}>Every pack plugs into the base deck. Start there, then add the packs that sound like your kind of night.</p>
            <div className="row"><Link className="btn btn--dark" href="/shop/base">Buy the base set</Link><Link className="btn btn--dark" href="/shop">Next: the shop</Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
