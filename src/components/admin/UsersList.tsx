"use client";
import Link from "next/link";
import { useState } from "react";
import { useJson, Badge, DateTime, Pager, SearchBox, PageHead, Empty, qs } from "./shared";

interface Row { id: string; email: string; name: string; isAdmin: boolean; createdAt: string; ageVerifiedAt: string | null; marketingOptIn: boolean; _count: { orders: number; cards: number }; subscriptions: { plan: string; status: string }[] }

export default function UsersList({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useJson<{ rows: Row[]; total: number; pages: number }>(`/api/admin/users?${qs({ q, filter, page })}`);
  return (
    <>
      <PageHead title="Users" sub="Accounts, admins and subscribers. Open a user for orders, subscriptions, collection and credit history." />
      <div className="admFilters">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Email or name…" />
        <div className="admTabs" style={{ borderBottom: 0 }}>
          {[["", "all"], ["subscribers", "subscribers"], ["admins", "admins"]].map(([v, l]) => <button key={v} className={filter === v ? "on" : ""} onClick={() => { setFilter(v); setPage(1); }}>{l}</button>)}
        </div>
      </div>
      {error && <div className="admNote admNote--err">{error}</div>}
      <div className="admCard">
        <div className="admTableWrap"><table className="admTable">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Subscriptions</th><th className="num">Orders</th><th className="num">Cards</th><th>Joined</th></tr></thead>
          <tbody>
            {data?.rows.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`}>{u.email}</Link></td>
                <td>{u.name}</td>
                <td>{u.isAdmin ? <Badge kind="hot">admin</Badge> : <span className="admMuted">user</span>}</td>
                <td className="admRow">{u.subscriptions.map((s, i) => <Badge key={i} kind={s.status === "active" ? "ok" : "warn"}>{s.plan}</Badge>)}{u.subscriptions.length === 0 && <span className="admMuted">—</span>}</td>
                <td className="num">{u._count.orders}</td><td className="num">{u._count.cards}</td>
                <td><DateTime value={u.createdAt} dateOnly /></td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={7}><Empty>{loading ? "Loading…" : "No users match."}</Empty></td></tr>}
          </tbody>
        </table></div>
        {data && <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
