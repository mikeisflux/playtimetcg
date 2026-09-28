"use client";
import Link from "next/link";
import { useState } from "react";
import { useJson, api, useToast, Badge, DateTime, Pager, SearchBox, PageHead, Empty, Field, Input, Checkbox, qs } from "./shared";

interface Row { id: string; email: string; name: string; isAdmin: boolean; createdAt: string; ageVerifiedAt: string | null; marketingOptIn: boolean; _count: { orders: number; cards: number }; subscriptions: { plan: string; status: string }[] }

interface Created { user: { id: string; email: string; name: string }; generatedPassword?: string; mail: { ok: boolean; error?: string } | null }

const BLANK = { email: "", name: "", password: "", isAdmin: false, ageVerified: true, marketingOptIn: false, sendWelcome: true };

export default function UsersList({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const { data, loading, error, reload } = useJson<{ rows: Row[]; total: number; pages: number }>(`/api/admin/users?${qs({ q, filter, page })}`);

  function onCreated(c: Created) {
    setCreated(c);
    setCreating(false);
    /* jump back to the unfiltered first page (newest first) so the new row is visible */
    if (q === "" && filter === "" && page === 1) reload(); else { setQ(""); setFilter(""); setPage(1); }
  }

  return (
    <>
      <PageHead title="Users" sub="Accounts, admins and subscribers. Open a user for orders, subscriptions, collection and credit history.">
        <button type="button" className={`admBtn admBtn--primary${creating ? " on" : ""}`} onClick={() => { setCreating((v) => !v); setCreated(null); }}>{creating ? "Close" : "New user"}</button>
      </PageHead>
      {creating && <NewUserPanel onCancel={() => setCreating(false)} onCreated={onCreated} />}
      {created && <CreatedPanel created={created} onClose={() => setCreated(null)} />}
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
              <tr key={u.id} className={created?.user.id === u.id ? "sel" : ""}>
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

/* In-page create form. Uses the existing admCard/admForm grid so it collapses to one column at phone width. */
function NewUserPanel({ onCancel, onCreated }: { onCancel: () => void; onCreated: (c: Created) => void }) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => setF((s) => ({ ...s, [k]: v }));
  const email = f.email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const pwOk = f.password === "" || f.password.length >= 8;
  const canSubmit = emailOk && f.name.trim() !== "" && pwOk && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const c = await api<Created>("/api/admin/users", { method: "POST", json: { ...f, email, name: f.name.trim() } });
      onCreated(c);
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="admCard">
      <div className="admCard__hd"><h2 className="admH2">New user</h2><span className="admMuted">Creates the account immediately. Leave the password blank to generate one.</span></div>
      {err && <div className="admNote admNote--err">{err}</div>}
      <form className="admForm" onSubmit={submit}>
        <Field label="Email" hint={f.email && !emailOk ? "Enter a valid email address." : "Stored lower-case. Must be unique."}>
          <Input type="email" required autoComplete="off" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" autoFocus />
        </Field>
        <Field label="Name"><Input required autoComplete="off" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Display name" /></Field>
        <Field label="Password" hint={!pwOk ? "At least 8 characters, or leave blank." : "Optional. Blank = generate a strong one and show it once."}>
          <Input type="text" autoComplete="new-password" className="admInput--mono" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Leave blank to generate" />
        </Field>
        <div className="admStack span2" style={{ gap: 8 }}>
          <Checkbox label="Admin — full access to this panel" checked={f.isAdmin} onChange={(e) => set("isAdmin", e.target.checked)} />
          <Checkbox label="Mark age verified" checked={f.ageVerified} onChange={(e) => set("ageVerified", e.target.checked)} />
          <Checkbox label="Marketing opt-in" checked={f.marketingOptIn} onChange={(e) => set("marketingOptIn", e.target.checked)} />
          <Checkbox label="Send welcome email with a password-set link" checked={f.sendWelcome} onChange={(e) => set("sendWelcome", e.target.checked)} />
        </div>
        <div className="admRow span2">
          <button type="submit" className="admBtn admBtn--primary" disabled={!canSubmit}>{busy ? "Creating…" : "Create user"}</button>
          <button type="button" className="admBtn admBtn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* Shown once after creation: the generated password (never retrievable again), mail status and a link to the new user. */
function CreatedPanel({ created, onClose }: { created: Created; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const pw = created.generatedPassword;
  async function copy() {
    if (!pw) return;
    try { await navigator.clipboard.writeText(pw); setCopied(true); toast.ok("Password copied"); }
    catch { toast.err("Copy failed — select the password and copy it manually."); }
  }
  return (
    <div className="admCard" style={{ borderLeft: "3px solid var(--heat-1)" }}>
      {toast.node}
      <div className="admCard__hd">
        <h2 className="admH2">User created</h2>
        <div className="admRow">
          <Link className="admBtn admBtn--primary" href={`/admin/users/${created.user.id}`}>Open user</Link>
          <button type="button" className="admBtn admBtn--ghost" onClick={onClose}>Done</button>
        </div>
      </div>
      <div className="admStack" style={{ gap: 8 }}>
        <div><strong>{created.user.name}</strong> <span className="admMuted">· {created.user.email}</span></div>
        {pw && (
          <>
            <div className="admLabel">Generated password — shown once, copy it now</div>
            <div className="admRow">
              <code className="admPre" style={{ padding: "8px 12px", fontSize: 14, userSelect: "all", maxHeight: "none" }}>{pw}</code>
              <button type="button" className="admBtn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </>
        )}
        {created.mail && (created.mail.ok
          ? <div className="admNote admNote--ok">Welcome email with a password-set link sent to {created.user.email}.</div>
          : <div className="admNote admNote--err">Welcome email failed: {created.mail.error || "unknown error"}. You can resend it from the user page.</div>)}
      </div>
    </div>
  );
}
