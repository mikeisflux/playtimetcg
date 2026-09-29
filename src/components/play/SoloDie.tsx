"use client";
import { useEffect, useRef, useState } from "react";
import { DIE, categoryForRoll } from "@/lib/content";
import Die3D from "./fx/Die3D";
import { fx, buzz, centerOf } from "./fx/fx";

/* A standalone digital d12: tumbles for ~0.9s, then settles on 1–12.
   Honors prefers-reduced-motion by showing the result immediately. */
export default function SoloDie({ compact }: { compact?: boolean }) {
  const [n, setN] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function roll() {
    if (rolling) return;
    const final = 1 + Math.floor(Math.random() * 12);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(final); setRolled(true); return; }
    setRolling(true); setRolled(false); buzz([10, 30, 10]);
    fx({ kind: "ring", color: "#ffffff", ...centerOf(box.current) });
    timer.current = setTimeout(() => { setN(final); setRolling(false); }, 900);
  }
  function landed(v: number) {
    const c = categoryForRoll(v).color;
    setRolled(true);
    fx({ kind: "burst", color: c, count: 90, ...centerOf(box.current) });
    fx({ kind: "flash", color: c, strength: 0.35 });
    buzz(40);
  }

  const face = categoryForRoll(n ?? 1);
  return (
    <div className="panel" style={{ gap: 24 }}>
      <div className="stack gap-12">
        <div className="eyebrow" style={{ color: "#A68CF5" }}>Solo die</div>
        <div className="t-item">Just need the d12?</div>
        {!compact && <p className="t-body-sm" style={{ maxWidth: 440 }}>Playing with the physical deck? Roll here and read the category off the legend. Cool colors are gentler, hot colors are bolder.</p>}
      </div>
      <div className="row" style={{ gap: 24 }}>
        <div ref={box}><Die3D value={n} rolling={rolling} size={170} onLand={landed} /></div>
        <div className="stack gap-12" style={{ alignItems: "flex-start" }}>
          <div className="pit__roll"><button className="btn btn--light" onClick={roll} disabled={rolling} aria-live="polite">{rolling ? "Rolling…" : "Roll the die"}</button></div>
          {rolled && !rolling && n && <div className="label glow-text" style={{ color: face.color, fontSize: 13 }}>{n} — {face.category}</div>}
        </div>
      </div>
      <div className="legend" role="list">
        {DIE.map((d) => (
          <div key={d.category} className={`legend__row${rolled && d.category === face.category ? " on" : ""}`} role="listitem" style={{ "--tint": d.color } as React.CSSProperties}>
            <div className="legend__sw" style={{ background: d.color }} />
            <div className="legend__die" style={{ color: d.color }}>{d.label}</div>
            <div className="legend__name">{d.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
