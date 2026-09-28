"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { useJson, api, useToast, Badge, Money, DateTime, ConfirmButton, Pager, SearchBox, PageHead, Empty, qs } from "./shared";

interface Row { id: string; plan: string; status: string; priceCents: number; interval: string; providerRef: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; startedAt: string; cancelledAt: string | null; user: { id: string; email: string; name: string }; _count: { invoices: number } }
interface Invoice { id: string; amountCents: number; status: string; periodStart: string; periodEnd: string; paymentRef: string | null; createdAt: string }
interface Ship { id: string; email: string; name: string; line1: string; line2: string; city: string; region: string; postal: string; country: string; phone: string; currentPeriodEnd: string | null; hasAddress: boolean }

export default function Subscriptions() {
  const [view, setView] = useState<"list" | "fulfillment">("list");
  const [f, setF] = useState({ plan: "", status: "", q: "", page: 1 });
  const list = useJson<{ rows: Row[]; total: number; pages: number }>(view === "list" ? `/api/admin/subscriptions?${qs(f)}` : null);
  const ship = useJson<{ rows: Ship[] }>(view === "fulfillment" ? "/api/admin/subscriptions?view=fulfillment" : null);
  const [open, setOpen] = useState<string | null>(null);
  const inv = useJson<{ row: { invoices: Invoice[] } }>(open ? `/api/admin/subscriptions/${open}` : null);
  const toast = useToast();

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    try { await api(`/api/admin/subscriptions/${id}`, { method: "POST", json: { action, ...extra } }); toast.ok(action); list.reload(); } catch (e) { toast.err(e); }
  }

  return (
    <>
      {toast.node}
      <PageHead title="Subscriptions" sub="monthly_cards ships three physical cards a month; online_play unlocks the digital game. Renewals are charged to the saved card every period by the site (automatic every 15 minutes; run now to force a pass).">
        <button className="admBtn" onClick={async () => { try { const r = await api<{ charged: number; failed: number; ended: number; skipped: boolean }>("/api/admin/subscriptions/renewals", { method: "POST" }); toast.ok(r.skipped ? "A renewal pass is already running" : `Renewals: ${r.charged} charged, ${r.failed} failed, ${r.ended} ended`); list.reload(); } catch (e) { toast.err(e); } }}>Run renewals now</button>
        {view === "fulfillment" && <a className="admBtn" href="/api/admin/subscriptions?view=fulfillment&format=csv">Export shipping CSV</a>}
      </PageHead>
      <div className="admTabs">
        <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>All subscriptions</button>
        <button className={view === "fulfillment" ? "on" : ""} onClick={() => setView("fulfillment")}>Monthly cards — ship list</button>
      </div>

      {view === "list" && (
        <>
          <div className="admFilters">
            <SearchBox value={f.q} onChange={(q) => setF({ ...f, q, page: 1 })} placeholder="Email, name, provider ref…" />
            <select className="admInput admInput--sm" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value, page: 1 })}><option value="">All plans</option><option value="monthly_cards">monthly_cards</option><option value="online_play">online_play</option></select>
            <select className="admInput admInput--sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}><option value="">All statuses</option>{["active", "past_due", "cancelled", "expired", "pending"].map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="admCard">
            <div className="admTableWrap"><table className="admTable">
              <thead><tr><th>User</th><th>Plan</th><th>Status</th><th className="num">Price</th><th>Period end</th><th>Provider ref</th><th>Started</th><th className="act">Actions</th></tr></thead>
              <tbody>
                {list.data?.rows.map((s) => (
                  <Fragment key={s.id}>
                    <tr className={open === s.id ? "sel" : ""}>
                      <td><Link href={`/admin/users/${s.user.id}`}>{s.user.email}</Link><div className="admMuted">{s.user.name}</div></td>
                      <td><Badge kind="dim">{s.plan}</Badge></td>
                      <td><Badge>{s.status}</Badge>{s.cancelAtPeriodEnd && <div className="admMuted">cancels at period end</div>}</td>
                      <td className="num"><Money cents={s.priceCents} />/{s.interval}</td>
                      <td><DateTime value={s.currentPeriodEnd} dateOnly /></td>
                      <td className="admMono admMuted">{s.providerRef || "comp"}</td>
                      <td><DateTime value={s.startedAt} dateOnly /></td>
                      <td className="act">
                        <button className="admBtn admBtn--sm" onClick={() => setOpen(open === s.id ? null : s.id)}>Invoices ({s._count.invoices})</button>{" "}
                        {s.status !== "active" && <button className="admBtn admBtn--sm" onClick={() => act(s.id, "activate")}>Activate</button>}{" "}
                        {s.status === "active" && <button className="admBtn admBtn--sm" onClick={() => act(s.id, "past_due")}>Past due</button>}{" "}
                        <button className="admBtn admBtn--sm" onClick={() => act(s.id, "extend", { months: 1 })}>+1 mo</button>{" "}
                        {!["cancelled", "expired"].includes(s.status) && <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message={`Cancel this subscription${s.providerRef ? " at DivinityCoin too" : ""}?`} onConfirm={() => act(s.id, "cancel")}>Cancel</ConfirmButton>}
                      </td>
                    </tr>
                    {open === s.id && (
                      <tr className="admEditRow"><td colSpan={8}>
                        {!inv.data ? <span className="admMuted">Loading…</span> : inv.data.row.invoices.length === 0 ? <span className="admMuted">No invoices recorded.</span> : (
                          <table className="admTable"><thead><tr><th>Period</th><th>Status</th><th className="num">Amount</th><th>Payment ref</th><th>Recorded</th></tr></thead><tbody>
                            {inv.data.row.invoices.map((i) => <tr key={i.id}><td><DateTime value={i.periodStart} dateOnly /> → <DateTime value={i.periodEnd} dateOnly /></td><td><Badge>{i.status}</Badge></td><td className="num"><Money cents={i.amountCents} /></td><td className="admMono admMuted">{i.paymentRef}</td><td><DateTime value={i.createdAt} /></td></tr>)}
                          </tbody></table>
                        )}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
                {list.data && list.data.rows.length === 0 && <tr><td colSpan={8}><Empty>No subscriptions match.</Empty></td></tr>}
              </tbody>
            </table></div>
            {list.data && <Pager page={f.page} pages={list.data.pages} total={list.data.total} onPage={(page) => setF({ ...f, page })} />}
          </div>
        </>
      )}

      {view === "fulfillment" && (
        <div className="admCard">
          <div className="admCard__hd"><h2 className="admH2">Ship this month — {new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}</h2><span className="admMuted">{ship.data?.rows.length ?? "…"} active monthly_cards subscribers</span></div>
          <div className="admTableWrap"><table className="admTable">
            <thead><tr><th>Name</th><th>Email</th><th>Address</th><th>Phone</th><th>Period end</th></tr></thead>
            <tbody>
              {ship.data?.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td><td>{r.email}</td>
                  <td>{r.hasAddress ? [r.line1, r.line2, `${r.city}, ${r.region} ${r.postal}`, r.country].filter(Boolean).join(", ") : <Badge kind="bad">no address</Badge>}</td>
                  <td className="admMono">{r.phone || "—"}</td><td><DateTime value={r.currentPeriodEnd} dateOnly /></td>
                </tr>
              ))}
              {ship.data && ship.data.rows.length === 0 && <tr><td colSpan={5}><Empty>No active monthly-card subscribers.</Empty></td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}
