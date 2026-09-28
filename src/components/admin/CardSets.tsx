"use client";
import { useState } from "react";
import { api, ConfirmButton, Field, Input, Select, Empty, DateTime, Badge } from "./shared";

export interface CardSet { id: string; slug: string; name: string; kind: string; accent: string; releaseDate: string | null; sortIndex: number; _count: { cards: number; products: number } }
type Toast = { ok: (t: string) => void; err: (e: unknown) => void };
const blank = { slug: "", name: "", kind: "expansion", accent: "#FF5C8A", releaseDate: "", sortIndex: 0 };

export default function CardSets({ sets, reload, toast }: { sets: CardSet[]; reload: () => void; toast: Toast }) {
  const [edit, setEdit] = useState<{ id: string | null; form: typeof blank } | null>(null);
  const set = (p: Partial<typeof blank>) => setEdit((e) => e && ({ ...e, form: { ...e.form, ...p } }));
  async function save() {
    if (!edit) return;
    try { await api(edit.id ? `/api/admin/cards/sets/${edit.id}` : "/api/admin/cards/sets", { method: edit.id ? "PUT" : "POST", json: edit.form }); toast.ok("Saved"); setEdit(null); reload(); } catch (e) { toast.err(e); }
  }
  const form = edit && (
    <form className="admForm" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field label="Name"><Input required value={edit.form.name} onChange={(e) => set({ name: e.target.value, slug: edit.id ? edit.form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") })} /></Field>
      <Field label="Slug"><Input required value={edit.form.slug} onChange={(e) => set({ slug: e.target.value })} className="admInput--mono" /></Field>
      <Field label="Kind"><Select value={edit.form.kind} onChange={(e) => set({ kind: e.target.value })} options={["base", "expansion", "monthly", "promo"]} /></Field>
      <Field label="Accent"><div className="admRow"><input type="color" value={edit.form.accent} onChange={(e) => set({ accent: e.target.value })} /><Input value={edit.form.accent} onChange={(e) => set({ accent: e.target.value })} className="admInput--mono" style={{ maxWidth: 120 }} /></div></Field>
      <Field label="Release date"><Input type="date" value={edit.form.releaseDate} onChange={(e) => set({ releaseDate: e.target.value })} /></Field>
      <Field label="Sort index"><Input type="number" value={edit.form.sortIndex} onChange={(e) => set({ sortIndex: Number(e.target.value) })} /></Field>
      <div className="span2 admRow"><button className="admBtn admBtn--primary">Save set</button><button type="button" className="admBtn" onClick={() => setEdit(null)}>Cancel</button></div>
    </form>
  );
  return (
    <div className="admCard">
      <div className="admCard__hd"><h2 className="admH2">Card sets</h2><button className="admBtn admBtn--primary admBtn--sm" onClick={() => setEdit({ id: null, form: { ...blank, sortIndex: sets.length * 10 } })}>New set</button></div>
      {edit && !edit.id && form}
      <div className="admTableWrap"><table className="admTable">
        <thead><tr><th></th><th>Name</th><th>Slug</th><th>Kind</th><th>Release</th><th className="num">Cards</th><th className="num">Products</th><th className="act">Actions</th></tr></thead>
        <tbody>
          {sets.map((s) => edit?.id === s.id ? <tr key={s.id} className="admEditRow"><td colSpan={8}>{form}</td></tr> : (
            <tr key={s.id}>
              <td><span className="admSwatch" style={{ background: s.accent }} /></td>
              <td><strong>{s.name}</strong></td><td className="admMono">{s.slug}</td><td><Badge kind="dim">{s.kind}</Badge></td>
              <td><DateTime value={s.releaseDate} dateOnly /></td><td className="num">{s._count.cards}</td><td className="num">{s._count.products}</td>
              <td className="act">
                <button className="admBtn admBtn--sm" onClick={() => setEdit({ id: s.id, form: { slug: s.slug, name: s.name, kind: s.kind, accent: s.accent, releaseDate: s.releaseDate ? s.releaseDate.slice(0, 10) : "", sortIndex: s.sortIndex } })}>Edit</button>{" "}
                <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message="Delete this empty set?" disabled={s._count.cards > 0 || s._count.products > 0} onConfirm={async () => { try { await api(`/api/admin/cards/sets/${s.id}`, { method: "DELETE" }); reload(); } catch (e) { toast.err(e); } }}>Del</ConfirmButton>
              </td>
            </tr>
          ))}
          {sets.length === 0 && <tr><td colSpan={8}><Empty>No sets. Create “base” first.</Empty></td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
