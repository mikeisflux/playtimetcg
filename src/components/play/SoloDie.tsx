"use client";
import { useEffect, useRef, useState } from "react";
import { DIE, categoryForRoll } from "@/lib/content";
import { DieFace } from "@/components/ui";

/* A standalone digital d12: 11 ticks every 70ms (770ms), settles on 1–12.
   Honors prefers-reduced-motion by showing the result immediately. */
export default function SoloDie({ compact }: { compact?: boolean }) {
  const [n, setN] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function roll() {
    if (rolling) return;
    const final = 1 + Math.floor(Math.random() * 12);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(final); setRolled(true); return; }
    setRolling(true);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      if (ticks >= 11) {
        if (timer.current) clearInterval(timer.current);
        setN(final); setRolling(false); setRolled(true);
      } else {
        setN(1 + Math.floor(Math.random() * 12));
      }
    }, 70);
  }

  const face = categoryForRoll(n);
  return (
    <div className="panel" style={{ gap: 24 }}>
      <div className="stack gap-12">
        <div className="eyebrow" style={{ color: "#A68CF5" }}>Solo die</div>
        <div className="t-item">Just need the d12?</div>
        {!compact && <p className="t-body-sm" style={{ maxWidth: 440 }}>Playing with the physical deck? Roll here and read the category off the legend. Cool colors are gentler, hot colors are bolder.</p>}
      </div>
      <div className="row" style={{ gap: 24 }}>
        <DieFace n={n} color={rolled || rolling ? face.color : "#3a363f"} large />
        <div className="stack gap-12" style={{ alignItems: "flex-start" }}>
          <button className="btn btn--light" onClick={roll} disabled={rolling} aria-live="polite">{rolling ? "Rolling…" : "Roll the die"}</button>
          {rolled && !rolling && <div className="label" style={{ color: face.color }}>{n} — {face.category}</div>}
        </div>
      </div>
      <div className="legend" role="list">
        {DIE.map((d) => (
          <div key={d.category} className={`legend__row${rolled && d.category === face.category ? " on" : ""}`} role="listitem">
            <div className="legend__sw" style={{ background: d.color }} />
            <div className="legend__die" style={{ color: d.color }}>{d.label}</div>
            <div className="legend__name">{d.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
