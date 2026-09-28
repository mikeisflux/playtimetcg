"use client";
import { useRef, useState } from "react";

/* The promo video in the Home hero. Autoplays muted and loops (browsers
   allow that without a click); one tap turns the sound on. */
export default function HeroVideo({ src, poster, autoplay = true }: { src: string; poster?: string; autoplay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(autoplay);

  function toggleSound() {
    const v = ref.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
  }

  return (
    <div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--surface-2)", overflow: "hidden" }}>
      <video
        ref={ref}
        src={src}
        poster={poster || undefined}
        autoPlay={autoplay}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={() => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }}
        aria-label="Play Time promo video"
      />
      <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 10 }}>
        <button className="btn btn--light" style={{ padding: "10px 14px", fontSize: 12 }} onClick={toggleSound}>
          {muted ? "Sound on" : "Mute"}
        </button>
        {!playing && (
          <button className="btn" style={{ padding: "10px 14px", fontSize: 12 }} onClick={() => { ref.current?.play().catch(() => {}); }}>Play</button>
        )}
      </div>
    </div>
  );
}
