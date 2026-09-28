"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameState, PlayerState } from "@/lib/game";
import { categoryForRoll } from "@/lib/content";
import { DieFace, GameCard } from "@/components/ui";
import type { Act } from "./Room";
import { GREY, toCardData } from "./types";

/* Roll → draw → read → answer → (ended). */
export default function RoomTable({ state, me, roller, catColor, act }: {
  state: GameState; me: PlayerState | undefined; roller: PlayerState | undefined; catColor: string | null; act: Act;
}) {
  const isRoller = !!me && roller?.userId === me.userId;
  const [tick, setTick] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function roll() {
    if (rolling) return;
    const final = 1 + Math.floor(Math.random() * 12);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { void act({ type: "roll", n: final }); return; }
    setRolling(true);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      if (ticks >= 11) {
        if (timer.current) clearInterval(timer.current);
        setTick(final);
        void act({ type: "roll", n: final }).finally(() => { setRolling(false); setTick(null); });
      } else {
        setTick(1 + Math.floor(Math.random() * 12));
      }
    }, 70);
  }

  const shown = tick ?? state.roll;
  const dieColor = shown ? categoryForRoll(shown).color : GREY;
  const current = state.current;

  if (state.phase === "ended") {
    return (
      <div className="stack gap-28">
        <div className="stack gap-12">
          <div className="eyebrow">Night over</div>
          <h2 className="t-h2m">That’s a wrap.</h2>
          <p className="t-body">{state.turn > 1 ? `${state.turn - 1} card${state.turn === 2 ? "" : "s"} on the table.` : "Short and sweet."} Whatever you did or didn’t do — you both said yes to it.</p>
        </div>
        <div className="piles" style={{ maxWidth: 420 }}>
          {(["played", "saved", "retired"] as const).map((k) => (
            <div key={k} className="stack" style={{ gap: 4 }}>
              <div className="num">{state.piles[k].length}</div>
              <div className="label">{k}</div>
            </div>
          ))}
        </div>
        {state.piles.saved.length > 0 && (
          <div className="stack gap-12">
            <div className="label">Saved for another night</div>
            <div className="rows rows--rule">
              {state.piles.saved.map((c) => <div key={c.code} style={{ padding: "10px 0", fontSize: 15 }}><span className="mono dim" style={{ marginRight: 10 }}>{c.code}</span>{c.title}</div>)}
            </div>
          </div>
        )}
        <div><Link className="btn" href="/play">Back to lobby</Link></div>
      </div>
    );
  }

  return (
    <div className="stack gap-28">
      {/* Die + category header, always shown during play */}
      <div className="row" style={{ gap: 28, alignItems: "center" }}>
        {shown ? <DieFace n={shown} color={dieColor} large /> : (
          <div className="die die--lg" style={{ "--c": GREY } as React.CSSProperties} aria-label="Die not rolled"><div className="die__n">?</div></div>
        )}
        <div className="stack gap-12">
          <div className="label">Turn {state.turn} · {roller?.name ?? "—"} rolls</div>
          {state.category ? (
            <div className="t-h2m" style={{ color: catColor ?? undefined }}>{state.category}</div>
          ) : (
            <div className="t-h2m" style={{ color: "var(--text-dim)" }}>{isRoller ? "Your roll." : `${roller?.name ?? "Partner"}’s roll.`}</div>
          )}
        </div>
      </div>

      {state.phase === "roll" && (
        <div className="stack gap-20">
          {isRoller ? (
            <div><button className="btn btn--light" onClick={roll} disabled={rolling} aria-live="polite">{rolling ? "Rolling…" : "Roll the die"}</button></div>
          ) : (
            <div className="note">Waiting for {roller?.name ?? "your partner"} to roll…</div>
          )}
          {state.piles.saved.length > 0 && (
            <div className="stack gap-12">
              <div className="label">Saved pile · bring one back instead of rolling</div>
              <div className="rows rows--rule">
                {state.piles.saved.map((c) => (
                  <div key={c.code} className="between" style={{ padding: "10px 0", alignItems: "center" }}>
                    <div style={{ fontSize: 15 }}><span className="mono dim" style={{ marginRight: 10 }}>{c.code}</span>{c.title} <span className="dim">· {c.category} · {c.spice}/5</span></div>
                    <button className="btn btn--sm" onClick={() => void act({ type: "playSaved", code: c.code })}>Play this</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {state.phase === "draw" && (
        state.hand.length === 2 ? (
          <div className="stack gap-20">
            <div className="label">{isRoller ? "Two cards. Keep one — the other retires." : `${roller?.name} is choosing…`}</div>
            <div className="hand">
              {state.hand.map((c) => (
                <div key={c.code} className="hand__pick">
                  <GameCard card={toCardData(c)} />
                  {isRoller && <button className="btn btn--outline" onClick={() => void act({ type: "keep", code: c.code })}>Keep this one</button>}
                </div>
              ))}
            </div>
          </div>
        ) : isRoller ? (
          <div className="stack gap-12">
            <div className="row">
              <button className="btn" onClick={() => void act({ type: "draw", count: 1 })}>Draw one</button>
              <button className="btn btn--outline" onClick={() => void act({ type: "draw", count: 2 })}>Draw two, keep one</button>
            </div>
            <div className="note">{state.deckCounts[state.category ?? ""] ? `${state.deckCounts[state.category ?? ""]} ${state.category} cards left under the ceiling.` : "Drawing from your collection, under tonight’s ceiling."}</div>
          </div>
        ) : (
          <div className="note">Waiting for {roller?.name ?? "your partner"} to draw…</div>
        )
      )}

      {(state.phase === "read" || state.phase === "answer") && current && (
        <div className="grid g-380" style={{ gap: 32, alignItems: "start" }}>
          <GameCard card={toCardData(current)} />
          {state.phase === "read" ? (
            <div className="stack gap-20">
              <div className="stack gap-12">
                <div className="eyebrow" style={{ color: catColor ?? undefined }}>Read it out loud</div>
                <div className="t-item">Every word, exactly as written.</div>
                <p className="t-body-sm">Saying it is half of it. Either of you can read; both of you listen.</p>
              </div>
              <div><button className="btn btn--light" onClick={() => void act({ type: "read" })}>We’ve read it</button></div>
            </div>
          ) : (
            <div className="stack gap-20">
              <div className="stack gap-12">
                <div className="eyebrow" style={{ color: catColor ?? undefined }}>Your call</div>
                <div className="t-item">Do it, tweak it, save it, or pass.</div>
                <p className="t-body-sm">Either of you can pass on any card. Passes are unlimited and nobody keeps score.</p>
              </div>
              <div className="answers">
                <button className="btn" onClick={() => void act({ type: "answer", answer: "do" })}>Do it</button>
                <button className="btn btn--light" onClick={() => void act({ type: "answer", answer: "tweak" })}>Tweak it</button>
                <button className="btn btn--outline" onClick={() => void act({ type: "answer", answer: "save" })}>Save it</button>
                <button className="btn btn--ghost" onClick={() => void act({ type: "answer", answer: "pass" })}>Pass</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
