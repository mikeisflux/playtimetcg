"use client";
import { useEffect, useState } from "react";
import { useJson, api, useToast, PageHead, Field, Input, Textarea, Select, UploadButton, ConfirmButton, Badge, Empty } from "./shared";
import SeoGlobal from "./SeoGlobal";

interface Entry { id: string; path: string; title: string | null; description: string | null; keywords: string | null; canonical: string | null; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; robots: string | null; jsonLd: string | null; priority: number | null; changeFreq: string | null }
interface PageItem { path: string; label: string; kind: string; productId?: string; entry: Entry | null }
interface Resp { pages: PageItem[]; audit: { path: string; issues: string[] }[]; siteUrl: string }
type Form = Record<"title" | "description" | "keywords" | "canonical" | "ogTitle" | "ogDescription" | "ogImage" | "robots" | "jsonLd" | "priority" | "changeFreq", string>;

const empty: Form = { title: "", description: "", keywords: "", canonical: "", ogTitle: "", ogDescription: "", ogImage: "", robots: "", jsonLd: "", priority: "", changeFreq: "" };
const fromEntry = (e: Entry | null): Form => e ? { title: e.title ?? "", description: e.description ?? "", keywords: e.keywords ?? "", canonical: e.canonical ?? "", ogTitle: e.ogTitle ?? "", ogDescription: e.ogDescription ?? "", ogImage: e.ogImage ?? "", robots: e.robots ?? "", jsonLd: e.jsonLd ?? "", priority: e.priority === null ? "" : String(e.priority), changeFreq: e.changeFreq ?? "" } : { ...empty };

