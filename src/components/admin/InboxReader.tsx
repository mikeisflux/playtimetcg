"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useJson, Badge, DateTime, ConfirmButton } from "./shared";
import { frameDoc } from "./sanitize";

interface Full { id: string; direction: string; channel: string; fromEmail: string; fromName: string | null; toEmail: string | null; cc: string | null; subject: string; text: string | null; html: string | null; read: boolean; starred: boolean; archived: boolean; threadId: string | null; status: string | null; statusMessage: string | null; templateSlug: string | null; createdAt: string; sentAt: string | null; headers: Record<string, string> | null; attachments: { id: string; filename: string; contentType: string; size: number; inline: boolean }[] }
interface ThreadRow { id: string; direction: string; fromEmail: string; toEmail: string | null; subject: string; createdAt: string; status: string | null }

const kb = (n: number) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default function InboxReader({ id, onChange, onDelete, onSelect, patch }: { id: string; onChange: () => void; onDelete: () => void; onSelect: (id: string) => void; patch: (id: string, d: Record<string, boolean>) => Promise<void> }) {
  const { data, error, reload } = useJson<{ row: Full; thread: ThreadRow[] }>(`/api/admin/emails/${id}`);
  const [plain, setPlain] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const m = data?.row;
  const doc = useMemo(() => (m?.html ? frameDoc(m.html) : ""), [m?.html]);
  if (error) return <div className="admNote admNote--err">{error}</div>;
  if (!m) return <div className="admEmpty" style={{ padding: 24 }}>Loading…</div>;

  const quote = (m.text || "").split("\n").map((l) => `> ${l}`).join("\n").slice(0, 4000);
  const replyTo = m.direction === "in" ? m.fromEmail : (m.toEmail || "");
  const replyHref = `/admin/emails/compose?to=${encodeURIComponent(replyTo)}&subject=${encodeURIComponent(/^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`)}&threadId=${encodeURIComponent(m.threadId || m.id)}&quote=${encodeURIComponent(`\n\nOn ${new Date(m.createdAt).toLocaleString()}, ${m.fromName || m.fromEmail} wrote:\n${quote}`)}`;
  const fwdHref = `/admin/emails/compose?subject=${encodeURIComponent(/^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`)}&quote=${encodeURIComponent(`\n\n---------- Forwarded message ----------\nFrom: ${m.fromName || ""} <${m.fromEmail}>\nDate: ${new Date(m.createdAt).toLocaleString()}\nSubject: ${m.subject}\nTo: ${m.toEmail || ""}\n\n${m.text || ""}`)}`;
  const doPatch = async (d: Record<string, boolean>) => { await patch(m.id, d); reload(); onChange(); };

  return (
    <>
      <div className="hd">
        <div className="admRow admRow--between">
          <h2 className="admH2" style={{ textTransform: "none", fontFamily: "var(--font-body)", fontWeight: 600 }}>{m.subject}</h2>
          <div className="admRow">
            <Badge kind="dim">{m.channel}</Badge>{m.status && <Badge>{m.status}</Badge>}
          </div>
        </div>
        <div className="admMuted" style={{ fontSize: 12 }}>
          <div><span className="admLabel">From</span> {m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail}</div>
          {m.toEmail && <div><span className="admLabel">To</span> {m.toEmail}</div>}
          {m.cc && <div><span className="admLabel">Cc</span> {m.cc}</div>}
          <div><span className="admLabel">Date</span> <DateTime value={m.createdAt} />{m.templateSlug && <> · template <span className="admMono">{m.templateSlug}</span></>}</div>
          {m.statusMessage && <div style={{ color: "var(--heat-6)" }}>{m.statusMessage}</div>}
        </div>
        <div className="admRow">
          <Link className="admBtn admBtn--sm admBtn--primary" href={replyHref}>Reply</Link>
          <Link className="admBtn admBtn--sm" href={fwdHref}>Forward</Link>
          <button className="admBtn admBtn--sm" onClick={() => doPatch({ read: !m.read })}>{m.read ? "Mark unread" : "Mark read"}</button>
          <button className={`admBtn admBtn--sm${m.starred ? " on" : ""}`} onClick={() => doPatch({ starred: !m.starred })}>{m.starred ? "Unstar" : "Star"}</button>
          <button className="admBtn admBtn--sm" onClick={() => doPatch({ archived: !m.archived })}>{m.archived ? "Unarchive" : "Archive"}</button>
          <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message="Delete this message and its attachments?" onConfirm={onDelete}>Delete</ConfirmButton>
          <span style={{ flex: 1 }} />
          {m.html && <button className={`admBtn admBtn--sm admBtn--ghost${plain ? " on" : ""}`} onClick={() => setPlain((p) => !p)}>{plain ? "Rich" : "Plain text"}</button>}
          {m.headers && <button className="admBtn admBtn--sm admBtn--ghost" onClick={() => setShowHeaders((h) => !h)}>Headers</button>}
        </div>
        {showHeaders && m.headers && <pre className="admPre" style={{ maxHeight: 200 }}>{Object.entries(m.headers).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>}
      </div>
      {m.html && !plain ? <iframe title="message" sandbox="" srcDoc={doc} /> : <div className="txt">{m.text || "(no text)"}</div>}
      {m.attachments.length > 0 && (
        <div className="admAttach">
          {m.attachments.map((a) => <a key={a.id} className="admBtn admBtn--sm" href={`/api/admin/emails/attachments/${a.id}`} download={a.filename}>{a.inline ? "🖼 " : "📎 "}{a.filename} <span className="admMuted">{kb(a.size)}</span></a>)}
        </div>
      )}
      {data && data.thread.length > 0 && (
        <div className="admThread">
          <div className="admLabel">Thread ({data.thread.length + 1})</div>
          {data.thread.map((t) => <button key={t.id} onClick={() => onSelect(t.id)}>{t.direction === "out" ? "→" : "←"} {t.direction === "out" ? t.toEmail : t.fromEmail} · {t.subject} · {new Date(t.createdAt).toLocaleString()}{t.status ? ` · ${t.status}` : ""}</button>)}
          <button className="on" disabled>● this message</button>
        </div>
      )}
    </>
  );
}
