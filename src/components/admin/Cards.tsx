"use client";
import { useState } from "react";
import { CATEGORIES, CATEGORY_COLORS, RARITIES } from "@/lib/content";
import { useJson, api, useToast, Badge, ConfirmButton, PageHead, Field, Input, Textarea, Select, Checkbox, UploadButton, Pager, SearchBox, Empty, qs } from "./shared";
import CardSets, { type CardSet } from "./CardSets";
import CardsTools from "./CardsTools";

interface Card { id: string; code: string; setId: string; title: string; category: string; rarity: string; spice: number; time: string; text: string; imageUrl: string | null; active: boolean; sortIndex: number; set: { slug: string; name: string }; _count: { owners: number } }
type Form = Omit<Card, "id" | "set" | "_count">;
const RAR = RARITIES.map((r) => r.name);

export default function Cards() {
  const sets = useJson<{ rows: CardSet[] }>("/api/admin/cards/sets");
  const [f, setF] = useState({ set: "", category: "", rarity: "", q: "", page: 1 });
  const cards = useJson<{ rows: Card[]; total: number; pages: number }>(`/api/admin/cards?${qs(f)}`);
  const [edit, setEdit] = useState<{ id: string | null; form: Form } | null>(null);
  const [tab, setTab] = useState<"cards" | "sets" | "tools">("cards");
  const toast = useToast();

  const blank = (): Form => ({ code: "", setId: f.set || sets.data?.rows[0]?.id || "", title: "", category: CATEGORIES[0], rarity: "Common", spice: 1, time: "5 min", text: "", imageUrl: "", active: true, sortIndex: (cards.data?.total ?? 0) + 1 });
  const set = (patch: Partial<Form>) => setEdit((e) => e && ({ ...e, form: { ...e.form, ...patch } }));

  async function save() {
    if (!edit) return;
    try { await api(edit.id ? `/api/admin/cards/${edit.id}` : "/api/admin/cards", { method: edit.id ? "PUT" : "POST", json: edit.form }); toast.ok("Saved"); setEdit(null); cards.reload(); sets.reload(); }
    catch (e) { toast.err(e); }
  }
  async function toggle(c: Card) { try { await api(`/api/admin/cards/${c.id}`, { method: "PUT", json: { active: !c.active } }); cards.reload(); } catch (e) { toast.err(e); } }

  const editor = edit && (
    <form className="admForm" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field label="Code" hint="unique, e.g. B003"><Input required value={edit.form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="admInput--mono" /></Field>
      <Field label="Set"><Select required value={edit.form.setId} onChange={(e) => set({ setId: e.target.value })} options={[{ value: "", label: "—" }, ...(sets.data?.rows.map((s) => ({ value: s.id, label: s.name })) ?? [])]} /></Field>
      <Field label="Title"><Input required value={edit.form.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Category"><Select value={edit.form.category} onChange={(e) => set({ category: e.target.value })} options={CATEGORIES} /></Field>
      <Field label="Rarity"><Select value={edit.form.rarity} onChange={(e) => set({ rarity: e.target.value })} options={RAR} /></Field>
      <Field label="Spice (1–5)"><Input type="number" min={1} max={5} value={edit.form.spice} onChange={(e) => set({ spice: Number(e.target.value) })} /></Field>
      <Field label="Time"><Input value={edit.form.time} onChange={(e) => set({ time: e.target.value })} placeholder="5 min" /></Field>
      <Field label="Sort index"><Input type="number" value={edit.form.sortIndex} onChange={(e) => set({ sortIndex: Number(e.target.value) })} /></Field>
      <Field label="Card text" className="span2"><Textarea required value={edit.form.text} onChange={(e) => set({ text: e.target.value })} /></Field>
      <Field label="Image"><div className="admRow"><Input value={edit.form.imageUrl || ""} onChange={(e) => set({ imageUrl: e.target.value })} /><UploadButton onDone={(url) => set({ imageUrl: url })} onError={toast.err} /></div></Field>
      <div className="admRow" style={{ alignItems: "flex-end" }}><Checkbox label="Active" checked={edit.form.active} onChange={(e) => set({ active: e.target.checked })} /></div>
      <div className="span2 admRow"><button className="admBtn admBtn--primary">Save card</button><button type="button" className="admBtn" onClick={() => setEdit(null)}>Cancel</button></div>
    </form>
  );

  return (
    <>
      {toast.node}
      <PageHead title="Cards" sub="Card sets and the full card catalog. Digital packs and starter decks draw from active cards.">
        <a className="admBtn" href={`/api/admin/cards?${qs({ ...f, page: undefined, format: "csv" })}`}>Export CSV</a>
        <button className="admBtn admBtn--primary" onClick={() => { setTab("cards"); setEdit({ id: null, form: blank() }); }}>New card</button>
      </PageHead>
      <div className="admTabs">
        <button className={tab === "cards" ? "on" : ""} onClick={() => setTab("cards")}>Cards ({cards.data?.total ?? "…"})</button>
        <button className={tab === "sets" ? "on" : ""} onClick={() => setTab("sets")}>Sets ({sets.data?.rows.length ?? "…"})</button>
        <button className={tab === "tools" ? "on" : ""} onClick={() => setTab("tools")}>Import / grant</button>
      </div>

      {tab === "sets" && <CardSets sets={sets.data?.rows ?? []} reload={() => { sets.reload(); cards.reload(); }} toast={toast} />}
      {tab === "tools" && <CardsTools sets={sets.data?.rows ?? []} reload={() => { sets.reload(); cards.reload(); }} toast={toast} />}

      {tab === "cards" && (
        <>
          {edit && !edit.id && <div className="admCard"><div className="admCard__hd"><h2 className="admH2">New card</h2></div>{editor}</div>}
          <div className="admFilters">
            <SearchBox value={f.q} onChange={(q) => setF({ ...f, q, page: 1 })} placeholder="Code, title, text…" />
            <select className="admInput admInput--sm" value={f.set} onChange={(e) => setF({ ...f, set: e.target.value, page: 1 })}><option value="">All sets</option>{sets.data?.rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="admInput admInput--sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, page: 1 })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="admInput admInput--sm" value={f.rarity} onChange={(e) => setF({ ...f, rarity: e.target.value, page: 1 })}><option value="">All rarities</option>{RAR.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div className="admCard">
            <div className="admTableWrap"><table className="admTable">
              <thead><tr><th>Code</th><th>Set</th><th>Title</th><th>Category</th><th>Rarity</th><th>Spice</th><th>Time</th><th className="num">Owners</th><th className="act">Actions</th></tr></thead>
              <tbody>
                {cards.data?.rows.map((c) => edit?.id === c.id ? (
                  <tr key={c.id} className="admEditRow"><td colSpan={9}>{editor}</td></tr>
                ) : (
                  <tr key={c.id} style={c.active ? undefined : { opacity: 0.5 }}>
                    <td className="admMono">{c.code}</td>
                    <td className="admMuted">{c.set.name}</td>
                    <td><strong>{c.title}</strong><div className="admMuted" style={{ maxWidth: 380, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.text}</div></td>
                    <td><span className="admSwatch" style={{ background: CATEGORY_COLORS[c.category as keyof typeof CATEGORY_COLORS] || "#888", marginRight: 6 }} />{c.category}</td>
                    <td><Badge kind={c.rarity === "Rare" ? "hot" : c.rarity === "Uncommon" ? "info" : "dim"}>{c.rarity}</Badge></td>
                    <td className="admMono">{"●".repeat(c.spice)}{"○".repeat(5 - c.spice)}</td>
                    <td className="admMuted">{c.time}</td>
                    <td className="num">{c._count.owners}</td>
                    <td className="act">
                      <button className="admBtn admBtn--sm" onClick={() => setEdit({ id: c.id, form: { ...c, imageUrl: c.imageUrl || "" } })}>Edit</button>{" "}
                      <button className="admBtn admBtn--sm" onClick={() => toggle(c)}>{c.active ? "Disable" : "Enable"}</button>{" "}
                      <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message={`Delete ${c.code}? Owners lose it from their collection.`} onConfirm={async () => { try { await api(`/api/admin/cards/${c.id}`, { method: "DELETE" }); cards.reload(); } catch (e) { toast.err(e); } }}>Del</ConfirmButton>
                    </td>
                  </tr>
                ))}
                {cards.data && cards.data.rows.length === 0 && <tr><td colSpan={9}><Empty>No cards match. Import a CSV or add one.</Empty></td></tr>}
              </tbody>
            </table></div>
            {cards.data && <Pager page={f.page} pages={cards.data.pages} total={cards.data.total} onPage={(page) => setF({ ...f, page })} />}
          </div>
        </>
      )}
    </>
  );
}
