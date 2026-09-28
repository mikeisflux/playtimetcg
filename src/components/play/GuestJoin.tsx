"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export default function GuestJoin({ code }: { code: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api<{ code: string }>(`/api/play/rooms/${code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      router.push(`/play/room/${r.code}`); router.refresh();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Couldn’t join."); setBusy(false); }
  }
  return (
    <form className="panel" style={{ gap: 16, maxWidth: 480 }} onSubmit={submit}>
      <div className="field"><label htmlFor="guestname">Your name</label><input id="guestname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="given-name" placeholder="What your partner calls you" /></div>
      {err && <div className="note note--err" role="alert">{err}</div>}
      <button className="btn" disabled={busy || !name.trim()}>{busy ? "Joining…" : "Join the room"}</button>
      <div className="note">By joining you confirm you’re 18 or older.</div>
    </form>
  );
}
