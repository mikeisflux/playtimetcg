import { NextResponse } from "next/server";
import { audit } from "@/lib/auth";
import { sendMail, htmlToText } from "@/lib/sendgrid";
import { guard, bad } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emails = (s: unknown) => String(s ?? "").split(/[,;\s]+/).map((e) => e.trim()).filter((e) => /.+@.+\..+/.test(e));

/* multipart: to, cc, bcc, subject, html, text, threadId, testToMe, files[] */
export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  let fd: FormData;
  try { fd = await req.formData(); } catch { return bad("multipart form expected"); }
  const testToMe = fd.get("testToMe") === "1";
  const to = testToMe ? [g.email] : emails(fd.get("to"));
  if (!to.length) return bad("At least one valid recipient is required.");
  const subject = String(fd.get("subject") || "").trim();
  if (!subject) return bad("Subject is required.");
  const html = String(fd.get("html") || "");
  const text = String(fd.get("text") || "").trim() || htmlToText(html) || subject;
  const attachments = [];
  let total = 0;
  for (const f of fd.getAll("files")) {
    if (!(f instanceof File) || !f.size) continue;
    total += f.size;
    if (total > 20 * 1024 * 1024) return bad("Attachments exceed 20MB total.", 413);
    attachments.push({ filename: f.name, contentType: f.type || "application/octet-stream", content: Buffer.from(await f.arrayBuffer()) });
  }
  const r = await sendMail({
    to, cc: testToMe ? undefined : emails(fd.get("cc")), bcc: testToMe ? undefined : emails(fd.get("bcc")),
    subject: testToMe ? `[TEST] ${subject}` : subject, text, html: html ? wrapHtml(html) : undefined,
    attachments, threadId: String(fd.get("threadId") || "") || undefined, channel: fd.get("threadId") ? "reply" : "email",
  });
  await audit(g.id, "email.send", "message", r.logId ?? null, undefined, { to, subject, ok: r.ok, error: r.error });
  if (!r.ok) return bad(r.error || "Send failed", 502);
  return NextResponse.json({ ok: true, logId: r.logId, messageId: r.messageId });
}

function wrapHtml(html: string) {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:24px;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55">${html}</body></html>`;
}
