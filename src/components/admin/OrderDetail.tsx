"use client";
import Link from "next/link";
import { useState } from "react";
import { useJson, api, useToast, Badge, Money, DateTime, ConfirmButton, PageHead, Field, Input, Textarea, Select } from "./shared";

interface Item { id: string; name: string; unitCents: number; qty: number; choices: unknown; digitalGranted: boolean; product: { slug: string; kind: string; digital: boolean } | null }
interface Order {
  id: string; number: number; email: string; status: string; subtotalCents: number; shippingCents: number; taxCents: number; discountCents: number; totalCents: number; currency: string;
  paymentMethod: string | null; paymentRef: string | null; creditHoldId: string | null; shipping: Record<string, string> | null; needsShipping: boolean; trackingNumber: string | null; trackingCarrier: string | null;
  notes: string | null; discreetPackaging: boolean; paidAt: string | null; fulfilledAt: string | null; createdAt: string; updatedAt: string; items: Item[]; user: { id: string; name: string; email: string } | null;
}
interface Detail { order: Order; emails: { id: string; subject: string; status: string | null; toEmail: string | null; createdAt: string; templateSlug: string | null }[]; audits: { id: string; action: string; createdAt: string; admin: { name: string }; after: unknown }[] }

export default function OrderDetail({ id }: { id: string }) {
  const { data, error, reload } = useJson<Detail>(`/api/admin/orders/${id}`);
  const toast = useToast();
  const [tracking, setTracking] = useState({ trackingNumber: "", trackingCarrier: "USPS" });
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState({ amount: "", reason: "" });

  async function act(action: string, extra: Record<string, unknown> = {}) {
    try { await api(`/api/admin/orders/${id}`, { method: "POST", json: { action, ...extra } }); toast.ok(`${action.replace(/_/g, " ")} done`); reload(); }
    catch (e) { toast.err(e); }
  }

  if (error) return <div className="admNote admNote--err">{error}</div>;
  if (!data) return <div className="admMuted">Loading…</div>;
  const o = data.order;
  const sh = o.shipping;
  const paid = ["paid", "fulfilled", "shipped"].includes(o.status);
  const timeline = [
    { at: o.createdAt, label: "Placed" },
    ...(o.paidAt ? [{ at: o.paidAt, label: `Paid (${o.paymentMethod || "—"})` }] : []),
    ...(o.fulfilledAt ? [{ at: o.fulfilledAt, label: o.status === "shipped" ? "Shipped" : "Fulfilled" }] : []),
    ...data.audits.slice().reverse().map((a) => ({ at: a.createdAt, label: `${a.action.replace("order.", "")} — ${a.admin.name}` })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <>
      {toast.node}
      <PageHead title={`Order #${o.number}`} sub={`${o.email} · placed ${new Date(o.createdAt).toLocaleString()}`}>
        <Badge>{o.status}</Badge>
        <Link className="admBtn" href="/admin/orders">Back</Link>
      </PageHead>
      <div className="admSplit">
        <div className="admStack">
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Items</h2></div>
            <div className="admTableWrap"><table className="admTable">
              <thead><tr><th>Item</th><th>Qty</th><th className="num">Unit</th><th className="num">Total</th></tr></thead>
              <tbody>{o.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}{i.product && <div className="admMuted admMono">{i.product.kind} · {i.product.slug}{i.product.digital ? (i.digitalGranted ? " · granted" : " · not granted") : ""}</div>}{i.choices ? <div className="admMuted admMono">{JSON.stringify(i.choices)}</div> : null}</td>
                  <td>{i.qty}</td><td className="num"><Money cents={i.unitCents} currency={o.currency} /></td><td className="num"><Money cents={i.unitCents * i.qty} currency={o.currency} /></td>
                </tr>
              ))}</tbody>
              <tfoot>
                <tr><td colSpan={3} className="admMuted">Subtotal</td><td className="num"><Money cents={o.subtotalCents} currency={o.currency} /></td></tr>
                <tr><td colSpan={3} className="admMuted">Shipping</td><td className="num"><Money cents={o.shippingCents} currency={o.currency} /></td></tr>
                <tr><td colSpan={3} className="admMuted">Tax</td><td className="num"><Money cents={o.taxCents} currency={o.currency} /></td></tr>
                {o.discountCents > 0 && <tr><td colSpan={3} className="admMuted">Discount</td><td className="num">−<Money cents={o.discountCents} currency={o.currency} /></td></tr>}
                <tr><td colSpan={3}><strong>Total</strong></td><td className="num"><strong><Money cents={o.totalCents} currency={o.currency} /></strong></td></tr>
              </tfoot>
            </table></div>
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Payment</h2></div>
            <dl className="admKv">
              <dt>Method</dt><dd>{o.paymentMethod || "—"}</dd>
              <dt>Reference</dt><dd className="admMono">{o.paymentRef || "—"}</dd>
              <dt>Credit hold</dt><dd className="admMono">{o.creditHoldId || "—"}</dd>
              <dt>Paid at</dt><dd><DateTime value={o.paidAt} /></dd>
              <dt>Customer</dt><dd>{o.user ? <Link href={`/admin/users/${o.user.id}`}>{o.user.name} ({o.user.email})</Link> : <span>{o.email} (guest)</span>}</dd>
            </dl>
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Shipping</h2>{o.discreetPackaging && <Badge kind="dim">discreet</Badge>}</div>
            {!o.needsShipping ? <div className="admMuted">Digital only — nothing to ship.</div> : sh ? (
              <div style={{ whiteSpace: "pre-line" }}>{[sh.name, sh.line1, sh.line2, `${sh.city || ""}${sh.region ? ", " + sh.region : ""} ${sh.postal || ""}`, sh.country, sh.phone].filter(Boolean).join("\n")}</div>
            ) : <div className="admMuted">No address on file.</div>}
            {(o.trackingNumber || o.trackingCarrier) && <div className="admMono">{o.trackingCarrier} {o.trackingNumber}</div>}
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Timeline</h2></div>
            <div className="admTimeline">{timeline.map((t, i) => <div key={i}><DateTime value={t.at} /> — {t.label}</div>)}</div>
          </div>
        </div>

        <div className="admStack">
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Actions</h2></div>
            <div className="admRow">
              {!paid && !["cancelled", "refunded"].includes(o.status) && <ConfirmButton className="admBtn admBtn--primary" message="Mark this order as paid (comp)? Digital items will be granted and a receipt sent." onConfirm={() => act("mark_paid")}>Mark paid</ConfirmButton>}
              {paid && <button className="admBtn" onClick={() => act("resend_receipt")}>Resend receipt</button>}
              {paid && o.status !== "fulfilled" && o.status !== "shipped" && !o.needsShipping && <button className="admBtn" onClick={() => act("fulfill")}>Mark fulfilled</button>}
              {!["cancelled", "refunded", "shipped"].includes(o.status) && <ConfirmButton className="admBtn admBtn--danger" message="Cancel this order?" onConfirm={() => act("cancel")}>Cancel</ConfirmButton>}
            </div>
            {paid && o.needsShipping && (
              <form className="admForm" onSubmit={(e) => { e.preventDefault(); act("ship", tracking); }}>
                <Field label="Carrier"><Select value={tracking.trackingCarrier} onChange={(e) => setTracking({ ...tracking, trackingCarrier: e.target.value })} options={["USPS", "UPS", "FedEx", "DHL", "Other"]} /></Field>
                <Field label="Tracking number"><Input value={tracking.trackingNumber} onChange={(e) => setTracking({ ...tracking, trackingNumber: e.target.value })} placeholder={o.trackingNumber || ""} /></Field>
                <div className="span2"><button className="admBtn admBtn--primary">{o.status === "shipped" ? "Update tracking & resend" : "Mark shipped & email customer"}</button></div>
              </form>
            )}
            {paid && (
              <form className="admForm" onSubmit={(e) => { e.preventDefault(); if (window.confirm("Refund this order?")) act("refund", { amountCents: refund.amount ? Math.round(Number(refund.amount) * 100) : undefined, reason: refund.reason }); }}>
                <Field label="Refund amount" hint={`blank = full ${(o.totalCents / 100).toFixed(2)}`}><Input type="number" step="0.01" min="0" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} /></Field>
                <Field label="Reason"><Input value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} /></Field>
                <div className="span2"><button className="admBtn admBtn--danger">Refund{o.paymentRef ? " via DivinityCoin" : ""}</button></div>
              </form>
            )}
            <details>
              <summary className="admLabel" style={{ cursor: "pointer" }}>Force status</summary>
              <div className="admRow" style={{ marginTop: 8 }}>
                {["pending", "awaiting_payment", "paid", "fulfilled", "shipped", "cancelled", "refunded", "failed"].filter((s) => s !== o.status).map((s) => (
                  <ConfirmButton key={s} className="admBtn admBtn--sm" message={`Set status to ${s} without side effects?`} onConfirm={() => act("set_status", { status: s })}>{s}</ConfirmButton>
                ))}
              </div>
            </details>
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Internal notes</h2></div>
            {o.notes ? <pre className="admPre">{o.notes}</pre> : <div className="admMuted">No notes.</div>}
            <form className="admStack" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { act("note", { note }); setNote(""); } }}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (visible to admins only)" style={{ minHeight: 70 }} />
              <div><button className="admBtn">Add note</button></div>
            </form>
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Emails</h2></div>
            {data.emails.length === 0 ? <div className="admMuted">None sent for this order.</div> : (
              <table className="admTable"><tbody>{data.emails.map((m) => (
                <tr key={m.id}><td><Link href={`/admin/emails?folder=sent&id=${m.id}`}>{m.subject}</Link><div className="admMuted admMono">{m.templateSlug || "custom"} → {m.toEmail}</div></td><td><Badge>{m.status || "—"}</Badge></td><td><DateTime value={m.createdAt} /></td></tr>
              ))}</tbody></table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
