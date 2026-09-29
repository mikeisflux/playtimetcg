"use client";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game";
import type { CardData } from "@/lib/content";
import { DIE, backArtUrl, CATEGORY_COLORS, type Category } from "@/lib/content";
import { GameCard, CardBack } from "@/components/ui";
import type { Act } from "./Room";
import { GREY, type CollectionItem } from "./types";
import HoloCard from "./fx/HoloCard";
import { fx, buzz, centerOf } from "./fx/fx";

/* The matched back, face down, before it's turned over: the printed back
   artwork when the server has it, else the CSS stand-in. */
export function useBackArt(category: string) {
  const [art, setArt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const url = backArtUrl(category);
    fetch(url, { method: "HEAD" }).then((r) => { if (alive) setArt(r.ok ? url : null); }).catch(() => { if (alive) setArt(null); });
    return () => { alive = false; };
  }, [category]);
  return art;
}

export function BackPreview({ category, onFlip }: { category: string; onFlip?: () => void }) {
  const art = useBackArt(category);
  const color = CATEGORY_COLORS[category as Category] ?? GREY;
  const back = <CardBack category={category} art={art ?? null} />;
  if (!onFlip) return <HoloCard color={color}><div className="flipcard"><div className="flipcard__in">{back}</div></div></HoloCard>;
  return (
    <HoloCard color={color}>
      <button type="button" className="flipcard flipcard--tap" onClick={(e) => { fx({ kind: "flash", color, strength: 0.35 }); fx({ kind: "ring", color, ...centerOf(e.currentTarget) }); buzz(20); onFlip(); }} aria-label={`Turn over the first ${category} card`} title="Turn it over">
        <div className="flipcard__in">{back}</div>
      </button>
    </HoloCard>
  );
}

/* The drawn card: mounts back-up and turns over to its face, for both
   players at the same moment. Two-step 2D turn (back squeezes to a line,
   face grows out of it) so only one face is ever in the DOM — no 3D
   backface tricks, which some browsers get wrong and show mirrored. The
   face lands in a light burst in its category color. */
export function FlipCard({ card, category }: { card: CardData; category: string }) {
  const art = useBackArt(category);
  const color = CATEGORY_COLORS[category as Category] ?? GREY;
  const wrap = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<"back" | "squeeze" | "grow" | "front">("back");
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStage("front"); return; }
    const t1 = setTimeout(() => setStage("squeeze"), 80);
    const t2 = setTimeout(() => setStage("grow"), 80 + 320);
    const t3 = setTimeout(() => { setStage("front"); fx({ kind: "burst", color, count: 70, ...centerOf(wrap.current) }); buzz([20, 40, 30]); }, 80 + 340);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [color]);
  const showBack = stage === "back" || stage === "squeeze";
  return (
    <div ref={wrap}>
      <HoloCard color={color} foil={!showBack && card.rarity === "Rare"}>
        <div className="flipcard">
          <div className={`flipcard__face${stage === "squeeze" || stage === "grow" ? " is-edge" : ""}`}>
            {showBack ? <CardBack category={category} art={art ?? null} /> : <GameCard card={card} />}
          </div>
        </div>
      </HoloCard>
    </div>
  );
}

/* The deck, face down: one colored back per card, top of the deck first.
   After a roll the first matching back is lifted — that's the card you take. */
export function DeckFan({ deck, category, onPick }: { deck: GameState["deck"]; category: string | null; onPick?: () => void }) {
  const cards = Array.isArray(deck) ? deck : [];
  const pick = category ? cards.findIndex((d) => d.category === category) : -1;
  return (
    <div className="stack gap-12">
      <div className="label">The deck · {cards.length} card{cards.length === 1 ? "" : "s"}, top first</div>
      <div className="deckfan" aria-label="Deck, face down">
        {cards.map((d, i) => {
          const face = DIE.find((f) => f.category === d.category);
          const cls = `deckfan__card${category && d.category === category ? " on" : ""}${i === pick ? " pick" : ""}`;
          const style = { "--c": face?.color ?? GREY } as React.CSSProperties;
          if (i === pick && onPick) return <button key={i} type="button" className={`${cls} deckfan__card--btn`} style={style} onClick={onPick} title="Turn this one over" aria-label={`Turn over the first ${d.category} card`} />;
          return <div key={i} className={cls} style={style} title={`${d.category} · roll ${face?.label ?? ""}`} />;
        })}
      </div>
    </div>
  );
}

/* Dealer's Choice: the roller looks through the whole deck and picks one card. */
export function DealerPick({ deck, act }: { deck: GameState["deck"]; act: Act }) {
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    fetch("/api/play/collection").then((r) => r.json()).then((d: CollectionItem[] | { error: string }) => { if (Array.isArray(d)) setItems(d); }).catch(() => setItems([]));
  }, []);
  const inDeck = new Set((Array.isArray(deck) ? deck : []).map((d) => d.code).filter(Boolean));
  const options = (items ?? []).filter((c) => inDeck.has(c.code)).sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code));
  return (
    <div className="stack gap-12">
      <div className="label">Dealer’s Choice · pick any card in the deck</div>
      <div className="row">
        <select className="input" style={{ maxWidth: 420 }} value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">{items ? "Choose a card…" : "Loading the deck…"}</option>
          {options.map((c) => <option key={c.code} value={c.code}>{c.category} · {c.title} · {c.spice}/5</option>)}
        </select>
        <button className="btn" disabled={!code} onClick={() => void act({ type: "pickAny", code })}>Play it</button>
        <button className="btn btn--text" onClick={() => void act({ type: "reroll" })}>Roll again</button>
      </div>
      <div className="note">Your ceiling still applies. Dealer’s Choice can’t pick a card you left in the box.</div>
    </div>
  );
}
