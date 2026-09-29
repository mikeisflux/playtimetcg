"use client";
import { useEffect, useRef, useState } from "react";
import { DIE, categoryForRoll, SAMPLE_CARDS, type CardData } from "@/lib/content";
import { GameCard } from "./ui";
import Die3D from "./play/fx/Die3D";
import HoloCard from "./play/fx/HoloCard";
import { fx, buzz, centerOf } from "./play/fx/fx";

/* The interactive die: a 3D d12 that tumbles for ~0.9s and settles on
   1–12 in a burst of its category color; the page's light takes that color
   too. Honors prefers-reduced-motion by showing the result immediately. */
export default function TryARoll({ large, onResult, cards = SAMPLE_CARDS }: { large?: boolean; onResult?: (n: number) => void; cards?: CardData[] }) {
  const [n, setN] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); document.documentElement.style.removeProperty("--arena-tint"); }, []);

  function roll() {
    if (rolling) return;
    const final = 1 + Math.floor(Math.random() * 12);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(final); onResult?.(final); return; }
    setRolling(true); buzz([10, 30, 10]);
    fx({ kind: "ring", color: "#ffffff", ...centerOf(box.current) });
    timer.current = setTimeout(() => { setN(final); setRolling(false); onResult?.(final); }, 900);
  }
  function landed(v: number) {
    const c = categoryForRoll(v).color;
    document.documentElement.style.setProperty("--arena-tint", c);
    fx({ kind: "burst", color: c, count: 90, ...centerOf(box.current) });
    fx({ kind: v === 12 ? "strobe" : "flash", color: c, strength: 0.35, times: 3 });
    buzz(40);
  }

  const face = categoryForRoll(n ?? 1);
  const card = cards.find((c) => c.category === face.category) ?? cards[0];

  return (
    <div className="grid g-400" style={{ gap: "clamp(40px, 6vw, 96px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <div className="stack gap-12">
          <div className="eyebrow" style={{ color: "#A68CF5" }}>Try a roll</div>
          <h2 className="t-h2">The die picks the mood.</h2>
          <p className="t-body" style={{ fontSize: 17, maxWidth: 480 }}>Twelve faces, seven categories. Cool colors are gentler, hot colors are bolder. You decide the details.</p>
        </div>
        <div className="row" style={{ gap: 28 }}>
          <div ref={box}><Die3D value={n} rolling={rolling} size={large ? 200 : 160} onLand={landed} /></div>
          <div className="pit__roll"><button className="btn btn--light" onClick={roll} disabled={rolling} aria-live="polite">{rolling ? "Rolling…" : "Roll the die"}</button></div>
        </div>
        <div className="legend" role="list">
          {DIE.map((d) => (
            <div key={d.category} className={`legend__row${n && d.category === face.category ? " on" : ""}`} role="listitem" style={{ "--tint": d.color } as React.CSSProperties}>
              <div className="legend__sw" style={{ background: d.color }} />
              <div className="legend__die" style={{ color: d.color }}>{d.label}</div>
              <div className="legend__name">{d.category}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="stack gap-20" style={{ alignItems: "flex-start" }}>
        <div className="label" style={{ fontSize: 12, letterSpacing: "0.18em" }}>A card from {face.category}</div>
        <HoloCard color={face.color} foil={card.rarity === "Rare"}><GameCard card={card} /></HoloCard>
      </div>
    </div>
  );
}
