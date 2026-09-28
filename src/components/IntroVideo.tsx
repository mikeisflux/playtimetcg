"use client";
import { useEffect, useRef, useState } from "react";

/* First-visit promo video. Plays once, full screen, before anything else
   (the age gate renders underneath and takes over when this closes).
   A cookie (`pt-intro-seen`, 1 year) remembers the visit. */
export default function IntroVideo({ src, poster, initiallyOpen }: { src: string; poster?: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [muted, setMuted] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("locked");
    const v = ref.current;
    v?.play().catch(() => { /* autoplay blocked — user presses play */ });
    return () => document.body.classList.remove("locked");
  }, [open]);

  function done() {
    document.cookie = `pt-intro-seen=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="intro" role="dialog" aria-label="Play Time trailer">
      <video ref={ref} src={src} poster={poster || undefined} autoPlay muted={muted} playsInline controls={false} onEnded={done} onClick={() => { const v = ref.current; if (!v) return; if (v.paused) v.play(); else v.pause(); }} />
      <button className="btn btn--outline intro__mute" onClick={() => { setMuted((m) => !m); if (ref.current) ref.current.muted = !muted; }}>
        {muted ? "Sound on" : "Mute"}
      </button>
      <button className="btn btn--light intro__skip" onClick={done}>Skip</button>
    </div>
  );
}
