/* Small shared visual primitives (server-safe). */
import { RAMP, CATEGORY_COLORS, rarityFrame, type CardData } from "@/lib/content";

export function RampStrip({ h = 4 }: { h?: number }) {
  return (
    <div className="ramp" style={{ height: h }} aria-hidden>
      {RAMP.map((c) => <span key={c} style={{ background: c }} />)}
    </div>
  );
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div className="eyebrow" style={color ? { color } : undefined}>{children}</div>;
}

export function SpiceMeter({ n, color, tall }: { n: number; color: string; tall?: boolean }) {
  return (
    <div className={`meter${tall ? " meter--10" : ""}`} style={{ "--c": color } as React.CSSProperties} aria-label={`Spice ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}
    </div>
  );
}

export function GameCard({ card, setName = "Base", small, imageUrl, className = "", isNew }: { card: CardData; setName?: string; small?: boolean; imageUrl?: string | null; className?: string; isNew?: boolean }) {
  const color = CATEGORY_COLORS[card.category] ?? "#FF5C8A";
  return (
    <div
      className={`card${small ? " card--sm" : ""}${card.rarity === "Rare" ? " rare-glow" : ""} ${className}`}
      style={{ "--frame": rarityFrame(card.rarity), "--c": color, position: "relative" } as React.CSSProperties}
    >
      {isNew && <span className="newpill">New</span>}
      {card.art ? (
        <div className="card__in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.art} alt={`${card.title} — ${card.category}, spice ${card.spice} of 5`} width={635} height={889} loading="lazy" decoding="async" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      ) : (
      <div className="card__in">
        <div className="card__img" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>
          <div className="card__meta"><span>{setName}</span><span>{card.code}</span></div>
        </div>
        <div className="card__bar" />
        <div className="card__body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div className="card__cat">{card.category}</div>
            <div className="card__rar">{card.rarity}</div>
          </div>
          <div className="card__title">{card.title}</div>
          <div className="card__text">{card.text}</div>
          <SpiceMeter n={card.spice} color={color} />
          <div className="card__foot"><span>Spice {card.spice}/5</span><span>{card.time}</span></div>
        </div>
      </div>
      )}
    </div>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div className={`card card--back${small ? " card--sm" : ""}`} style={{ "--frame": "rgba(255,255,255,0.28)" } as React.CSSProperties}>
      <div className="card__in"><div className="wordmark" style={{ fontSize: small ? 14 : 20 }}>Play Time</div></div>
    </div>
  );
}

export function DieFace({ n, color, large }: { n: number; color: string; large?: boolean }) {
  return (
    <div className={`die${large ? " die--lg" : ""}`} style={{ "--c": color } as React.CSSProperties} aria-label={`Die showing ${n}`}>
      <div className="die__n">{n}</div>
    </div>
  );
}

export function RarityFrame({ frame, w = 64, h = 88 }: { frame: string; w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h, padding: 3, background: frame, flex: "none" }}>
      <div style={{ width: "100%", height: "100%", background: "var(--ink)" }} />
    </div>
  );
}

/* Fixed-ratio image well. `priority` marks the one above-the-fold image
   (eager + high fetch priority); everything else lazy-loads. The placeholder
   is decorative, so it is hidden from assistive tech and crawlers see no
   empty-alt image. */
export function ImageSlot({ src, alt, hint, aspect = "4 / 3", priority }: { src?: string | null; alt: string; hint: string; aspect?: string; priority?: boolean }) {
  return (
    <div style={{ position: "relative", aspectRatio: aspect, background: "var(--surface-2)", overflow: "hidden" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div className="slot" aria-hidden>{hint}</div>
      )}
    </div>
  );
}

/* Server-rendered JSON-LD. Accepts one graph or several; `<` is escaped so
   content can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] | string | null | undefined }) {
  if (!data) return null;
  const json = typeof data === "string" ? data : JSON.stringify(data);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json.replace(/</g, "\\u003c") }} />;
}

export function Includes({ items }: { items: string[] }) {
  return (
    <div className="stack" style={{ borderTop: "1px solid var(--rule)" }}>
      {items.map((it) => <div key={it} className="include"><span>{it}</span></div>)}
    </div>
  );
}
