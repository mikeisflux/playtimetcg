"use client";
import { useEffect, useRef, useState } from "react";
import type { OpenedCard } from "@/lib/packs";
import { GameCard } from "@/components/ui";
import { api } from "./api";
import { toCardData, type PackItem } from "./types";
import HoloCard from "./fx/HoloCard";
import { fx, buzz, centerOf } from "./fx/fx";
import { CATEGORY_COLORS, type Category } from "@/lib/content";

type Opened = { set: { name: string; slug: string; accent: string }; cards: OpenedCard[] };
type Stage = { kind: "list" } | { kind: "pack"; pack: PackItem; torn: boolean } | { kind: "reveal"; result: Opened };

export default function PackOpener({ initial }: { initial: PackItem[] }) {
  const [packs, setPacks] = useState(initial);
  const [stage, setStage] = useState<Stage>({ kind: "list" });
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  /* the admin testing panel grants/removes packs: reload the list when it says so */
  useEffect(() => {
    const on = () => { void refresh(); setStage({ kind: "list" }); };
    window.addEventListener("pt:packs-changed", on);
    return () => window.removeEventListener("pt:packs-changed", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try { const r = await api<{ packs: PackItem[] }>("/api/play/packs"); setPacks(r.packs); } catch { /* keep what we have */ }
  }

  function tear(pack: PackItem) {
    if (stage.kind !== "pack" || stage.torn) return;
    setStage({ kind: "pack", pack, torn: true });
    setErr(null);
    fx({ kind: "flash", color: pack.accent, strength: 0.5 }); buzz([20, 40, 20]);
    timer.current = setTimeout(async () => {
      try {
        const result = await api<Opened>("/api/play/packs", { method: "POST", body: JSON.stringify({ packId: pack.id }) });
        setStage({ kind: "reveal", result });
        fx({ kind: "burst", color: pack.accent, count: 160, spread: 1.3 });
        fx({ kind: "strobe", color: pack.accent, times: 2 });
        if (result.cards.some((c) => c.rarity === "Rare")) setTimeout(() => { fx({ kind: "burst", color: "#FFD23F", count: 120 }); fx({ kind: "flash", color: "#FFD23F", strength: 0.5 }); buzz([30, 50, 30, 50, 80]); }, result.cards.length * 260 + 400);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn’t open that pack.");
        setStage({ kind: "list" });
      }
      void refresh();
    }, 900);
  }

  if (stage.kind === "pack") {
    const { pack, torn } = stage;
    return (
      <div className="stack gap-28" style={{ alignItems: "center" }}>
        <div className="pack3d__hint" aria-live="polite">{torn ? "Tearing…" : "Tap the pack to tear it open"}</div>
        <div className={`pack3d${torn ? " torn" : " pack3d--ready"}`} style={{ "--pc": pack.accent } as React.CSSProperties} role="button" tabIndex={0} aria-label={`Open a ${pack.setName} pack`}
          onClick={() => tear(pack)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tear(pack); } }}>
          <div className="pack3d__wrap">
            <div className="pack3d__band" style={{ background: pack.accent }} />
            <div className="pack3d__label">
              <div className="wordmark" style={{ fontSize: 14 }}>Play Time</div>
              <div className="t-item" style={{ color: pack.accent }}>{pack.setName}</div>
              <div className="mono label">{pack.size} cards</div>
            </div>
          </div>
          <div className="pack3d__tear" />
        </div>
        {!torn && <button className="btn btn--text" onClick={() => setStage({ kind: "list" })}>Not now</button>}
      </div>
    );
  }

  if (stage.kind === "reveal") {
    const { result } = stage;
    const newCount = result.cards.filter((c) => c.isNew).length;
    return (
      <div className="stack gap-28">
        <div className="stack gap-12">
          <div className="eyebrow" style={{ color: result.set.accent }}>{result.set.name}</div>
          <div className="t-item">{newCount ? `${newCount} new card${newCount === 1 ? "" : "s"} for your collection.` : "All duplicates this time — they stack."}</div>
        </div>
        <div className="reveal">
          {result.cards.map((c, i) => (
            <div key={`${c.code}-${i}`} style={{ "--i": i } as React.CSSProperties}>
              <HoloCard small color={CATEGORY_COLORS[c.category as Category]} foil={c.rarity === "Rare"} halo={c.rarity !== "Common"}>
                <GameCard card={toCardData(c)} setName={result.set.name} isNew={c.isNew} small />
              </HoloCard>
            </div>
          ))}
        </div>
        <div className="row">
          {packs.length > 0 && <button className="btn" onClick={() => setStage({ kind: "pack", pack: packs[0], torn: false })}>Open another</button>}
          <button className="btn btn--outline" onClick={() => setStage({ kind: "list" })}>Back to packs</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-20">
      {err && <div className="note note--err" role="alert">{err}</div>}
      {packs.length === 0 ? (
        <div className="empty" style={{ paddingTop: 0 }}>
          <div className="t-item">No unopened packs.</div>
          <p className="t-body">Pick one up below — it lands here the moment your order is paid.</p>
        </div>
      ) : (
        <div className="rows rows--rule">
          {packs.map((p) => (
            <div key={p.id} className="packrow">
              <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}>
                <div className="packrow__band" style={{ background: p.accent, minHeight: 40 }} />
                <div className="stack" style={{ gap: 4 }}>
                  <div className="t-item-md">{p.setName}</div>
                  <div className="label">{p.size} cards · {p.qty} unopened{p.productName ? ` · ${p.productName}` : ""}</div>
                </div>
              </div>
              <button className="btn btn--light" onClick={() => { setErr(null); setStage({ kind: "pack", pack: p, torn: false }); }}>Tear it open</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