export default function Seo() {
  const data = useJson<Resp>("/api/admin/seo");
  const [tab, setTab] = useState<"pages" | "global" | "redirects" | "audit">("pages");
  const [sel, setSel] = useState<string>("/");
  const [form, setForm] = useState<Form>({ ...empty });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const item = data.data?.pages.find((p) => p.path === sel) ?? null;
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => { setForm(fromEntry(item?.entry ?? null)); }, [item]);

  async function save() {
    setBusy(true);
    try { await api("/api/admin/seo", { method: "PUT", json: { path: sel, ...form } }); toast.ok("Saved"); data.reload(); }
    catch (e) { toast.err(e); } finally { setBusy(false); }
  }
  async function remove() {
    try { await api(`/api/admin/seo?path=${encodeURIComponent(sel)}`, { method: "DELETE" }); toast.ok("Override removed"); data.reload(); }
    catch (e) { toast.err(e); }
  }

  const base = data.data?.siteUrl || "https://playtimetcg.com";
  const serpTitle = form.title || item?.label || "";
  const serpDesc = form.description || "(uses the site default description)";

  return (
    <>
      {toast.node}
      <PageHead title="SEO" sub="Per-page titles, descriptions, Open Graph and JSON-LD; global analytics and verification; redirects; and an audit of what's missing.">
        <a className="admBtn" href="/sitemap.xml" target="_blank" rel="noopener">sitemap.xml</a>
        <a className="admBtn" href="/robots.txt" target="_blank" rel="noopener">robots.txt</a>
      </PageHead>
      {data.error && <div className="admNote admNote--err">{data.error}</div>}
      <div className="admTabs" style={{ marginBottom: 16 }}>
        <button className={tab === "pages" ? "on" : ""} onClick={() => setTab("pages")}>Pages</button>
        <button className={tab === "global" ? "on" : ""} onClick={() => setTab("global")}>Global &amp; analytics</button>
        <button className={tab === "redirects" ? "on" : ""} onClick={() => setTab("redirects")}>Redirects</button>
        <button className={tab === "audit" ? "on" : ""} onClick={() => setTab("audit")}>Audit {data.data?.audit.length ? <span style={{ color: "var(--heat-7)" }}>{data.data.audit.length}</span> : null}</button>
      </div>

      {tab === "pages" && data.data && (
        <div className="admSplit admSplit--side">
          <div className="admCard" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            {data.data.pages.map((p) => (
              <div key={p.path} className={`admMsgRow${sel === p.path ? " sel" : ""}`} style={{ cursor: "pointer" }} onClick={() => setSel(p.path)}>
                <div style={{ minWidth: 0 }}>
                  <div className="from">{p.label} {p.entry ? <Badge kind="ok">custom</Badge> : null}</div>
                  <div className="subj admMono">{p.path}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">{item?.label ?? sel}</h2><a className="admBtn admBtn--sm" href={sel} target="_blank" rel="noopener">Open</a></div>
            <div className="admSerp">
              <div className="u">{base}{sel === "/" ? "" : sel}</div>
              <div className="t">{serpTitle.slice(0, 70)}{serpTitle.length > 70 ? "…" : ""}</div>
              <div className="d">{serpDesc.slice(0, 160)}{serpDesc.length > 160 ? "…" : ""}</div>
            </div>
            <form className="admForm" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <Field label={`Title (${form.title.length}/60)`} className="span2" hint={form.title.length > 60 ? "Over 60 characters — Google may truncate it" : undefined}><Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Leave blank to use the page default" /></Field>
              <Field label={`Meta description (${form.description.length}/160)`} className="span2" hint={form.description.length > 160 ? "Over 160 characters" : undefined}><Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} style={{ minHeight: 70 }} /></Field>
              <Field label="Keywords" hint="comma separated" className="span2"><Input value={form.keywords} onChange={(e) => set({ keywords: e.target.value })} /></Field>
              <Field label="Canonical URL" hint="blank = this page's own URL"><Input value={form.canonical} onChange={(e) => set({ canonical: e.target.value })} className="admInput--mono" /></Field>
              <Field label="Robots"><Select value={form.robots} onChange={(e) => set({ robots: e.target.value })} options={[{ value: "", label: "default (index, follow)" }, "index,follow", "noindex,follow", "noindex,nofollow", "index,nofollow"]} /></Field>
              <Field label="OG title"><Input value={form.ogTitle} onChange={(e) => set({ ogTitle: e.target.value })} /></Field>
              <Field label="OG description"><Input value={form.ogDescription} onChange={(e) => set({ ogDescription: e.target.value })} /></Field>
              <Field label="OG image" hint="1200×630 — keep it safe for previews (no photography)" className="span2">
                <div className="admRow"><Input value={form.ogImage} onChange={(e) => set({ ogImage: e.target.value })} /><UploadButton onDone={(url) => set({ ogImage: url })} onError={toast.err} /></div>
              </Field>
              <Field label="Sitemap priority" hint="0–1"><Input type="number" min="0" max="1" step="0.05" value={form.priority} onChange={(e) => set({ priority: e.target.value })} /></Field>
              <Field label="Change frequency"><Select value={form.changeFreq} onChange={(e) => set({ changeFreq: e.target.value })} options={[{ value: "", label: "default" }, "always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]} /></Field>
              <Field label="JSON-LD (structured data)" className="span2" hint="Raw JSON. Product pages get a Product schema automatically when this is blank."><Textarea value={form.jsonLd} onChange={(e) => set({ jsonLd: e.target.value })} className="admInput--mono" style={{ minHeight: 140 }} spellCheck={false} /></Field>
              <div className="span2 admRow">
                <button className="admBtn admBtn--primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                {item?.entry && <ConfirmButton className="admBtn admBtn--ghost" message="Remove all overrides for this page?" onConfirm={remove}>Remove override</ConfirmButton>}
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === "global" && <SeoGlobal />}
      {tab === "redirects" && <Redirects />}
      {tab === "audit" && data.data && (
        <div className="admCard">
          <div className="admCard__hd"><h2 className="admH2">Audit</h2></div>
          {data.data.audit.length === 0 && <Empty>Every page has a title and description within limits.</Empty>}
          <div className="admTableWrap">
            <table className="admTable">
              <tbody>
                {data.data.audit.map((a) => (
                  <tr key={a.path}><td className="admMono"><button className="admBtn admBtn--sm" onClick={() => { setSel(a.path); setTab("pages"); }}>{a.path}</button></td><td>{a.issues.join(" · ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

interface Redirect { id: string; fromPath: string; toPath: string; code: number; createdAt: string }
function Redirects() {
  const list = useJson<{ rows: Redirect[] }>("/api/admin/redirects");
  const [f, setF] = useState({ fromPath: "", toPath: "", code: "301" });
  const toast = useToast();
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api("/api/admin/redirects", { method: "POST", json: f }); toast.ok("Redirect added"); setF({ fromPath: "", toPath: "", code: "301" }); list.reload(); } catch (err) { toast.err(err); }
  }
  async function del(id: string) {
    try { await api(`/api/admin/redirects/${id}`, { method: "DELETE" }); toast.ok("Removed"); list.reload(); } catch (err) { toast.err(err); }
  }
  return (
    <div className="admCard">
      {toast.node}
      <div className="admCard__hd"><h2 className="admH2">Redirects</h2></div>
      <p className="admHint">Old or retired URLs that should send visitors (and search engines) somewhere else. Applied when a path would otherwise 404.</p>
      <form className="admRow" onSubmit={add}>
        <Input placeholder="/old-path" value={f.fromPath} onChange={(e) => setF({ ...f, fromPath: e.target.value })} className="admInput--mono" required style={{ maxWidth: 240 }} />
        <span className="admMuted">→</span>
        <Input placeholder="/new-path or https://…" value={f.toPath} onChange={(e) => setF({ ...f, toPath: e.target.value })} className="admInput--mono" required />
        <Select value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} options={["301", "302", "307", "308"]} style={{ maxWidth: 90 }} />
        <button className="admBtn admBtn--primary">Add</button>
      </form>
      <div className="admTableWrap">
        <table className="admTable">
          <thead><tr><th>From</th><th>To</th><th>Code</th><th></th></tr></thead>
          <tbody>
            {list.data?.rows.map((r) => (
              <tr key={r.id}><td className="admMono">{r.fromPath}</td><td className="admMono">{r.toPath}</td><td className="admMono">{r.code}</td>
                <td><ConfirmButton className="admBtn admBtn--sm admBtn--danger" message="Remove this redirect?" onConfirm={() => del(r.id)}>Remove</ConfirmButton></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && list.data.rows.length === 0 && <Empty>No redirects.</Empty>}
    </div>
  );
}
