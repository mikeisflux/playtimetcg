"use client";
import { useState } from "react";
import { useJson, api, useToast, Badge, Money, ConfirmButton, PageHead, Field, Input, Textarea, Select, Checkbox, UploadButton, Empty } from "./shared";

interface Product {
  id: string; slug: string; kind: string; name: string; tag: string | null; description: string | null; priceCents: number; currency: string; accent: string;
  includes: string[] | null; requiresChoice: { type: string; count: number } | null; featured: boolean; active: boolean; digital: boolean; cardSetId: string | null; packSize: number | null;
  subPlan: string | null; subInterval: string | null; imageUrl: string | null; imageSlot: string | null; sortIndex: number; cardSet?: { id: string; name: string } | null; _count?: { orderItems: number };
}
type Form = Omit<Product, "id" | "priceCents" | "includes" | "requiresChoice" | "cardSet" | "_count"> & { price: string; includes: string; rcType: string; rcCount: string };
const KINDS = ["set", "expansion", "digital_pack", "subscription"];

const blank: Form = { slug: "", kind: "set", name: "", tag: "", description: "", price: "", currency: "USD", accent: "#FF5C8A", includes: "", rcType: "", rcCount: "", featured: false, active: true, digital: false, cardSetId: "", packSize: null, subPlan: "", subInterval: "month", imageUrl: "", imageSlot: "", sortIndex: 0 };
const toForm = (p: Product): Form => ({ ...blank, ...p, tag: p.tag || "", description: p.description || "", price: (p.priceCents / 100).toFixed(2), includes: (p.includes || []).join("\n"), rcType: p.requiresChoice?.type || "", rcCount: p.requiresChoice ? String(p.requiresChoice.count) : "", cardSetId: p.cardSetId || "", subPlan: p.subPlan || "", subInterval: p.subInterval || "month", imageUrl: p.imageUrl || "", imageSlot: p.imageSlot || "" });

