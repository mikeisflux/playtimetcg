"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, RARITIES, CATEGORY_COLORS, type Category } from "@/lib/content";
import { GameCard } from "@/components/ui";
import HoloCard from "./fx/HoloCard";
import { toCardData, type CollectionItem } from "./types";

export default function Collection({ items, baseTotal }: { items: CollectionItem[]; baseTotal: number }) {
  const [cat, setCat] = useState("");
  const [rarity, setRarity] = useState("");
  const [set, setSet] = useState("");
  const [q, setQ] = useState("");

  const sets = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of items) m.set(c.setSlug, c.setName);
    return [...m.entries()];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((c) =>
      (!cat || c.category === cat) && (!rarity || c.rarity === rarity) && (!set || c.setSlug === set) &&
      (!needle || c.title.toLowerCase().includes(needle) || c.text.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle)));
  }, [items, cat, rarity, set, q]);

  const rares = items.filter((c) => c.rarity === "Rare").length;

  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="t-item">Nothing here yet.</div>
        <p className="t-body">Your collection starts with the base deck the moment you subscribe.</p>
        <div><Link className="btn btn--outline" href="/play">Back to play</Link></div>
      </div>
    );
  }

  return (
    <div className="stack gap-28">
      <div className="row" style={{ gap: 32, borderTop: "2px solid var(--rule)", paddingTop: 20, alignItems: "flex-start" }}>
        {[[String(items.length), "Owned · unique"], [String(baseTotal), "Base deck"], [String(rares), "Rares"], [String(sets.length), sets.length === 1 ? "Set" : "Sets"]].map(([v, l]) => (
          <div key={l} className="stack" style={{ gap: 4 }}>
            <div className="num">{v}</div>
            <div className="label">{l}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Rarity">
          <option value="">All rarities</option>
          {RARITIES.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <select className="input" value={set} onChange={(e) => setSet(e.target.value)} aria-label="Set">
          <option value="">All sets</option>
          {sets.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, text or code" aria-label="Search" />
      </div>

      <div className="label">{filtered.length} of {items.length} cards</div>

      {filtered.length === 0 ? (
        <div className="note">No cards match those filters.</div>
      ) : (
        <div className="collgrid">
          {filtered.map((c) => (
            <div key={c.id} className="collwrap">
              {c.qty > 1 && <span className="qtypill">×{c.qty}</span>}
              <HoloCard small color={CATEGORY_COLORS[c.category as Category]} foil={c.rarity === "Rare"} halo={false}>
                <GameCard card={toCardData(c)} setName={c.setName} imageUrl={c.imageUrl} small />
              </HoloCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
