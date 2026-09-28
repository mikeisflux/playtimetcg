"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProduct } from "./AddToCart";
import type { PublicProduct } from "@/lib/catalog";
import { money } from "@/lib/content";

/* Product page buy box: quantity stepper, bundle pack chooser, subscription CTA. */
export default function ProductBuy({ product, expansions, user }: { product: PublicProduct; expansions: PublicProduct[]; user: { id: string } | null }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const need = product.requiresChoice?.count ?? 0;

  if (product.kind === "subscription") {
    return (
      <div className="stack gap-16">
        <div className="price" style={{ fontSize: 32 }}>{money(product.priceCents)} <span className="label">/ {product.subInterval || "month"}</span></div>
        <div className="note">Billed to your card each period. Cancel anytime from your account.</div>
        {err && <div className="note note--err">{err}</div>}
        <button className="btn" disabled={busy} onClick={async () => {
          if (!user) { router.push(`/login?next=${encodeURIComponent(`/shop/${product.slug}`)}`); return; }
          if (product.subPlan === "monthly_cards") { router.push(`/checkout/subscribe?product=${product.slug}`); return; }
          setBusy(true); setErr("");
          const res = await fetch("/api/subscriptions/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id }) });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) { setErr(data.error || "Could not start the subscription."); return; }
          window.location.href = data.url;
        }}>{busy ? "One moment…" : user ? "Subscribe" : "Sign in to subscribe"}</button>
      </div>
    );
  }

  function toggle(slug: string) {
    setChosen((c) => c.includes(slug) ? c.filter((x) => x !== slug) : c.length < need ? [...c, slug] : c);
  }

  return (
    <div className="stack gap-20">
      <div className="price" style={{ fontSize: 32 }}>{money(product.priceCents)}</div>
      {need > 0 && (
        <div className="stack gap-12">
          <div className="label" style={{ fontSize: 12 }}>Choose {need} expansion packs · {chosen.length}/{need}</div>
          <div className="rows rows--rule">
            {expansions.map((e) => {
              const on = chosen.includes(e.slug);
              return (
                <button key={e.slug} type="button" onClick={() => toggle(e.slug)} aria-pressed={on}
                  className="row" style={{ background: on ? "rgba(255,255,255,0.06)" : "transparent", border: 0, padding: "12px 12px 12px 0", gap: 16, textAlign: "left", width: "100%", color: "inherit", flexWrap: "nowrap" }}>
                  <span style={{ width: 14, height: 14, background: e.accent, flex: "none", marginLeft: 12 }} />
                  <span className="t-item-sm" style={{ color: on ? "var(--text-strong)" : "var(--text-dim)", flex: 1 }}>{e.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: on ? "var(--highlight)" : "var(--text-faint)" }}>{on ? "Chosen" : "Choose"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 16 }}>
        <div className="stepper">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
          <span>{qty}</span>
          <button onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Increase">+</button>
        </div>
        <button className="btn" disabled={need > 0 && chosen.length !== need} onClick={() => {
          const names = chosen.map((s) => expansions.find((e) => e.slug === s)?.name ?? s);
          addProduct(product, qty, need > 0 ? { slugs: chosen, names } : undefined);
        }}>
          Add to cart — {money(product.priceCents * qty)}
        </button>
      </div>
      {need > 0 && chosen.length !== need && <div className="note">Pick {need - chosen.length} more to continue.</div>}
      {product.digital && !user && <div className="note">Digital packs need an account with online play. <a href={`/login?next=/shop/${product.slug}`}>Sign in</a></div>}
    </div>
  );
}
