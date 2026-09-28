"use client";
import { useState } from "react";
import { api, Field, Input, Select, Textarea } from "./shared";
import type { CardSet } from "./CardSets";

type Toast = { ok: (t: string) => void; err: (e: unknown) => void };

export default function CardsTools({ sets, reload, toast }: { sets: CardSet[]; reload: () => void; toast: Toast }) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [grant, setGrant] = useState({ email: "", mode: "card", code: "", setId: "" });
  const [granted, setGranted] = useState("");

  async function importCsv(file?: File) {
    setBusy(true); setResult(null);
    try {
      let r: { created: number; updated: number; errors: string[] };
      if (file) { const fd = new FormData(); fd.append("file", file); const res = await fetch("/api/admin/cards/import", { method: "POST", body: fd }); r = await res.json(); if (!res.ok) throw new Error((r as unknown as { error: string }).error); }
      else r = await api("/api/admin/cards/import", { method: "POST", json: { csv } });
      setResult(r); toast.ok(`Imported: ${r.created} new, ${r.updated} updated`); reload();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }
  async function doGrant(e: React.FormEvent) {
    e.preventDefault(); setGranted("");
    try {
      const body = grant.mode === "starter" ? { email: grant.email, starter: true } : grant.mode === "set" ? { email: grant.email, setId: grant.setId } : { email: grant.email, code: grant.code };
      const r = await api<{ granted: number; user: { email: string } }>("/api/admin/cards/grant", { method: "POST", json: body });
      setGranted(`Granted ${r.granted} card(s) to ${r.user.email}.`); toast.ok("Granted");
    } catch (err) { toast.err(err); }
  }

  return (
    <div className="admSplit">
      <div className="admCard">
        <div className="admCard__hd"><h2 className="admH2">CSV import</h2></div>
        <p className="admMuted">Columns: <code className="admMono">code,set,title,category,rarity,spice,time,text</code> (optional <code className="admMono">imageUrl,active</code>). Upserts by code; unknown set slugs are created.</p>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"code,set,title,category,rarity,spice,time,text\nB003,base,Feather Tease,Soft Touch,Common,1,5 min,\"Use a soft feather…\""} className="admInput--mono" style={{ minHeight: 160 }} />
        <div className="admRow">
          <button className="admBtn admBtn--primary" disabled={busy || !csv.trim()} onClick={() => importCsv()}>{busy ? "Importing…" : "Import pasted CSV"}</button>
          <label className="admBtn">Upload .csv<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} /></label>
        </div>
        {result && (
          <div className={`admNote ${result.errors.length ? "" : "admNote--ok"}`}>
            Created {result.created}, updated {result.updated}.{result.errors.length > 0 && <> {result.errors.length} row error(s):<pre className="admPre" style={{ marginTop: 6 }}>{result.errors.join("\n")}</pre></>}
          </div>
        )}
      </div>
      <div className="admCard">
        <div className="admCard__hd"><h2 className="admH2">Grant to user</h2></div>
        <form className="admForm" onSubmit={doGrant}>
          <Field label="User email" className="span2"><Input type="email" required value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} /></Field>
          <Field label="What"><Select value={grant.mode} onChange={(e) => setGrant({ ...grant, mode: e.target.value })} options={[{ value: "card", label: "A single card (by code)" }, { value: "set", label: "Every active card in a set" }, { value: "starter", label: "Starter deck (STARTER_SET_SLUG)" }]} /></Field>
          {grant.mode === "card" && <Field label="Card code"><Input required value={grant.code} onChange={(e) => setGrant({ ...grant, code: e.target.value.toUpperCase() })} className="admInput--mono" /></Field>}
          {grant.mode === "set" && <Field label="Set"><Select required value={grant.setId} onChange={(e) => setGrant({ ...grant, setId: e.target.value })} options={[{ value: "", label: "—" }, ...sets.map((s) => ({ value: s.id, label: s.name }))]} /></Field>}
          <div className="span2 admRow"><button className="admBtn admBtn--primary">Grant</button>{granted && <span className="admMuted">{granted}</span>}</div>
        </form>
      </div>
    </div>
  );
}
