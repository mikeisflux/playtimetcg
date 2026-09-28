"use client";
import { useState } from "react";
import { useJson, api, useToast, PageHead, Field, Input, Checkbox, ConfirmButton, DateTime, Badge, Empty } from "./shared";
import RichEditor from "./RichEditor";

interface PageRow { id: string; slug: string; title: string; html: string; published: boolean; updatedAt: string }
type Form = { slug: string; title: string; html: string; published: boolean };

export default function Pages() {
  const list = useJson<{ rows: PageRow[]; presets: string[] }>("/api/admin/pages");
  const [edit, setEdit] = useState<{ id: string | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (patch: Partial<Form>) => setEdit((e) => e && ({ ...e, form: { ...e.form, ...patch } }));

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit.id) await api(`/api/admin/pages/${edit.id}`, { method: "PUT", json: edit.form });
      else await api("/api/admin/pages", { method: "POST", json: edit.form });
      toast.ok("Saved"); setEdit(null); list.reload();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }
  async function createPreset(slug: string) {
    try { await api("/api/admin/pages", { method: "POST", json: { slug } }); toast.ok(`Created /${slug}`); list.reload(); } catch (e) { toast.err(e); }
  }
  async function del(id: string) {
    try { await api(`/api/admin/pages/${id}`, { method: "DELETE" }); toast.ok("Deleted"); list.reload(); } catch (e) { toast.err(e); }
  }

  return (
    <>
      {toast.node}
      <PageHead title="Pages" sub="Legal and help copy shown at /privacy, /terms, /shipping, /returns and any other slug. The owner supplies the legal text; unpublished pages show a placeholder.">
        {list.data?.presets.map((p) => <button key={p} className="admBtn admBtn--sm" onClick={() => createPreset(p)}>+ {p}</button>)}
        <button className="admBtn admBtn--primary" onClick={() => setEdit({ id: null, form: { slug: "", title: "", html: "<p></p>", published: true } })}>New page</button>
      </PageHead>
      {list.error && <div className="admNote admNote--err">{list.error}</div>}

      {edit && (
        <div className="admCard">
          <div className="admCard__hd"><h2 className="admH2">{edit.id ? `Edit /${edit.form.slug}` : "New page"}</h2><button className="admBtn admBtn--ghost" onClick={() => setEdit(null)}>Close</button></div>
          <form className="admForm" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Title"><Input required value={edit.form.title} onChange={(e) => set({ title: e.target.value, slug: edit.id || edit.form.slug ? edit.form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") })} /></Field>
            <Field label="Slug" hint="served at /<slug>"><Input required value={edit.form.slug} onChange={(e) => set({ slug: e.target.value })} className="admInput--mono" /></Field>
            <div className="span2"><RichEditor value={edit.form.html} onChange={(html) => set({ html })} minHeight={360} /></div>
            <Checkbox label="Published" checked={edit.form.published} onChange={(e) => set({ published: e.target.checked })} />
            <div className="span2 admRow">
              <button className="admBtn admBtn--primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              {edit.id && <a className="admBtn" href={`/${edit.form.slug}`} target="_blank" rel="noopener">View page</a>}
            </div>
          </form>
        </div>
      )}

      <div className="admCard">
        <div className="admTableWrap">
          <table className="admTable">
            <thead><tr><th>Slug</th><th>Title</th><th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {list.data?.rows.map((p) => (
                <tr key={p.id}>
                  <td className="admMono">/{p.slug}</td>
                  <td>{p.title}</td>
                  <td><Badge>{p.published ? "published" : "inactive"}</Badge></td>
                  <td><DateTime value={p.updatedAt} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="admBtn admBtn--sm" onClick={() => setEdit({ id: p.id, form: { slug: p.slug, title: p.title, html: p.html, published: p.published } })}>Edit</button>{" "}
                    <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message={`Delete /${p.slug}?`} onConfirm={() => del(p.id)}>Delete</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && list.data.rows.length === 0 && <Empty>No pages yet — use the preset buttons above to create the legal pages.</Empty>}
      </div>
    </>
  );
}
