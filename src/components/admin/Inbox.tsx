"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useJson, api, useToast, Pager, PageHead, qs } from "./shared";
import InboxReader from "./InboxReader";

export interface MsgRow { id: string; direction: string; channel: string; fromEmail: string; fromName: string | null; toEmail: string | null; subject: string; read: boolean; starred: boolean; archived: boolean; threadId: string | null; status: string | null; statusMessage: string | null; templateSlug: string | null; createdAt: string; sentAt: string | null; _count: { attachments: number } }
const FOLDERS: { id: string; label: string }[] = [{ id: "inbox", label: "Inbox" }, { id: "starred", label: "Starred" }, { id: "sent", label: "Sent" }, { id: "archived", label: "Archived" }, { id: "failed", label: "Failed" }];

export default function Inbox({ initialId, initialFolder }: { initialId: string | null; initialFolder: string }) {
  const [folder, setFolder] = useState(initialFolder);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string | null>(initialId);
  const list = useJson<{ rows: MsgRow[]; total: number; pages: number; counts: { unread: number; starred: number; failed: number } }>(`/api/admin/emails?${qs({ folder, q, page })}`);
  const toast = useToast();

  useEffect(() => { const t = setTimeout(() => { setQ(qDraft); setPage(1); }, 350); return () => clearTimeout(t); }, [qDraft]);

  async function patch(id: string, data: Record<string, boolean>) {
    try { await api(`/api/admin/emails/${id}`, { method: "PATCH", json: data }); list.reload(); } catch (e) { toast.err(e); }
  }
  async function del(id: string) {
    try { await api(`/api/admin/emails/${id}`, { method: "DELETE" }); if (sel === id) setSel(null); list.reload(); toast.ok("Deleted"); } catch (e) { toast.err(e); }
  }
  const counts = list.data?.counts;
  const badge = (id: string) => id === "inbox" ? counts?.unread : id === "starred" ? counts?.starred : id === "failed" ? counts?.failed : undefined;

  return (
    <>
      {toast.node}
      <PageHead title="Inbox" sub="Contact-form messages and inbound email (SendGrid Inbound Parse). Replies send through SendGrid and thread with the original.">
        <Link className="admBtn admBtn--primary" href="/admin/emails/compose">Compose</Link>
      </PageHead>
      <div className="admInbox">
        <div className="admInbox__folders">
          {FOLDERS.map((f) => (
            <button key={f.id} className={folder === f.id ? "on" : ""} onClick={() => { setFolder(f.id); setPage(1); }}>
              <span>{f.label}</span>{badge(f.id) ? <span style={{ color: f.id === "failed" ? "var(--heat-6)" : "var(--primary)" }}>{badge(f.id)}</span> : null}
            </button>
          ))}
        </div>
        <div className="admInbox__list">
          <div className="admSearch"><input className="admInput admInput--sm" style={{ maxWidth: "none" }} type="search" placeholder="Search subject, sender, text…" value={qDraft} onChange={(e) => setQDraft(e.target.value)} /></div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {list.data?.rows.map((m) => {
              const who = m.direction === "out" ? `→ ${m.toEmail}` : (m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail);
              return (
                <div key={m.id} className={`admMsgRow${sel === m.id ? " sel" : ""}${m.direction === "in" && !m.read ? " unread" : ""}`} onClick={() => { setSel(m.id); if (m.direction === "in" && !m.read) patch(m.id, { read: true }); }}>
                  <button className={`admStar${m.starred ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); patch(m.id, { starred: !m.starred }); }} title="Star">★</button>
                  <div style={{ minWidth: 0 }}>
                    <div className="from" title={who}>{who}</div>
                    <div className="subj">{m.subject}{m._count.attachments > 0 && " 📎"}{m.status && m.direction === "out" && <span className={`admBadge admBadge--sm ${["failed", "bounced", "spam"].includes(m.status) ? "admBadge--bad" : "admBadge--dim"}`} style={{ marginLeft: 6 }}>{m.status}</span>}</div>
                  </div>
                  <div className="when">{new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<br />{new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              );
            })}
            {list.data && list.data.rows.length === 0 && <div className="admEmpty" style={{ padding: 20 }}>{list.loading ? "Loading…" : "Empty."}</div>}
          </div>
          {list.data && list.data.pages > 1 && <div style={{ padding: 8, borderTop: "1px solid var(--rule)" }}><Pager page={page} pages={list.data.pages} onPage={setPage} /></div>}
        </div>
        <div className="admInbox__read">
          {sel ? <InboxReader id={sel} onChange={() => list.reload()} onDelete={() => del(sel)} onSelect={setSel} patch={patch} /> : <div className="admEmpty" style={{ padding: 24 }}>Select a message.</div>}
        </div>
      </div>
    </>
  );
}
