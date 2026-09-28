"use client";
import { useState } from "react";
import { useJson, api, useToast, Input, Textarea, Badge } from "./shared";

interface Known { key: string; label: string; group: string; hint?: string; secret?: boolean; readonly?: boolean; value: string; set: boolean; source: string }

/* The "SEO & analytics" settings group, edited in place. */
export default function SeoGlobal() {
  const data = useJson<{ groups: { name: string; keys: Known[] }[] }>("/api/admin/settings");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const toast = useToast();
  const keys = data.data?.groups.find((g) => g.name === "SEO & analytics")?.keys ?? [];

  async function save(key: string) {
    if (edits[key] === undefined) return;
    try { await api("/api/admin/settings", { method: "PUT", json: { key, value: edits[key] } }); toast.ok(`${key} saved`); setEdits((e) => { const n = { ...e }; delete n[key]; return n; }); data.reload(); }
    catch (e) { toast.err(e); }
  }

  return (
    <div className="admCard">
      {toast.node}
      <div className="admCard__hd"><h2 className="admH2">Global defaults, analytics &amp; verification</h2></div>
      <p className="admHint">Site-wide title template and description, Open Graph image, Google Analytics, Meta pixel, Search Console and Bing verification. Analytics only load after the visitor passes the age gate.</p>
      {keys.map((k) => {
        const editing = edits[k.key] !== undefined;
        const long = /DESCRIPTION|JSONLD|KEYWORDS/.test(k.key);
        return (
          <div key={k.key} className="admField" style={{ borderBottom: "1px solid var(--rule)", padding: "12px 0" }}>
            <label>{k.label} <span className="admMono admMuted" style={{ marginLeft: 8 }}>{k.key}</span> {k.set ? <Badge kind="ok">set</Badge> : <Badge kind="dim">not set</Badge>}</label>
            <div className="admRow" style={{ alignItems: "flex-start" }}>
              {long
                ? <Textarea value={editing ? edits[k.key] : k.value} placeholder={k.hint} onChange={(e) => setEdits((x) => ({ ...x, [k.key]: e.target.value }))} style={{ minHeight: 70 }} className={/JSONLD/.test(k.key) ? "admInput--mono" : ""} />
                : <Input value={editing ? edits[k.key] : k.value} placeholder={k.hint} onChange={(e) => setEdits((x) => ({ ...x, [k.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") save(k.key); }} />}
              <button className="admBtn admBtn--sm admBtn--primary" disabled={!editing} onClick={() => save(k.key)}>Save</button>
            </div>
            {k.hint && <span className="admHint">{k.hint}</span>}
          </div>
        );
      })}
    </div>
  );
}
