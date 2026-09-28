"use client";
import Link from "next/link";
import { useState } from "react";
import { useJson, Badge, Money, DateTime, Pager, SearchBox, PageHead, Empty, qs } from "./shared";

interface Row { id: string; number: number; email: string; status: string; totalCents: number; currency: string; createdAt: string; paymentMethod: string | null; needsShipping: boolean; trackingNumber: string | null; items: { name: string; qty: number }[]; user: { id: string; name: string } | null }
const STATUSES = ["", "pending", "awaiting_payment", "paid", "fulfilled", "shipped", "cancelled", "refunded", "failed"];

export default function OrdersList({ initialStatus, initialQuery }: { initialStatus: string; initialQuery: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [q, setQ] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const { data, loading, error } = useJson<{ rows: Row[]; total: number; pages: number }>(`/api/admin/orders?${qs({ status, q, page })}`);
  return (
    <>
      <PageHead title="Orders" sub="Search by email, order number, payment reference or tracking number.">
        <a className="admBtn" href={`/api/admin/orders?${qs({ status, q, format: "csv" })}`}>Export CSV</a>
      </PageHead>
      <div className="admFilters">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Email, #number, ref…" />
        <div className="admTabs" style={{ borderBottom: 0 }}>
          {STATUSES.map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => { setStatus(s); setPage(1); }}>{s || "all"}</button>)}
        </div>
      </div>
      {error && <div className="admNote admNote--err">{error}</div>}
      <div className="admCard">
        <div className="admTableWrap"><table className="admTable">
          <thead><tr><th>#</th><th>Placed</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th>Ship</th><th className="num">Total</th></tr></thead>
          <tbody>
            {data?.rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td>
                <td><DateTime value={o.createdAt} /></td>
                <td>{o.email}{o.user && <div className="admMuted">{o.user.name}</div>}</td>
                <td className="admMuted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 80)}</td>
                <td><Badge>{o.status}</Badge></td>
                <td className="admMono admMuted">{o.paymentMethod?.replace("divinitycoin_", "dc:") || "—"}</td>
                <td>{o.needsShipping ? (o.trackingNumber ? <Badge kind="ok">tracked</Badge> : <Badge kind="warn">ship</Badge>) : <Badge kind="dim">digital</Badge>}</td>
                <td className="num"><Money cents={o.totalCents} currency={o.currency} /></td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={8}><Empty>{loading ? "Loading…" : "No orders match."}</Empty></td></tr>}
          </tbody>
        </table></div>
        {data && <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
