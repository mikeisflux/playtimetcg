"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameState, PlayerState } from "@/lib/game";
import { categoryForRoll } from "@/lib/content";
import { RAMP } from "@/lib/content";
import type { Act } from "./Room";
import { toCardData } from "./types";
import { BackPreview, DealerPick, DeckFan, FlipCard } from "./RoomCards";
import Die3D from "./fx/Die3D";
import { fx, buzz, centerOf } from "./fx/fx";

/* The night's end: one burst in every heat color, once, when the wrap-up mounts. */
function Finale() {
  useEffect(() => {
    RAMP.forEach((c, i) => setTimeout(() => fx({ kind: "burst", color: c, count: 60, spread: 1.2, x: window.innerWidth * (0.2 + 0.6 * (i / 6)), y: window.innerHeight * 0.35 }), i * 140));
    fx({ kind: "flash", color: "#ffffff", strength: 0.35 }); buzz([40, 60, 40, 60, 40]);
  }, []);
  return null;
}

/* Roll → (focus) → draw → read → answer → (ended). */
export default function RoomTable({ state, me, roller, catColor, act }: {
  state: GameState; me: PlayerState | undefined; roller: PlayerState | undefined; catColor: string | null; act: Act;
}) {
  const isRoller = !!me && roller?.userId === me.userId;
  const partner = state.players.find((p) => p.userId !== roller?.userId);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dieBox = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function roll() {
    if (rolling) return;
    const final = 1 + Math.floor(Math.random() * 12);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { void act({ type: "roll", n: final }); return; }
    setRolling(true); buzz([10, 30, 10, 30, 10]);
    fx({ kind: "ring", color: "#ffffff", ...centerOf(dieBox.current) });
    timer.current = setTimeout(() => { void act({ type: "roll", n: final }).finally(() => setRolling(false)); }, 900);
  }
  /* The moment the die settles — for the roller and the partner alike. */
  function landed(n: number) {
    const c = categoryForRoll(n).color;
    fx({ kind: "burst", color: c, count: 110, ...centerOf(dieBox.current) });
    fx({ kind: n === 12 ? "strobe" : "flash", color: c, strength: 0.45, times: 3 });
    buzz(n === 12 ? [30, 40, 30, 40, 60] : 40);
  }

  const current = state.current;
  const heatIndex = catColor ? RAMP.indexOf(catColor) : -1;
  const left = state.category ? state.deckCounts[state.category] ?? 0 : 0;

  if (state.phase === "ended") {
    return (
      <div className="stack gap-28">
        <Finale />
        <div className="stack gap-12">
          <div className="eyebrow glow-text" style={{ color: "var(--heat-7)" }}>Night over</div>
          <h2 className="t-h2m">That’s a wrap.</h2>
          <p className="t-body">{state.piles.played.length ? `${state.piles.played.length} card${state.piles.played.length === 1 ? "" : "s"} played.` : "Short and sweet."} No winner, no loser. The only score is whether you both want to play again.</p>
          <p className="t-body-sm">The last five minutes count: stay in the room. Water, closeness, a little talking.</p>
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
            <div className="label">Saved for another night — next time, start here instead of rolling</div>
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
      <div className="pit">
        <div ref={dieBox}><Die3D value={state.roll} rolling={rolling} size={200} onLand={landed} /></div>
        <div className="stack gap-12">
          <div className="label">Turn {state.turn} · {roller?.name ?? "—"} rolls</div>
          {state.category ? (
            <div key={`${state.turn}-${state.category}`} className="pit__cat glow-text is-live">{state.category}</div>
          ) : (
            <div className="pit__cat" style={{ color: "var(--text-dim)", textShadow: "none" }}>{rolling ? "Rolling…" : isRoller ? "Your roll." : `${roller?.name ?? "Partner"}’s roll.`}</div>
          )}
          <div className="heatbar" aria-hidden>
            {RAMP.map((c, i) => <i key={c} className={catColor === c ? "on" : state.roll && i < heatIndex ? "past" : ""} style={{ "--hc": c } as React.CSSProperties} />)}
          </div>
        </div>
      </div>

      {state.phase === "roll" && (
        <div className="stack gap-20">
          {isRoller ? (
            <div className="pit__roll"><button className="btn btn--light" onClick={roll} disabled={rolling} aria-live="polite">{rolling ? "Rolling…" : "Roll the die"}</button></div>
          ) : (
            <div className="note">Waiting for {roller?.name ?? "your partner"} to roll…</div>
          )}
          {state.passStreak >= 2 && <div className="note">Two passes in a row is information, not failure. Consider stepping down a category or lowering the ceiling next time.</div>}
          {state.piles.saved.length > 0 && (
            <div className="stack gap-12">
              <div className="label">Saved pile · bring one back instead of rolling</div>
              <div className="rows rows--rule">
                {state.piles.saved.map((c) => (
                  <div key={c.code} className="between" style={{ padding: "10px 0", alignItems: "center" }}>
                    <div style={{ fontSize: 15 }}><span className="mono dim" style={{ marginRight: 10 }}>{c.code}</span>{c.title} <span className="dim">· {c.category} · {c.spice}/5</span></div>
                    {isRoller && <button className="btn btn--sm" onClick={() => void act({ type: "playSaved", code: c.code })}>Play this</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {state.phase === "focus" && (
        <div className="stack gap-20">
          <div className="stack gap-12">
            <div className="eyebrow glow-text" style={{ color: catColor ?? undefined }}>Eleven · Focus on You</div>
            <div className="t-item">Who receives tonight?</div>
            <p className="t-body-sm">The receiver doesn’t reciprocate, doesn’t hurry and doesn’t apologize. The card ends when they say so.</p>
          </div>
          {isRoller ? (
            <div className="row">
              <button className="btn" onClick={() => void act({ type: "chooseReceiver", receiver: "roller" })}>I receive</button>
              <button className="btn btn--outline" onClick={() => void act({ type: "chooseReceiver", receiver: "partner" })}>{partner?.name ?? "My partner"} receives</button>
              <button className="btn btn--text" onClick={() => void act({ type: "reroll" })}>Roll again instead</button>
            </div>
          ) : (
            <div className="note">{roller?.name ?? "Your partner"} is deciding who receives…</div>
          )}
        </div>
      )}

      {state.phase === "draw" && state.emptyPile && (
        <div className="stack gap-20">
          <DeckFan deck={state.deck} category={state.category} />
          <div className="stack gap-12">
            <div className="t-item">No {state.category} back left in the deck.</div>
            <p className="t-body-sm">Every card with that color is played, saved or above tonight’s ceiling. Roll again, or step one category up the ramp.</p>
          </div>
          {isRoller ? (
            <div className="row">
              <button className="btn btn--light" onClick={() => void act({ type: "reroll" })}>Roll again</button>
              <button className="btn btn--outline" onClick={() => void act({ type: "stepUp" })}>Step up the ramp</button>
            </div>
          ) : <div className="note">Waiting for {roller?.name}…</div>}
        </div>
      )}

      {state.phase === "draw" && !state.emptyPile && (
        state.specialMode === "dealer" ? (
          <div className="stack gap-20">
            <DeckFan deck={state.deck} category={null} />
            {isRoller ? <DealerPick deck={state.deck} act={act} /> : <div className="note">Waiting for {roller?.name ?? "your partner"} to look through the deck and pick any card…</div>}
          </div>
        ) : (
          <div className="stack gap-20">
            <DeckFan deck={state.deck} category={state.category} onPick={isRoller ? () => void act({ type: "draw" }) : undefined} />
            <div className="grid g-380" style={{ gap: 32, alignItems: "start" }}>
              {state.category && <BackPreview category={state.category} onFlip={isRoller ? () => void act({ type: "draw" }) : undefined} />}
              {isRoller ? (
                <div className="stack gap-12">
                  <div className="eyebrow glow-text" style={{ color: catColor ?? undefined }}>Your card</div>
                  <div className="t-item">Tap the card to turn it over.</div>
                  <p className="t-body-sm">{left} {state.category} card{left === 1 ? "" : "s"} left in the deck. The first one from the top is yours.</p>
                  <div className="row">
                    <button className="btn" onClick={() => void act({ type: "draw" })}>Turn it over</button>
                    <button className="btn btn--text" onClick={() => void act({ type: "reroll" })}>Roll again</button>
                  </div>
                </div>
              ) : (
                <div className="note">Waiting for {roller?.name ?? "your partner"} to turn the card over…</div>
              )}
            </div>
          </div>
        )
      )}

      {(state.phase === "read" || state.phase === "answer") && current && (
        <div className="grid g-380" style={{ gap: 32, alignItems: "start" }}>
          <FlipCard key={current.code} card={toCardData(current)} category={String(current.category)} />
          {state.phase === "read" ? (
            <div className="stack gap-20">
              <div className="stack gap-12">
                <div className="eyebrow glow-text" style={{ color: catColor ?? undefined }}>Read it out loud</div>
                <div className="t-item">Every word, exactly as written.</div>
                <p className="t-body-sm">Saying it is half of it. Unless the card says otherwise, “you” means the roller and “your partner” means the other one. The time on the card is a floor, not a ceiling.</p>
              </div>
              <div><button className="btn btn--light" onClick={() => void act({ type: "read" })}>We’ve read it</button></div>
            </div>
          ) : (
            <div className="stack gap-20">
              <div className="stack gap-12">
                <div className="eyebrow glow-text" style={{ color: catColor ?? undefined }}>The four answers</div>
                <div className="t-item">Do it, tweak it, save it, or pass.</div>
                <p className="t-body-sm">Either of you can pass, any card, no reason. Save it or pass and {roller?.name ?? "the roller"} rolls again; do it or tweak it and the die passes to {partner?.name ?? "your partner"}.</p>
              </div>
              <div className="answers">
                <button className="btn" onClick={(e) => { fx({ kind: "burst", color: "#FFD23F", count: 120, ...centerOf(e.currentTarget) }); fx({ kind: "flash", color: "#FFD23F", strength: 0.4 }); buzz([20, 30, 40]); void act({ type: "answer", answer: "do" }); }}>Do it</button>
                <button className="btn btn--light" onClick={(e) => { fx({ kind: "burst", color: "#A68CF5", count: 70, ...centerOf(e.currentTarget) }); void act({ type: "answer", answer: "tweak" }); }}>Tweak it</button>
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
