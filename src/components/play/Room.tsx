"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameState } from "@/lib/game";
import { CATEGORY_COLORS, type Category } from "@/lib/content";
import { api } from "./api";
import RoomLobby from "./RoomLobby";
import RoomTable from "./RoomTable";
import type { ClientAction, RoomResponse } from "./types";

export type Act = (a: ClientAction) => Promise<boolean>;

const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Room({ code, user, hostId, initial, version: v0 }: {
  code: string; user: { id: string; name: string }; hostId: string; initial: GameState; version: number;
}) {
  const [state, setState] = useState<GameState>(initial);
  const [err, setErr] = useState<string | null>(null);
  const version = useRef(v0);
  const busy = useRef(false);

  /* Poll every 1.5s; skip while a POST is in flight. */
  useEffect(() => {
    const id = setInterval(async () => {
      if (busy.current || document.hidden) return;
      try {
        const r = await fetch(`/api/play/rooms/${code}?v=${version.current}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as RoomResponse | { unchanged: true };
        if ("unchanged" in d || busy.current) return;
        if (d.version > version.current) { version.current = d.version; setState(d.state); }
      } catch { /* network blip; next tick */ }
    }, 1500);
    return () => clearInterval(id);
  }, [code]);

  const act: Act = useCallback(async (a) => {
    if (busy.current) return false;
    busy.current = true; setErr(null);
    try {
      const d = await api<RoomResponse>(`/api/play/rooms/${code}`, { method: "POST", body: JSON.stringify(a) });
      version.current = d.version; setState(d.state);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn’t work.");
      return false;
    } finally { busy.current = false; }
  }, [code]);

  const me = state.players.find((p) => p.userId === user.id);
  const roller = state.players[state.rollerIndex];
  const ceiling = Math.min(...state.players.map((p) => p.ceiling));
  const catColor = state.category ? CATEGORY_COLORS[state.category as Category] ?? "#FF5C8A" : null;

  return (
    <div className="room">
      <div className="stack gap-28">
        <div className="between" style={{ alignItems: "center" }}>
          <div className="row" style={{ gap: 14 }}>
            <Link href="/play" className="label">← Play</Link>
            <span className="label">Room</span>
            <span className="mono" style={{ fontSize: 16, letterSpacing: "0.2em", color: "var(--text-strong)" }}>{code}</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="tag">{state.phase}</span>
            {state.phase !== "lobby" && state.phase !== "ended" && <span className="tag">Turn {state.turn}</span>}
            {state.players.length === 2 && <span className="tag tag--hot">Ceiling {ceiling}/5</span>}
          </div>
        </div>

        {state.specialMode === "focus" && (
          <div className="banner" style={{ "--c": CATEGORY_COLORS["Focus on You"] } as React.CSSProperties}>Focus on You — the roller receives, the partner gives.</div>
        )}
        {state.specialMode === "free" && (
          <div className="banner" style={{ "--c": CATEGORY_COLORS["Free Play"] } as React.CSSProperties}>Free Play — Dealer’s Choice, Double Draw, Reverse Roles or Create your own.</div>
        )}

        {err && <div className="note note--err" role="alert">{err}</div>}

        {state.phase === "lobby" ? (
          <RoomLobby code={code} state={state} me={me} isHost={user.id === hostId} act={act} />
        ) : (
          <RoomTable state={state} me={me} roller={roller} catColor={catColor} act={act} />
        )}
      </div>

      <aside className="stack gap-28">
        <div className="stack" style={{ gap: 0 }}>
          <div className="label" style={{ paddingBottom: 8, borderBottom: "2px solid var(--text)" }}>Players</div>
          {state.players.map((p) => (
            <div key={p.userId} className="player">
              <div className="row" style={{ gap: 10 }}>
                <span className="player__name">{p.name}{p.userId === user.id ? " (you)" : ""}</span>
                {state.phase !== "lobby" && roller?.userId === p.userId && state.phase !== "ended" && <span className="tag tag--hot">rolling</span>}
              </div>
              {state.phase === "lobby" && <span className={`tag${p.ready ? " tag--ok" : ""}`}>{p.ready ? "ready" : "not ready"}</span>}
              {state.phase !== "lobby" && <span className="label">Ceiling {p.ceiling}</span>}
            </div>
          ))}
          {state.players.length < 2 && <div className="note" style={{ paddingTop: 12 }}>Waiting for your partner…</div>}
        </div>

        <div className="piles">
          {(["played", "saved", "retired"] as const).map((k) => (
            <div key={k} className="stack" style={{ gap: 4 }}>
              <div className="num">{state.piles[k].length}</div>
              <div className="label">{k}</div>
            </div>
          ))}
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="label">Log</div>
          <div className="playlog" aria-live="polite">
            {state.log.slice(-8).map((l, i) => (
              <div key={`${l.t}-${i}`}>
                <span className="playlog__t">{fmtTime(l.t)}</span>
                {l.who !== "system" && <span className="playlog__who">{l.who} </span>}
                {l.text}
              </div>
            ))}
          </div>
        </div>

        {state.phase !== "ended" && (
          <div className="stack gap-12" style={{ alignItems: "flex-start" }}>
            <button className="btn btn--stop" onClick={() => { if (confirm("Stop the night? Stop means stop.")) void act({ type: "stop" }); }}>Stop</button>
            <div className="note">Stop means stop. Either of you can end the night at any moment, no explanation needed.</div>
          </div>
        )}
      </aside>
    </div>
  );
}
