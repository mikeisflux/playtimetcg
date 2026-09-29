"use client";
import { useRef } from "react";

/* Wraps a card in a light rig: the card tilts toward the pointer, a
   specular sheen follows it, and foil cards get a rainbow holographic
   layer that shifts with the angle. A halo in the card's color breathes
   underneath. Touch works too (pointer events). */
export default function HoloCard({ children, color, foil, halo = true, small, className = "", style }: {
  children: React.ReactNode; color?: string; foil?: boolean; halo?: boolean; small?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const n = ref.current; if (!n) return;
    const r = n.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    n.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    n.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    n.style.setProperty("--ry", `${((px - 0.5) * 22).toFixed(2)}deg`);
    n.style.setProperty("--rx", `${((0.5 - py) * 16).toFixed(2)}deg`);
    n.style.setProperty("--sheen", "1");
  }
  function leave() {
    const n = ref.current; if (!n) return;
    n.style.setProperty("--ry", "0deg"); n.style.setProperty("--rx", "0deg"); n.style.setProperty("--sheen", "0");
  }

  return (
    <div ref={ref} className={`holo${foil ? " holo--foil" : ""}${halo ? " holo--halo" : ""}${small ? " holo--sm" : ""} ${className}`}
      style={{ ...(color ? ({ "--c": color } as React.CSSProperties) : null), ...style }}
      onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave}>
      <div className="holo__tilt">
        {children}
        <div className="holo__sheen" aria-hidden />
        {foil && <div className="holo__foil" aria-hidden />}
      </div>
      {halo && <div className="holo__halo" aria-hidden />}
    </div>
  );
}
