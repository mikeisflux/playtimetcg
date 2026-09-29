"use client";
import { useEffect, useRef, useState } from "react";
import { categoryForRoll } from "@/lib/content";
import { reducedMotion } from "./fx";

/* A real twelve-sided die in CSS 3D: twelve pentagons on a dodecahedron,
   each lit in its category color. While `rolling` it tumbles freely; when
   `value` lands (or rolling stops) it spins on to present that face to the
   camera and lights it up. `onLand` fires the moment it settles.

   Geometry: the front face sits at translateZ(d); an upper ring of five
   faces is tilted back by 63.435° (180° − the dodecahedron's 116.565°
   dihedral) at 36° + 72°k; the lower ring is tilted 116.565° at 72°k with
   the pentagon turned 36° so an edge, not a corner, meets the back face. */
const TILT = 63.43494882;
type Face = { n: number; phi: number; tilt: number; spin: number };
export const FACES: Face[] = [
  { n: 12, phi: 0, tilt: 0, spin: 0 },
  ...[2, 4, 6, 8, 10].map((n, k) => ({ n, phi: 36 + 72 * k, tilt: TILT, spin: 0 })),
  ...[7, 5, 3, 11, 9].map((n, k) => ({ n, phi: 72 * k, tilt: 180 - TILT, spin: 36 })),
  { n: 1, phi: 0, tilt: 180, spin: 0 },
];
const IDLE = { x: -24, y: 28, z: 0 };
const norm = (a: number) => ((a % 360) + 360) % 360;

export default function Die3D({ value, rolling, size = 180, onLand, label }: {
  value: number | null; rolling: boolean; size?: number; onLand?: (n: number) => void; label?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const ang = useRef({ ...IDLE });
  const raf = useRef(0);
  const landCb = useRef(onLand); landCb.current = onLand;
  const [lit, setLit] = useState<number | null>(value);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const node = el.current; if (!node) return;
    cancelAnimationFrame(raf.current);
    const apply = () => { node.style.transform = `rotateX(${ang.current.x}deg) rotateY(${ang.current.y}deg) rotateZ(${ang.current.z}deg)`; };
    const reduce = reducedMotion();

    if (rolling && !reduce) {
      setLit(null); setLanded(false);
      let last = 0;
      const v = { x: 540 + Math.random() * 240, y: 420 + Math.random() * 240, z: 260 + Math.random() * 160 };
      const step = (t: number) => {
        const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
        ang.current.x += v.x * dt; ang.current.y += v.y * dt; ang.current.z += v.z * dt; apply();
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf.current);
    }

    const face = value ? FACES.find((f) => f.n === value) ?? null : null;
    const target = face ? { x: -face.tilt, y: 0, z: -face.phi } : IDLE;
    if (reduce) { ang.current = { ...target }; apply(); setLit(value); if (face) { setLanded(true); landCb.current?.(face.n); } return; }

    const from = { ...ang.current };
    const turns = face ? 360 : 0;
    const to = { x: from.x + norm(target.x - from.x) + turns, y: from.y + norm(target.y - from.y) + turns, z: from.z + norm(target.z - from.z) };
    const dur = face ? 1150 : 600; let t0 = 0;
    const ease = (p: number) => 1 - Math.pow(1 - p, 3.2);
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur); const e = ease(p);
      ang.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z + (to.z - from.z) * e }; apply();
      if (p < 1) raf.current = requestAnimationFrame(step);
      else { ang.current = { x: norm(to.x), y: norm(to.y), z: norm(to.z) }; apply(); setLit(value); if (face) { setLanded(true); landCb.current?.(face.n); } }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [rolling, value]);

  const color = lit ? categoryForRoll(lit).color : rolling ? "#ffffff" : "#6b6575";
  const state = rolling ? "is-rolling" : lit ? "is-lit" : "is-idle";
  return (
    <div className={`d12wrap ${state}${landed ? " is-landed" : ""}`} style={{ "--s": `${size}px`, "--c": color } as React.CSSProperties} role="img" aria-label={label ?? (rolling ? "Rolling the die" : lit ? `Die showing ${lit}` : "Die, not rolled yet")}>
      <div className="d12__pool" />
      <div className="d12__spin">
        <div ref={el} className="d12">
          {FACES.map((f) => (
            <div key={f.n} className={`d12__face${lit === f.n ? " on" : ""}`} style={{ "--phi": `${f.phi}deg`, "--tilt": `${f.tilt}deg`, "--spin": `${f.spin}deg`, "--fc": categoryForRoll(f.n).color } as React.CSSProperties}>
              <div className="d12__facein"><span className="d12__n">{f.n}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="d12__glow" />
    </div>
  );
}
