"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useJson, api, useToast, Badge, Money, DateTime, ConfirmButton, PageHead, Field, Input, Select, Checkbox } from "./shared";

interface Detail {
  user: {
    id: string; email: string; name: string; isAdmin: boolean; createdAt: string; ageVerifiedAt: string | null; marketingOptIn: boolean;
    addresses: { id: string; name: string; line1: string; line2: string | null; city: string; region: string; postal: string; country: string; isDefault: boolean }[];
    orders: { id: string; number: number; status: string; totalCents: number; currency: string; createdAt: string }[];
    subscriptions: { id: string; plan: string; status: string; priceCents: number; interval: string; providerRef: string | null; currentPeriodEnd: string | null; startedAt: string; invoices: { id: string; amountCents: number; status: string; periodStart: string; periodEnd: string }[] }[];
    creditLedger: { id: string; type: string; amountCents: number; balanceAfterCents: number | null; reference: string | null; description: string | null; createdAt: string }[];
    packs: { id: string; qty: number; size: number; product: { name: string } | null; set: { name: string } }[];
    _count: { cards: number; openings: number; hostedRooms: number; guestRooms: number };
  };
  isSelf: boolean;
  collectionQty: number;
  digitalProducts: { id: string; name: string; packSize: number | null }[];
}

export default function UserDetail({ id }: { id: string }) {
  const { data, error, reload } = useJson<Detail>(`/api/admin/users/${id}`);
  const toast = useToast();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pack, setPack] = useState({ productId: "", qty: 1 });
  const [profile, setProfile] = useState<{ name: string; email: string; isAdmin: boolean; ageVerified: boolean; marketingOptIn: boolean } | null>(null);

  async function act(action: string, extra: Record<string, unknown> = {}, msg = "Done") {
    try { await api(`/api/admin/users/${id}`, { method: "POST", json: { action, ...extra } }); toast.ok(msg); reload(); return true; } catch (e) { toast.err(e); return false; }
  }
  if (error) return <div className="admNote admNote--err">{error}</div>;
  if (!data) return <div className="admMuted">Loading…</div>;
  const u = data.user;
  const p = profile ?? { name: u.name, email: u.email, isAdmin: u.isAdmin, ageVerified: !!u.ageVerifiedAt, marketingOptIn: u.marketingOptIn };

  return (
    <>
      {toast.node}
      <PageHead title={u.name} sub={`${u.email} · joined ${new Date(u.createdAt).toLocaleDateString()}${u.ageVerifiedAt ? " · age verified" : ""}`}>
        {u.isAdmin && <Badge kind="hot">admin</Badge>}
        <Link className="admBtn" href="/admin/users">Back</Link>
      </PageHead>
      <div className="admGrid">
        <div className="admTile"><div className="admLabel">Orders</div><div className="admTile__n">{u.orders.length}</div></div>
        <div className="admTile"><div className="admLabel">Collection</div><div className="admTile__n">{data.collectionQty}</div><div className="admTile__sub">{u._count.cards} unique cards · {u._count.openings} packs opened</div></div>
        <div className="admTile"><div className="admLabel">Unopened packs</div><div className="admTile__n">{u.packs.reduce((a, b) => a + b.qty, 0)}</div></div>
        <div className="admTile"><div className="admLabel">Game rooms</div><div className="admTile__n">{u._count.hostedRooms + u._count.guestRooms}</div></div>
      </div>
      <div className="admSplit">
        <div className="admStack">
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Edit</h2>{data.isSelf && <span className="admMuted">This is you — your admin flag is locked.</span>}</div>
            <form className="admForm" onSubmit={async (e) => { e.preventDefault(); if (await act("update", p, "Profile saved")) setProfile(null); }}>
              <Field label="Name"><Input required value={p.name} onChange={(e) => setProfile({ ...p, name: e.target.value })} /></Field>
              <Field label="Email" hint="Stored lower-case. Must be unique."><Input type="email" required value={p.email} onChange={(e) => setProfile({ ...p, email: e.target.value })} /></Field>
              <div className="admStack span2" style={{ gap: 8 }}>
                <Checkbox label="Admin — full access to this panel" checked={p.isAdmin} disabled={data.isSelf} onChange={(e) => setProfile({ ...p, isAdmin: e.target.checked })} />
                <Checkbox label={`Age verified${u.ageVerifiedAt ? ` (since ${new Date(u.ageVerifiedAt).toLocaleDateString()})` : ""}`} checked={p.ageVerified} onChange={(e) => setProfile({ ...p, ageVerified: e.target.checked })} />
                <Checkbox label="Marketing opt-in" checked={p.marketingOptIn} onChange={(e) => setProfile({ ...p, marketingOptIn: e.target.checked })} />
              </div>
              <div className="admRow span2">
                <button className="admBtn admBtn--primary" disabled={!profile}>Save</button>
                {profile && <button type="button" className="admBtn admBtn--ghost" onClick={() => setProfile(null)}>Discard</button>}
              </div>
            </form>
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Orders</h2></div>
            {u.orders.length === 0 ? <div className="admMuted">No orders.</div> : (
              <table className="admTable"><tbody>{u.orders.map((o) => (
                <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td><td><Badge>{o.status}</Badge></td><td className="num"><Money cents={o.totalCents} currency={o.currency} /></td><td><DateTime value={o.createdAt} /></td></tr>
              ))}</tbody></table>
            )}
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Subscriptions</h2></div>
            {u.subscriptions.length === 0 ? <div className="admMuted">None.</div> : u.subscriptions.map((s) => (
              <div key={s.id} className="admStack" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 10 }}>
                <div className="admRow"><strong>{s.plan}</strong><Badge>{s.status}</Badge><span className="admMuted"><Money cents={s.priceCents} />/{s.interval}</span><span className="admMuted">until <DateTime value={s.currentPeriodEnd} dateOnly /></span>{s.providerRef ? <span className="admMono admMuted">{s.providerRef}</span> : <Badge kind="dim">comp</Badge>}<Link className="admBtn admBtn--sm" href={`/admin/subscriptions?q=${encodeURIComponent(u.email)}`}>Manage</Link></div>
                {s.invoices.length > 0 && <div className="admMuted admMono">{s.invoices.map((i) => `${new Date(i.periodStart).toLocaleDateString()} ${i.status} $${(i.amountCents / 100).toFixed(2)}`).join(" · ")}</div>}
              </div>
            ))}
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Credit ledger</h2></div>
            {u.creditLedger.length === 0 ? <div className="admMuted">No DivinityCoin credit activity.</div> : (
              <table className="admTable"><thead><tr><th>When</th><th>Type</th><th className="num">Amount</th><th className="num">Balance</th><th>Ref</th></tr></thead><tbody>{u.creditLedger.map((l) => (
                <tr key={l.id}><td><DateTime value={l.createdAt} /></td><td><Badge kind="dim">{l.type}</Badge> <span className="admMuted">{l.description}</span></td><td className="num"><Money cents={l.amountCents} /></td><td className="num">{l.balanceAfterCents === null ? "—" : <Money cents={l.balanceAfterCents} />}</td><td className="admMono admMuted">{l.reference}</td></tr>
              ))}</tbody></table>
            )}
          </div>
        </div>
        <div className="admStack">
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Actions</h2></div>
            <div className="admStack" style={{ gap: 6 }}>
              <div className="admLabel">Reset password</div>
              <form className="admRow" onSubmit={async (e) => { e.preventDefault(); if (await act("reset_password", { password: pw }, "Password set — their other sessions are signed out")) setPw(""); }}>
                <Input type="text" placeholder="New password (min 8)" value={pw} onChange={(e) => setPw(e.target.value)} style={{ maxWidth: 260 }} autoComplete="off" className="admInput--mono" />
                <button className="admBtn" disabled={pw.length < 8}>Set password</button>
                <ConfirmButton className="admBtn" message={`Email a password-reset link to ${u.email}? It is valid for 24 hours.`} onConfirm={async () => { await act("send_reset_link", {}, "Reset link sent"); }}>Email reset link</ConfirmButton>
              </form>
              <span className="admHint">Type a password to set it directly, or email them a link so they choose their own.</span>
            </div>
            <div className="admRow">
              <ConfirmButton className="admBtn" message={`Send the welcome email with a password-set link to ${u.email}?`} onConfirm={async () => { await act("send_welcome", {}, "Welcome email sent"); }}>Send welcome email</ConfirmButton>
              <ConfirmButton className="admBtn" message="Create a free 1-year online-play subscription and grant the starter deck?" onConfirm={async () => { await act("comp_online_play", {}, "Online play granted"); }}>Comp online play</ConfirmButton>
            </div>
            <form className="admRow" onSubmit={async (e) => { e.preventDefault(); await act("grant_packs", pack, "Packs granted"); }}>
              <Select value={pack.productId} onChange={(e) => setPack({ ...pack, productId: e.target.value })} options={[{ value: "", label: "Digital pack…" }, ...data.digitalProducts.map((d) => ({ value: d.id, label: `${d.name} (${d.packSize ?? 3} cards)` }))]} style={{ maxWidth: 260 }} />
              <Input type="number" min={1} max={100} value={pack.qty} onChange={(e) => setPack({ ...pack, qty: Number(e.target.value) })} style={{ maxWidth: 80 }} />
              <button className="admBtn" disabled={!pack.productId}>Grant packs</button>
            </form>
            <div className="admRow" style={{ borderTop: "1px solid var(--rule)", paddingTop: 10 }}>
              <ConfirmButton className="admBtn admBtn--danger" disabled={data.isSelf} message={`Delete ${u.email} and everything they own (collection, subscriptions, rooms)? Orders stay, unlinked.`} onConfirm={async () => { try { await api(`/api/admin/users/${id}`, { method: "DELETE" }); router.push("/admin/users"); } catch (e) { toast.err(e); } }}>Delete user</ConfirmButton>
              {data.isSelf && <span className="admHint">You cannot delete your own account.</span>}
            </div>
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Addresses</h2></div>
            {u.addresses.length === 0 ? <div className="admMuted">None saved.</div> : u.addresses.map((a) => (
              <div key={a.id} style={{ whiteSpace: "pre-line", borderBottom: "1px solid var(--rule)", paddingBottom: 8 }}>{a.isDefault && <Badge kind="ok">default</Badge>} {[a.name, a.line1, a.line2, `${a.city}, ${a.region} ${a.postal}`, a.country].filter(Boolean).join("\n")}</div>
            ))}
          </div>
          <div className="admCard">
            <div className="admCard__hd"><h2 className="admH2">Unopened packs</h2></div>
            {u.packs.length === 0 ? <div className="admMuted">None.</div> : <table className="admTable"><tbody>{u.packs.map((p) => <tr key={p.id}><td>{p.product?.name || p.set.name}</td><td className="admMuted">{p.set.name} · {p.size} cards</td><td className="num">×{p.qty}</td></tr>)}</tbody></table>}
          </div>
        </div>
      </div>
    </>
  );
}