export default function Products() {
  const { data, reload } = useJson<{ rows: Product[]; sets: { id: string; name: string; slug: string }[] }>("/api/admin/products");
  const [edit, setEdit] = useState<{ id: string | null; form: Form } | null>(null);
  const toast = useToast();

  async function save() {
    if (!edit) return;
    const f = edit.form;
    const json = { ...f, priceCents: Math.round(Number(f.price || 0) * 100), includes: f.includes, requiresChoice: f.rcType ? { type: f.rcType, count: Number(f.rcCount || 1) } : null, cardSetId: f.cardSetId || null, packSize: f.packSize || null };
    try {
      await api(edit.id ? `/api/admin/products/${edit.id}` : "/api/admin/products", { method: edit.id ? "PUT" : "POST", json });
      toast.ok("Saved"); setEdit(null); reload();
    } catch (e) { toast.err(e); }
  }
  async function del(p: Product, hard: boolean) {
    try { await api(`/api/admin/products/${p.id}${hard ? "?hard=1" : ""}`, { method: "DELETE" }); toast.ok(hard ? "Deleted" : "Deactivated"); reload(); } catch (e) { toast.err(e); }
  }
  const set = (patch: Partial<Form>) => setEdit((e) => e && ({ ...e, form: { ...e.form, ...patch } }));

  return (
    <>
      {toast.node}
      <PageHead title="Products" sub="Physical sets and expansions, digital packs, and subscription plans shown in the shop.">
        <button className="admBtn admBtn--primary" onClick={() => setEdit({ id: null, form: { ...blank, sortIndex: (data?.rows.length ?? 0) * 10 } })}>New product</button>
      </PageHead>

      {edit && (
        <div className="admCard">
          <div className="admCard__hd"><h2 className="admH2">{edit.id ? `Edit: ${edit.form.name}` : "New product"}</h2><button className="admBtn admBtn--ghost" onClick={() => setEdit(null)}>Close</button></div>
          <form className="admForm" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Name"><Input required value={edit.form.name} onChange={(e) => set({ name: e.target.value, slug: edit.id ? edit.form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") })} /></Field>
            <Field label="Slug" hint="/shop/<slug>"><Input required value={edit.form.slug} onChange={(e) => set({ slug: e.target.value })} className="admInput--mono" /></Field>
            <Field label="Kind"><Select value={edit.form.kind} onChange={(e) => set({ kind: e.target.value, digital: ["digital_pack", "subscription"].includes(e.target.value) || edit.form.digital })} options={KINDS} /></Field>
            <Field label="Price (USD)"><Input type="number" step="0.01" min="0" required value={edit.form.price} onChange={(e) => set({ price: e.target.value })} /></Field>
            <Field label="Tag" hint="short label, e.g. Best seller"><Input value={edit.form.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} /></Field>
            <Field label="Accent color"><div className="admRow"><input type="color" value={edit.form.accent} onChange={(e) => set({ accent: e.target.value })} /><Input value={edit.form.accent} onChange={(e) => set({ accent: e.target.value })} className="admInput--mono" style={{ maxWidth: 120 }} /></div></Field>
            <Field label="Sort index"><Input type="number" value={edit.form.sortIndex} onChange={(e) => set({ sortIndex: Number(e.target.value) })} /></Field>
            <Field label="Image" hint="upload or paste a URL">
              <div className="admRow"><Input value={edit.form.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value })} /><UploadButton onDone={(url) => set({ imageUrl: url })} onError={toast.err} /></div>
              {edit.form.imageUrl && <img src={edit.form.imageUrl} alt="" style={{ maxHeight: 80, marginTop: 6 }} />}
            </Field>
            <Field label="Image slot" hint="design handoff slot id, optional"><Input value={edit.form.imageSlot ?? ""} onChange={(e) => set({ imageSlot: e.target.value })} className="admInput--mono" /></Field>
            <Field label="Description" className="span2"><Textarea value={edit.form.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Field label="Includes (one per line)" className="span2"><Textarea value={edit.form.includes} onChange={(e) => set({ includes: e.target.value })} style={{ minHeight: 100 }} /></Field>
            <Field label="Requires choice — type" hint="e.g. expansion (buyer picks N)"><Input value={edit.form.rcType} onChange={(e) => set({ rcType: e.target.value })} /></Field>
            <Field label="Requires choice — count"><Input type="number" min="0" value={edit.form.rcCount} onChange={(e) => set({ rcCount: e.target.value })} /></Field>
            {(edit.form.kind === "digital_pack" || edit.form.digital) && (
              <>
                <Field label="Card set (digital packs draw from)"><Select value={edit.form.cardSetId || ""} onChange={(e) => set({ cardSetId: e.target.value })} options={[{ value: "", label: "— none —" }, ...(data?.sets.map((s) => ({ value: s.id, label: s.name })) ?? [])]} /></Field>
                <Field label="Pack size (cards)"><Input type="number" min="1" value={edit.form.packSize ?? ""} onChange={(e) => set({ packSize: e.target.value ? Number(e.target.value) : null })} /></Field>
              </>
            )}
            {edit.form.kind === "subscription" && (
              <>
                <Field label="Subscription plan"><Select value={edit.form.subPlan || ""} onChange={(e) => set({ subPlan: e.target.value })} options={[{ value: "", label: "—" }, { value: "monthly_cards", label: "monthly_cards (3 physical cards/mo)" }, { value: "online_play", label: "online_play (digital access)" }]} /></Field>
                <Field label="Interval"><Select value={edit.form.subInterval || "month"} onChange={(e) => set({ subInterval: e.target.value })} options={["month", "year"]} /></Field>
              </>
            )}
            <div className="span2 admRow">
              <Checkbox label="Active (shown in shop)" checked={edit.form.active} onChange={(e) => set({ active: e.target.checked })} />
              <Checkbox label="Featured" checked={edit.form.featured} onChange={(e) => set({ featured: e.target.checked })} />
              <Checkbox label="Digital (no shipping)" checked={edit.form.digital} onChange={(e) => set({ digital: e.target.checked })} />
            </div>
            <div className="span2 admRow"><button className="admBtn admBtn--primary">Save</button><button type="button" className="admBtn" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        </div>
      )}

      <div className="admCard">
        <div className="admTableWrap"><table className="admTable">
          <thead><tr><th></th><th>Name</th><th>Kind</th><th className="num">Price</th><th>Flags</th><th>Set / plan</th><th className="num">Sold</th><th className="act">Actions</th></tr></thead>
          <tbody>
            {data?.rows.map((p) => (
              <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                <td><span className="admSwatch" style={{ background: p.accent }} /></td>
                <td><strong>{p.name}</strong><div className="admMuted admMono">/shop/{p.slug}{p.tag ? ` · ${p.tag}` : ""}</div></td>
                <td><Badge kind="dim">{p.kind}</Badge></td>
                <td className="num"><Money cents={p.priceCents} currency={p.currency} />{p.kind === "subscription" && <span className="admMuted">/{p.subInterval}</span>}</td>
                <td className="admRow">{p.featured && <Badge kind="hot">featured</Badge>}{p.digital && <Badge kind="info">digital</Badge>}{!p.active && <Badge kind="bad">inactive</Badge>}</td>
                <td className="admMuted">{p.cardSet?.name || p.subPlan || (p.requiresChoice ? `pick ${p.requiresChoice.count} ${p.requiresChoice.type}` : "—")}</td>
                <td className="num">{p._count?.orderItems ?? 0}</td>
                <td className="act">
                  <button className="admBtn admBtn--sm" onClick={() => setEdit({ id: p.id, form: toForm(p) })}>Edit</button>{" "}
                  {p.active ? <ConfirmButton className="admBtn admBtn--sm" message="Deactivate (hide from shop)?" onConfirm={() => del(p, false)}>Deactivate</ConfirmButton>
                    : (p._count?.orderItems ?? 0) === 0 ? <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message="Permanently delete this product?" onConfirm={() => del(p, true)}>Delete</ConfirmButton>
                    : <button className="admBtn admBtn--sm" onClick={() => api(`/api/admin/products/${p.id}`, { method: "PUT", json: { ...toForm(p), priceCents: p.priceCents, active: true, requiresChoice: p.requiresChoice } }).then(() => reload()).catch(toast.err)}>Reactivate</button>}
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={8}><Empty>No products yet. Create the base set, expansions, digital packs and subscription plans.</Empty></td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
