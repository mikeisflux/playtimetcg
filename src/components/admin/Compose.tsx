"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useJson, useToast, PageHead, Field, Input } from "./shared";
import RichEditor from "./RichEditor";

interface Tpl { id: string; slug: string; name: string; subject: string; html: string }
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export default function Compose({ prefill }: { prefill: { to: string; cc: string; subject: string; threadId: string; quote: string } }) {
  const [f, setF] = useState({ to: prefill.to, cc: prefill.cc, bcc: "", subject: prefill.subject, html: prefill.quote ? `<p><br></p><blockquote style="border-left:3px solid #ccc;margin:8px 0;padding:4px 12px;color:#555">${esc(prefill.quote.trim()).replace(/\n/g, "<br>")}</blockquote>` : "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const tpls = useJson<{ rows: Tpl[] }>("/api/admin/emails/templates");
  const toast = useToast();
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => { setSent(null); }, [f.subject]);

  async function send(testToMe: boolean) {
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (prefill.threadId) fd.append("threadId", prefill.threadId);
      if (testToMe) fd.append("testToMe", "1");
      files.forEach((file) => fd.append("files", file));
      const res = await fetch("/api/admin/emails/send", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Send failed");
      toast.ok(testToMe ? "Test sent to you" : "Sent");
      if (!testToMe) { setSent(d.logId); setTimeout(() => router.push(`/admin/emails?folder=sent&id=${d.logId}`), 600); }
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <>
      {toast.node}
      <PageHead title={prefill.threadId ? "Reply" : "Compose"} sub="Sends via SendGrid from the configured MAIL_FROM address. Template variables like {{name}} are sent literally here — use Templates for merges.">
        <select className="admInput admInput--sm" defaultValue="" onChange={(e) => { const t = tpls.data?.rows.find((x) => x.id === e.target.value); if (t) setF({ ...f, subject: t.subject, html: t.html }); e.target.value = ""; }}>
          <option value="">Load template…</option>
          {tpls.data?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </PageHead>
      <div className="admCard">
        <form className="admForm" onSubmit={(e) => { e.preventDefault(); send(false); }}>
          <Field label="To" hint="comma separated" className="span2"><Input required value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} placeholder="someone@example.com" /></Field>
          <Field label="Cc"><Input value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value })} /></Field>
          <Field label="Bcc"><Input value={f.bcc} onChange={(e) => setF({ ...f, bcc: e.target.value })} /></Field>
          <Field label="Subject" className="span2"><Input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <div className="span2"><RichEditor value={f.html} onChange={(html) => setF({ ...f, html })} minHeight={320} /></div>
          <Field label="Attachments" className="span2">
            <div className="admRow">
              <label className="admBtn admBtn--sm">Add files<input type="file" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])]); e.target.value = ""; }} /></label>
              {files.map((file, i) => <span key={i} className="admBadge">{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB <button type="button" className="admStar" style={{ marginLeft: 4 }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></span>)}
            </div>
          </Field>
          <div className="span2 admRow">
            <button className="admBtn admBtn--primary" disabled={busy || !!sent}>{busy ? "Sending…" : sent ? "Sent ✓" : "Send"}</button>
            <button type="button" className="admBtn" disabled={busy} onClick={() => send(true)}>Send test to me</button>
            {prefill.threadId && <span className="admMuted admMono">thread {prefill.threadId}</span>}
          </div>
        </form>
      </div>
    </>
  );
}
