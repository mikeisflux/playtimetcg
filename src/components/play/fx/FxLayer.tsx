"use client";
import { useEffect, useRef } from "react";
import { reducedMotion, type FxEvent } from "./fx";

type P = { x: number; y: number; vx: number; vy: number; life: number; ttl: number; size: number; color: string; spin: number; kind: "spark" | "shard" };
type Ring = { x: number; y: number; t0: number; color: string };

/* Full-screen canvas over the arena for bursts, rings and flashes. Draws
   only while something is alive, so it costs nothing at rest. */
export default function FxLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = canvas.current; const f = flash.current;
    if (!c || !f) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const parts: P[] = []; const rings: Ring[] = [];
    let raf = 0; let last = 0; let dpr = 1;

    const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = Math.floor(innerWidth * dpr); c.height = Math.floor(innerHeight * dpr); c.style.width = `${innerWidth}px`; c.style.height = `${innerHeight}px`; };
    size(); addEventListener("resize", size);

    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life += dt;
        if (p.life >= p.ttl) { parts.splice(i, 1); continue; }
        p.vy += 520 * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 6;
        const a = 1 - p.life / p.ttl;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 14;
        if (p.kind === "spark") { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin); ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7); ctx.restore(); }
      }
      ctx.shadowBlur = 0;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; const p = (t - r.t0) / 700;
        if (p >= 1) { rings.splice(i, 1); continue; }
        ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - p) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, 20 + p * 260, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (parts.length || rings.length) raf = requestAnimationFrame(draw); else { raf = 0; last = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(draw); };

    const burst = (e: Extract<FxEvent, { kind: "burst" }>) => {
      const x = e.x ?? innerWidth / 2, y = e.y ?? innerHeight * 0.4; const n = e.count ?? 90; const spread = e.spread ?? 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2; const sp = (220 + Math.random() * 620) * spread;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180, life: 0, ttl: 0.9 + Math.random() * 0.9, size: 2 + Math.random() * 4, color: i % 5 === 0 ? "#ffffff" : e.color, spin: Math.random() * 6, kind: Math.random() < 0.3 ? "shard" : "spark" });
      }
      rings.push({ x, y, t0: performance.now(), color: e.color }); wake();
    };
    const doFlash = (color: string, strength = 0.5) => {
      f.style.setProperty("--fc", color); f.style.setProperty("--fs", String(strength));
      f.classList.remove("is-on"); void f.offsetWidth; f.classList.add("is-on");
    };
    const on = (ev: Event) => {
      if (reducedMotion()) return;
      const d = (ev as CustomEvent<FxEvent>).detail;
      if (d.kind === "burst") burst(d);
      else if (d.kind === "ring") { rings.push({ x: d.x ?? innerWidth / 2, y: d.y ?? innerHeight * 0.4, t0: performance.now(), color: d.color }); wake(); }
      else if (d.kind === "flash") doFlash(d.color, d.strength);
      else if (d.kind === "strobe") { const times = d.times ?? 3; for (let i = 0; i < times; i++) setTimeout(() => doFlash(d.color, 0.7), i * 110); }
    };
    addEventListener("pt:fx", on);
    return () => { removeEventListener("pt:fx", on); removeEventListener("resize", size); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <canvas ref={canvas} className="fxlayer" aria-hidden />
      <div ref={flash} className="fxflash" aria-hidden />
    </>
  );
}
