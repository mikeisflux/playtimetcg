"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* Header share button. Opens each network's share-intent URL in a centred
   popup (falls back to a new tab), pre-filled with the current page's URL
   and the site blurb, plus copy-link, email and the native share sheet
   where the browser has one. No platform SDKs, no auth: the same pattern
   as IndieCrowdfund's header share. The Open Graph / Twitter tags on every
   page (src/lib/seo.ts) supply the preview card. */
const TEXT = "Play Time — the card game for couples. Roll the die. Raise the heat.";

function openShareWindow(url: string) {
  const w = 600, h = 520;
  const left = window.screenX + (window.outerWidth - w) / 2, top = window.screenY + (window.outerHeight - h) / 2;
  const popup = window.open(url, "ShareWindow", `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
  if (!popup) window.open(url, "_blank", "noopener,noreferrer");
}

const I = {
  share: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>,
  facebook: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z" /></svg>,
  x: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  linkedin: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20.4 20.4h-3.5v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 110-4.1 2.1 2.1 0 010 4.1zM7.1 20.4H3.6V9h3.5v11.4z" /></svg>,
  reddit: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M22 12.1a2.2 2.2 0 00-3.7-1.6 10.7 10.7 0 00-5.8-1.8l1-4.7 3.2.7a1.5 1.5 0 10.2-1l-3.7-.8a.5.5 0 00-.6.4l-1.1 5.4a10.8 10.8 0 00-5.9 1.8 2.2 2.2 0 10-2.4 3.6 4.4 4.4 0 000 .6c0 3.3 3.9 6 8.7 6s8.7-2.7 8.7-6a4.4 4.4 0 000-.6 2.2 2.2 0 001.4-2zM7 13.6a1.5 1.5 0 111.5 1.5A1.5 1.5 0 017 13.6zm8.5 4.1a5.7 5.7 0 01-3.5 1.1 5.7 5.7 0 01-3.5-1.1.4.4 0 01.6-.6 4.9 4.9 0 002.9.9 4.9 4.9 0 002.9-.9.4.4 0 11.6.6zm-.2-2.6a1.5 1.5 0 111.5-1.5 1.5 1.5 0 01-1.5 1.5z" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.3a.5.5 0 000-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 12 12 0 004.6 4c1.7.7 2.4.8 3.2.7a2.7 2.7 0 001.8-1.3 2.2 2.2 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>,
  telegram: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M21.9 4.6L2.9 11.9c-1.3.5-1.3 1.2-.2 1.6l4.9 1.5 11.3-7.1c.5-.3 1-.1.6.2l-9.1 8.3-.3 5c.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.6.2 1.8-.8l3.2-15.2c.3-1.3-.5-1.9-1.5-1.6z" /></svg>,
  mail: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" /><path d="M3 7l9 6 9-6" /></svg>,
  link: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" /></svg>,
};

export default function ShareMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const [url, setUrl] = useState("https://playtimetcg.com");
  useEffect(() => { setUrl(window.location.origin + path); setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const u = encodeURIComponent(url), t = encodeURIComponent(TEXT);
  const targets = [
    { name: "Facebook", icon: I.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "X", icon: I.x, href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { name: "LinkedIn", icon: I.linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: "Reddit", icon: I.reddit, href: `https://www.reddit.com/submit?url=${u}&title=${encodeURIComponent("Play Time — the card game for couples")}` },
    { name: "WhatsApp", icon: I.whatsapp, href: `https://wa.me/?text=${encodeURIComponent(`${TEXT} ${url}`)}` },
    { name: "Telegram", icon: I.telegram, href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];

  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch {
      const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true); setTimeout(() => { setCopied(false); setOpen(false); }, 1200);
  }
  async function native() {
    try { await navigator.share({ title: "Play Time", text: TEXT, url }); setOpen(false); } catch { /* dismissed */ }
  }

  return (
    <div className={`share${compact ? " share--compact" : ""}`} ref={ref}>
      <button type="button" className="share__btn" onClick={() => (canNative && compact ? void native() : setOpen((o) => !o))} aria-haspopup="menu" aria-expanded={open} aria-label="Share Play Time" title="Share">
        {I.share}<span className="share__label">Share</span>
      </button>
      {open && (
        <div className="share__menu" role="menu" aria-label="Share Play Time">
          {canNative && <button type="button" role="menuitem" onClick={() => void native()}>{I.share}<span>Share…</span></button>}
          {targets.map((s) => (
            <a key={s.name} role="menuitem" href={s.href} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openShareWindow(s.href); setOpen(false); }}>{s.icon}<span>{s.name}</span></a>
          ))}
          <a role="menuitem" href={`mailto:?subject=${encodeURIComponent("Play Time — the card game for couples")}&body=${encodeURIComponent(`${TEXT}\n\n${url}`)}`} onClick={() => setOpen(false)}>{I.mail}<span>Email</span></a>
          <button type="button" role="menuitem" onClick={() => void copy()}>{I.link}<span>{copied ? "Copied" : "Copy link"}</span></button>
        </div>
      )}
    </div>
  );
}
