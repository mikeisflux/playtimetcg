"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./api";
import SoloDie from "./SoloDie";
import type { RoomSummary } from "./types";

const STATUS_TAG: Record<string, string> = { waiting: "tag tag--warn", playing: "tag tag--ok", ended: "tag" };

export default function Lobby({ user, rooms: initialRooms }: { user: { id: string; name: string }; rooms: RoomSummary[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "delete" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy("create"); setErr(null);
    try {
      const r = await api<{ code: string }>("/api/play/rooms", { method: "POST" });
      router.push(`/play/room/${r.code}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t open a room."); setBusy(null); }
  }

  async function remove(c: string, status: string) {
    if (!confirm(status === "playing" ? `Delete room ${c}? The night ends for both of you.` : `Delete room ${c}?`)) return;
    setBusy("delete"); setErr(null);
    try {
      await api(`/api/play/rooms/${c}`, { method: "DELETE" });
      setRooms((rs) => rs.filter((r) => r.code !== c));
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Couldn’t delete that room."); }
    setBusy(null);
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 6) { setErr("Room codes are six characters."); return; }
    setBusy("join"); setErr(null);
    try {
      const r = await api<{ code: string }>(`/api/play/rooms/${c}/join`, { method: "POST" });
      router.push(`/play/room/${r.code}`);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Couldn’t join."); setBusy(null); }
  }

  return (
    <div className="grid g-420" style={{ gap: "clamp(32px, 4vw, 56px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <div className="panel" style={{ gap: 20 }}>
          <div className="stack gap-12">
            <div className="label">Host</div>
            <div className="t-item">Create a room</div>
            <p className="t-body-sm">You’ll get a six-letter code. Send it to your partner however you like.</p>
          </div>
          <button className="btn" onClick={create} disabled={busy !== null}>{busy === "create" ? "Opening…" : "Create a room"}</button>
        </div>

        <form className="panel" style={{ gap: 20 }} onSubmit={join}>
          <div className="stack gap-12">
            <div className="label">Guest</div>
            <div className="t-item">Join with a code</div>
          </div>
          <div className="row" style={{ alignItems: "stretch", flexWrap: "nowrap" }}>
            <input
              className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123" maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              style={{ letterSpacing: "0.3em", fontSize: 22, textTransform: "uppercase", maxWidth: 220 }} aria-label="Room code"
            />
            <button className="btn btn--outline" type="submit" disabled={busy !== null || code.length !== 6}>{busy === "join" ? "Joining…" : "Join"}</button>
          </div>
          {err && <div className="note note--err" role="alert">{err}</div>}
        </form>

        <div className="stack gap-12">
          <div className="label">Your open rooms</div>
          {rooms.length === 0 ? (
            <div className="note">No open rooms. Create one above, or join your partner’s.</div>
          ) : (
            <div className="rows rows--rule">
              {rooms.map((r) => (
                <div key={r.code} className="between" style={{ padding: "14px 0", alignItems: "center" }}>
                  <div className="row" style={{ gap: 14 }}>
                    <span className="mono" style={{ fontSize: 18, letterSpacing: "0.2em", color: "var(--text-strong)" }}>{r.code}</span>
                    <span className={STATUS_TAG[r.status] ?? "tag"}>{r.status}</span>
                    <span className="note">{r.partner ? `with ${r.partner}` : "waiting for a partner"} · {new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <Link className="btn btn--sm" href={`/play/room/${r.code}`}>Rejoin</Link>
                    {r.isHost && <button type="button" className="iconbtn" aria-label={`Delete room ${r.code}`} title="Delete room" disabled={busy !== null} onClick={() => void remove(r.code, r.status)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                    </button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="note">Signed in as {user.name}.</div>
      </div>

      <SoloDie compact />
    </div>
  );
}
