"use client";
import { useEffect, useRef, useState } from "react";
import { RampStrip } from "./ui";

/* 18+ gate. Shows until the first-party cookie `pt-site-age-ok` is set
   (30 days, so server-rendered pages can read it). Traps focus and locks
   scroll while open. */
export default function AgeGate({ initiallyOpen, leaveUrl }: { initiallyOpen: boolean; leaveUrl: string }) {
  const [open, setOpen] = useState(initiallyOpen);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("locked");
    const first = box.current?.querySelector<HTMLElement>("button");
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !box.current) return;
      const els = Array.from(box.current.querySelectorAll<HTMLElement>("button, a[href]"));
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => { document.body.classList.remove("locked"); window.removeEventListener("keydown", trap); };
  }, [open]);

  if (!open) return null;

  async function confirm() {
    document.cookie = `pt-site-age-ok=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    try { localStorage.setItem("pt-site-age-ok", "1"); } catch { /* ignore */ }
    fetch("/api/age", { method: "POST" }).catch(() => {});
    setOpen(false);
    /* product imagery is server-gated on the cookie — refresh the tree */
    window.dispatchEvent(new Event("pt-age-ok"));
    location.reload();
  }

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate__box" ref={box}>
        <RampStrip h={6} />
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Adults only</div>
        <div className="gate__mark" id="gate-title">Play<br />Time</div>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--text-muted)", textWrap: "pretty" }}>
          This site sells an adult card game and includes suggestive imagery and frank language about sex. You must be 18 or older to enter.
        </p>
        <div className="row">
          <button className="btn" onClick={confirm}>I’m 18 or older</button>
          <a className="btn btn--ghost" href={leaveUrl} rel="nofollow">Leave</a>
        </div>
        <div className="gate__fine">By entering you confirm you are of legal age where you live.</div>
      </div>
    </div>
  );
}
