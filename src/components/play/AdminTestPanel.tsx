"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

/* Admins only: add any digital pack for free, clear a set out of the
   collection, or reset to the base deck — so the whole pack/collection
   flow can be exercised over and over without paying. */
export default function AdminTestPanel({ products, sets }: {
  products: { id: string; name: string; accent: string; setId: string | null }[];
  sets: { id: string; name: string; slug: string; owned: number; unopened: number }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  async function run(label: string, body: Record<string, string>) {
    setBusy(label); setMsg("");
    try {
      const r = await api<{ ok: boolean; granted?: number; removedCards?: number; removedPacks?: number }>("/api/play/packs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setMsg(body.action === "grant" ? "Pack added — tear it open above." : body.action === "reset" ? `Collection reset: ${r.granted ?? 0} base cards granted.` : `Removed ${r.removedCards ?? 0} cards and ${r.removedPacks ?? 0} unopened packs.`);
      window.dispatchEvent(new Event("pt:packs-changed"));
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "That didn’t work."); }
    setBusy("");
  }
  return (
    <section className="panel panel--surface" style={{ marginTop: 40, borderColor: "#FFD23F" }} aria-label="Admin testing">
      <div className="between">
        <div className="stack gap-12">
          <div className="eyebrow" style={{ color: "#FFD23F" }}>Admin testing · only you see this</div>
          <div className="t-item">Add packs free, remove sets, start over.</div>
        </div>
        <button className="btn btn--outline btn--sm" disabled={!!busy} onClick={() => { if (confirm("Wipe your whole collection and unopened packs, then re-grant the base deck?")) void run("reset", { action: "reset" }); }}>{busy === "reset" ? "Resetting…" : "Reset to base deck"}</button>
      </div>
      <div className="grid g-190" style={{ marginTop: 20 }}>
        {products.map((p) => (
          <div key={p.id} className="pack">
            <div className="pack__band" style={{ background: p.accent }} />
            <div className="pack__body">
              <div className="pack__name">{p.name}</div>
              <div className="pack__foot">
                <div className="pack__price">Free</div>
                <button className="btn btn--sm" disabled={!!busy} onClick={() => void run(p.id, { action: "grant", productId: p.id })}>{busy === p.id ? "Adding…" : "Add pack"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rows" style={{ marginTop: 20 }}>
        {sets.map((s) => (
          <div key={s.id} className="row" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
            <div className="t-body-sm"><strong>{s.name}</strong> · {s.owned} card{s.owned === 1 ? "" : "s"} owned · {s.unopened} unopened pack{s.unopened === 1 ? "" : "s"}</div>
            <button className="btn btn--ghost btn--sm" disabled={!!busy || (s.owned === 0 && s.unopened === 0)} onClick={() => void run(`rm-${s.id}`, { action: "removeSet", setId: s.id })}>{busy === `rm-${s.id}` ? "Removing…" : "Remove from collection"}</button>
          </div>
        ))}
      </div>
      {msg && <div className="note" style={{ marginTop: 12 }}>{msg}</div>}
    </section>
  );
}
