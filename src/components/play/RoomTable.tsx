"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameState, PlayerState } from "@/lib/game";
import { categoryForRoll } from "@/lib/content";
import { DieFace, GameCard } from "@/components/ui";
import type { Act } from "./Room";
import { GREY, toCardData, type CollectionItem } from "./types";

/* Roll → (focus) → draw → read → answer → (ended). */
export default function RoomTable({ state, me, roller, catColor, act }: {
  state: GameState; me: PlayerState | undefined; roller: PlayerState | undefined; catColor: string | null; act: Act;
}) {
  const isRoller = !!me && roller?.userId === me.userId;
  const partner = state.players.find((p) => p.userId !== roller?.userId);
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
  const left = state.category ? state.deckCounts[state.category] ?? 0 : 0;

  if (state.phase === "ended") {
    return (
      <div className="stack gap-28">
        <div className="stack gap-12">
          <div className="eyebrow">Night over</div>
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
            <div className="eyebrow" style={{ color: catColor ?? undefined }}>Eleven · Focus on You</div>
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
          <div className="stack gap-12">
            <div className="t-item">The {state.category} pile is empty.</div>
            <p className="t-body-sm">Nothing left in that category under tonight’s ceiling. Roll again, or step one category up the ramp.</p>
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
        state.hand.length === 2 ? (
          <div className="stack gap-20">
            <div className="label">{isRoller ? "Two cards. Keep one — the other slides back into its pile." : `${roller?.name} is choosing…`}</div>
            <div className="hand">
              {state.hand.map((c) => (
                <div key={c.code} className="hand__pick">
                  <GameCard card={toCardData(c)} />
                  {isRoller && <button className="btn btn--outline" onClick={() => void act({ type: "keep", code: c.code })}>Keep this one</button>}
                </div>
              ))}
            </div>
          </div>
        ) : state.specialMode === "dealer" ? (
          isRoller ? <DealerPick ceiling={Math.min(...state.players.map((p) => p.ceiling))} drawn={state.drawn} act={act} /> : <div className="note">Waiting for {roller?.name ?? "your partner"} to pick any card…</div>
        ) : isRoller ? (
          <div className="stack gap-12">
            <div className="row">
              <button className="btn" onClick={() => void act({ type: "draw", count: 1 })}>Draw one</button>
              <button className="btn btn--outline" onClick={() => void act({ type: "draw", count: 2 })} disabled={left < 2}>Draw two, keep one</button>
              <button className="btn btn--text" onClick={() => void act({ type: "reroll" })}>Roll again</button>
            </div>
            <div className="note">{left ? `${left} ${state.category} card${left === 1 ? "" : "s"} left under the ceiling.` : "Drawing from your collection, under tonight’s ceiling."}</div>
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
                <p className="t-body-sm">Saying it is half of it. Unless the card says otherwise, “you” means the roller and “your partner” means the other one. The time on the card is a floor, not a ceiling.</p>
              </div>
              <div><button className="btn btn--light" onClick={() => void act({ type: "read" })}>We’ve read it</button></div>
            </div>
          ) : (
            <div className="stack gap-20">
              <div className="stack gap-12">
                <div className="eyebrow" style={{ color: catColor ?? undefined }}>The four answers</div>
                <div className="t-item">Do it, tweak it, save it, or pass.</div>
                <p className="t-body-sm">Either of you can pass, any card, no reason. Save it or pass and {roller?.name ?? "the roller"} rolls again; do it or tweak it and the die passes to {partner?.name ?? "your partner"}.</p>
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

/* Dealer's Choice: the roller picks any card from any pile under the ceiling. */
function DealerPick({ ceiling, drawn, act }: { ceiling: number; drawn: string[]; act: Act }) {
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    fetch("/api/play/collection").then((r) => r.json()).then((d: CollectionItem[] | { error: string }) => { if (Array.isArray(d)) setItems(d); }).catch(() => setItems([]));
  }, []);
  const out = new Set(drawn);
  const options = (items ?? []).filter((c) => c.spice <= ceiling && !out.has(c.code)).sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code));
  return (
    <div className="stack gap-12">
      <div className="label">Dealer’s Choice · pick any card from any pile</div>
      <div className="row">
        <select className="input" style={{ maxWidth: 420 }} value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">{items ? "Choose a card…" : "Loading your collection…"}</option>
          {options.map((c) => <option key={c.code} value={c.code}>{c.category} · {c.title} · {c.spice}/5</option>)}
        </select>
        <button className="btn" disabled={!code} onClick={() => void act({ type: "pickAny", code })}>Play it</button>
        <button className="btn btn--text" onClick={() => void act({ type: "reroll" })}>Roll again</button>
      </div>
      <div className="note">Your ceiling still applies. Dealer’s Choice can’t pick a card you left in the box.</div>
    </div>
  );
}
