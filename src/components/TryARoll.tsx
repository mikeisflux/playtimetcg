"use client";
import { useEffect, useRef, useState } from "react";
import { DIE, categoryForRoll, sampleCardFor } from "@/lib/content";
import { DieFace, GameCard } from "./ui";

/* The interactive die: 11 ticks every 70ms (770ms), settles on 1–12.
   Honors prefers-reduced-motion by showing the result immediately. */
export default function TryARoll({ large, onResult }: { large?: boolean; onResult?: (n: number) => void }) {
  const [n, setN] = useState(1);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function roll() {
    if (rolling) return;
    const final = 1 + Math.floor(Math.random() * 12);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(final); onResult?.(final); return; }
    setRolling(true);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      if (ticks >= 11) {
        if (timer.current) clearInterval(timer.current);
        setN(final); setRolling(false); onResult?.(final);
      } else {
        setN(1 + Math.floor(Math.random() * 12));
      }
    }, 70);
  }

  const face = categoryForRoll(n);
  const card = sampleCardFor(face.category);

  return (
    <div className="grid g-400" style={{ gap: "clamp(40px, 6vw, 96px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <div className="stack gap-12">
          <div className="eyebrow" style={{ color: "#A68CF5" }}>Try a roll</div>
          <h2 className="t-h2">The die picks the mood.</h2>
          <p className="t-body" style={{ fontSize: 17, maxWidth: 480 }}>Twelve faces, seven categories. Cool colors are gentler, hot colors are bolder. You decide the details.</p>
        </div>
        <div className="row" style={{ gap: 24 }}>
          <DieFace n={n} color={face.color} large={large} />
          <button className="btn btn--light" onClick={roll} disabled={rolling} aria-live="polite">{rolling ? "Rolling…" : "Roll the die"}</button>
        </div>
        <div className="legend" role="list">
          {DIE.map((d) => (
            <div key={d.category} className={`legend__row${d.category === face.category ? " on" : ""}`} role="listitem">
              <div className="legend__sw" style={{ background: d.color }} />
              <div className="legend__die" style={{ color: d.color }}>{d.label}</div>
              <div className="legend__name">{d.category}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="stack gap-20" style={{ alignItems: "flex-start" }}>
        <div className="label" style={{ fontSize: 12, letterSpacing: "0.18em" }}>A card from {face.category}</div>
        <GameCard card={card} />
      </div>
    </div>
  );
}
