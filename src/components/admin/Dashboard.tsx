"use client";
import Link from "next/link";
import { useJson, Badge, Money, DateTime, PageHead, Empty } from "./shared";

interface Stats {
  revenue: { today: number; week: number; month: number; lifetime: number; ordersToday: number; ordersLifetime: number };
  openOrders: number; users: number; unread: number; failedEmails: number; webhookFailures: number;
  subs: Record<string, number>; divinity: { ok: boolean; detail: string };
  checks: { label: string; ok: boolean; hint: string }[];
  recentOrders: { id: string; number: number; email: string; status: string; totalCents: number; currency: string; createdAt: string }[];
  recentInbox: { id: string; fromEmail: string; fromName: string | null; subject: string; read: boolean; createdAt: string; channel: string }[];
}

const HEAT = ["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)", "var(--heat-5)", "var(--heat-6)", "var(--heat-7)"];

export default function Dashboard() {
  const { data, error, loading, reload } = useJson<Stats>("/api/admin/stats");
  return (
    <>
      <PageHead title="Dashboard" sub="Revenue counts orders in paid, fulfilled or shipped status.">
        <button className="admBtn" onClick={reload}>Refresh</button>
      </PageHead>
      {error && <div className="admNote admNote--err">{error}</div>}
      {loading && !data && <div className="admMuted">Loading…</div>}
      {data && (
        <>
          <div className="admGrid">
            <Tile c={HEAT[0]} label="Revenue today" value={<Money cents={data.revenue.today} />} sub={`${data.revenue.ordersToday} orders`} />
            <Tile c={HEAT[1]} label="Last 7 days" value={<Money cents={data.revenue.week} />} />
            <Tile c={HEAT[2]} label="Last 30 days" value={<Money cents={data.revenue.month} />} />
            <Tile c={HEAT[3]} label="Lifetime" value={<Money cents={data.revenue.lifetime} />} sub={`${data.revenue.ordersLifetime} paid orders`} />
            <Tile c={HEAT[4]} label="Open orders" value={data.openOrders} href="/admin/orders?status=paid" />
            <Tile c={HEAT[5]} label="Active subscriptions" value={Object.values(data.subs).reduce((a, b) => a + b, 0)} sub={Object.entries(data.subs).map(([k, v]) => `${k}: ${v}`).join(" · ") || "none"} href="/admin/subscriptions" />
            <Tile c={HEAT[6]} label="Users" value={data.users} href="/admin/users" />
            <Tile c={data.unread ? "var(--primary)" : undefined} label="Unread inbox" value={data.unread} href="/admin/emails" />
            <Tile c={data.failedEmails ? "var(--heat-6)" : undefined} label="Failed emails" value={data.failedEmails} href="/admin/emails/logs" />
            <Tile c={data.webhookFailures ? "var(--heat-6)" : undefined} label="Webhook failures" value={data.webhookFailures} href="/admin/webhooks?status=failed" />
            <Tile c={data.divinity.ok ? "var(--heat-1)" : "var(--heat-6)"} label="DivinityCoin" value={data.divinity.ok ? "OK" : "DOWN"} sub={data.divinity.detail.slice(0, 80)} />
          </div>

          <div className="admSplit">
            <div className="admCard">
              <div className="admCard__hd"><h2 className="admH2">Recent orders</h2><Link className="admBtn admBtn--sm" href="/admin/orders">All orders</Link></div>
              {data.recentOrders.length === 0 ? <Empty>No orders yet.</Empty> : (
                <div className="admTableWrap"><table className="admTable">
                  <thead><tr><th>#</th><th>Email</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead>
                  <tbody>{data.recentOrders.map((o) => (
                    <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td><td>{o.email}</td><td><Badge>{o.status}</Badge></td><td className="num"><Money cents={o.totalCents} currency={o.currency} /></td><td><DateTime value={o.createdAt} /></td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
            <div className="admCard">
              <div className="admCard__hd"><h2 className="admH2">Inbox</h2><Link className="admBtn admBtn--sm" href="/admin/emails">Open inbox</Link></div>
              {data.recentInbox.length === 0 ? <Empty>No messages.</Empty> : (
                <div className="admTableWrap"><table className="admTable">
                  <thead><tr><th>From</th><th>Subject</th><th>When</th></tr></thead>
                  <tbody>{data.recentInbox.map((m) => (
                    <tr key={m.id} className={m.read ? "" : "unread"}><td>{m.fromName || m.fromEmail}</td><td><Link href={`/admin/emails?id=${m.id}`}>{m.subject}</Link></td><td><DateTime value={m.createdAt} /></td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          </div>

          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">System checks</h2><Link className="admBtn admBtn--sm" href="/admin/settings">Settings</Link></div>
            <div className="admTableWrap"><table className="admTable">
              <tbody>{data.checks.map((c) => (
                <tr key={c.label}><td>{c.label}</td><td><Badge kind={c.ok ? "ok" : "bad"}>{c.ok ? "OK" : "Missing"}</Badge></td><td className="admMuted admMono">{c.hint}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}

function Tile({ label, value, sub, c, href }: { label: string; value: React.ReactNode; sub?: string; c?: string; href?: string }) {
  const body = (
    <div className="admTile" style={c ? ({ "--c": c } as React.CSSProperties) : undefined}>
      <div className="admLabel">{label}</div>
      <div className="admTile__n">{value}</div>
      {sub && <div className="admTile__sub">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ color: "inherit" }}>{body}</Link> : body;
}
