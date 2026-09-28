"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, PlayerState } from "@/lib/game";
import { CATEGORIES, CATEGORY_COLORS, HEAT_LEVELS } from "@/lib/content";
import { SpiceMeter } from "@/components/ui";
import { api } from "./api";
import type { Act } from "./Room";
import type { CollectionItem } from "./types";

export default function RoomLobby({ code, state, me, isHost, act }: {
  code: string; state: GameState; me: PlayerState | undefined; isHost: boolean; act: Act;
}) {
  const [copied, setCopied] = useState(false);
  const [collection, setCollection] = useState<CollectionItem[] | null>(null);
  const [vetoes, setVetoes] = useState<string[]>(me?.vetoes ?? []);
  const [showVetoes, setShowVetoes] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showVetoes || collection) return;
    api<CollectionItem[]>("/api/play/collection").then(setCollection).catch(() => setCollection([]));
  }, [showVetoes, collection]);

  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);

  function toggleVeto(c: string) {
    const next = vetoes.includes(c) ? vetoes.filter((x) => x !== c) : [...vetoes, c];
    setVetoes(next);
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { void act({ type: "setVetoes", vetoes: next }); }, 450);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* clipboard blocked */ }
  }

  const grouped = useMemo(() => {
    const out: Record<string, CollectionItem[]> = {};
    for (const c of collection ?? []) (out[c.category] ??= []).push(c);
    return out;
  }, [collection]);

  const bothReady = state.players.length === 2 && state.players.every((p) => p.ready);

  return (
    <div className="stack gap-28">
      <div className="stack gap-12">
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Share this code with your partner</div>
        <div className="row" style={{ gap: 20 }}>
          <div className="roomcode t-h2">{code}</div>
          <button className="btn btn--sm" onClick={copy}>{copied ? "Copied" : "Copy code"}</button>
        </div>
        <p className="t-body-sm">They go to <span className="mono">/play</span>, choose “Join with a code”, and type it in. Set your ceiling and vetoes while you wait.</p>
      </div>

      {me && (
        <div className="stack gap-12">
          <div className="label">Your ceiling · the night runs at the lower of the two</div>
          <div className="ceiling" role="radiogroup" aria-label="Heat ceiling">
            {HEAT_LEVELS.map((h) => (
              <button
                key={h.level} type="button" role="radio" aria-checked={me.ceiling === h.level}
                className={`ceiling__row${me.ceiling === h.level ? " on" : ""}`}
                onClick={() => void act({ type: "setCeiling", ceiling: h.level })}
              >
                <SpiceMeter n={h.level} color={h.color} tall />
                <span className="ceiling__name">{h.name}</span>
                <span className="ceiling__body">{h.body}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {me && (
        <div className="stack gap-12">
          <div className="between" style={{ alignItems: "center" }}>
            <div className="label">Vetoes · {vetoes.length ? `${vetoes.length} card${vetoes.length === 1 ? "" : "s"} out tonight` : "nothing excluded"}</div>
            <button className="btn btn--text" onClick={() => setShowVetoes((v) => !v)}>{showVetoes ? "Hide list" : "Choose cards to skip"}</button>
          </div>
          <p className="t-body-sm">Anything you tick stays out of the deck for this room. Your partner can’t see your list — only that it exists.</p>
          {showVetoes && (
            collection === null ? <div className="note">Loading your collection…</div>
            : collection.length === 0 ? <div className="note">Your collection is empty. The base deck lands the moment you subscribe.</div>
            : (
              <div className="veto">
                {CATEGORIES.filter((cat) => grouped[cat]?.length).map((cat) => (
                  <div key={cat}>
                    <div className="veto__cat" style={{ "--c": CATEGORY_COLORS[cat] } as React.CSSProperties}>{cat}</div>
                    <div className="veto__grid">
                      {grouped[cat].map((c) => (
                        <label key={c.code} className={`veto__item${vetoes.includes(c.code) ? " off" : ""}`}>
                          <input type="checkbox" checked={vetoes.includes(c.code)} onChange={() => toggleVeto(c.code)} />
                          <span className="veto__code">{c.code}</span>
                          <span className="min0" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                          <span className="veto__code">{c.spice}/5</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      <div className="row" style={{ gap: 14 }}>
        {me && (
          <button className={`btn ${me.ready ? "btn--outline" : "btn--light"}`} onClick={() => void act({ type: "ready", ready: !me.ready })}>
            {me.ready ? "Not ready yet" : "I’m ready"}
          </button>
        )}
        {isHost && (
          <button className="btn" disabled={!bothReady} onClick={() => void act({ type: "start" })} title={bothReady ? undefined : "Both players must be in the room and ready."}>
            Start the night
          </button>
        )}
        {!isHost && <div className="note">{bothReady ? "Waiting for the host to start." : "The host starts the night once you’re both ready."}</div>}
      </div>
    </div>
  );
}
