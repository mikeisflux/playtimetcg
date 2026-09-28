import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { sanitizeHtml } from "@/components/admin/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyOk(provided: string | null, expected: string) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseAddress(raw: string): { email: string; name: string | null } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  return { email: raw.trim().replace(/^<|>$/g, "").toLowerCase(), name: null };
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.replace(/\r\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) { const k = line.slice(0, i).trim(); if (!out[k]) out[k] = line.slice(i + 1).trim(); }
  }
  return out;
}

/* SendGrid Inbound Parse (multipart). Fields: from, to, cc, subject, text, html,
   headers, attachments (count), attachment1..N, attachment-info (JSON), envelope. */
export async function POST(req: Request) {
  const expected = await getSetting("INBOUND_EMAIL_KEY");
  if (!keyOk(new URL(req.url).searchParams.get("key"), expected)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: "multipart expected" }, { status: 400 }); }
  const s = (k: string) => { const v = fd.get(k); return typeof v === "string" ? v : ""; };
  const from = parseAddress(s("from") || "unknown@unknown");
  const subject = (s("subject") || "(no subject)").slice(0, 500);
  const text = s("text") || null;
  const rawHtml = s("html");
  const html = rawHtml ? sanitizeHtml(rawHtml) : null;
  const headers = parseHeaders(s("headers"));
  let info: Record<string, { filename?: string; type?: string; "content-id"?: string }> = {};
  try { info = JSON.parse(s("attachment-info") || "{}"); } catch { /* ignore */ }

  /* Thread matching: our outbound message to this sender with the same subject (minus Re:). */
  const bare = subject.replace(/^(\s*(re|fwd?|aw)\s*:\s*)+/i, "").trim();
  let threadId: string | null = null;
  const inReplyTo = headers["In-Reply-To"] || headers["References"];
  if (inReplyTo) {
    const ids = inReplyTo.match(/<([^>]+)>/g)?.map((x) => x.slice(1, -1).split("@")[0]) ?? [];
    if (ids.length) {
      const m = await prisma.message.findFirst({ where: { OR: ids.flatMap((id) => [{ id }, { sendgridMessageId: id }]) }, select: { id: true, threadId: true } });
      if (m) threadId = m.threadId || m.id;
    }
  }
  if (!threadId && bare) {
    const m = await prisma.message.findFirst({
      where: { direction: "out", toEmail: { contains: from.email, mode: "insensitive" }, subject: { equals: bare, mode: "insensitive" } },
      orderBy: { createdAt: "desc" }, select: { id: true, threadId: true },
    });
    if (m) threadId = m.threadId || m.id;
  }
  if (!threadId && bare !== subject) {
    const m = await prisma.message.findFirst({ where: { direction: "in", fromEmail: from.email, subject: { in: [bare, subject], mode: "insensitive" } }, orderBy: { createdAt: "asc" }, select: { id: true, threadId: true } });
    if (m) threadId = m.threadId || m.id;
  }

  const count = Math.min(50, Number(s("attachments") || 0) || 0);
  const attachments: { filename: string; contentType: string; size: number; data: Uint8Array<ArrayBuffer>; inline: boolean; contentId: string | null }[] = [];
  for (let i = 1; i <= Math.max(count, 0) + 5; i++) {
    const f = fd.get(`attachment${i}`);
    if (!(f instanceof File)) { if (i > count) break; continue; }
    const meta = info[`attachment${i}`] || {};
    const cid = meta["content-id"] ? String(meta["content-id"]).replace(/^<|>$/g, "") : null;
    attachments.push({ filename: (meta.filename || f.name || `attachment${i}`).slice(0, 255), contentType: (meta.type || f.type || "application/octet-stream").slice(0, 120), size: f.size, data: new Uint8Array(await f.arrayBuffer()), inline: !!cid && !!html && html.includes(`cid:${cid}`), contentId: cid });
  }

  const user = await prisma.user.findUnique({ where: { email: from.email }, select: { id: true } }).catch(() => null);
  const msg = await prisma.message.create({
    data: {
      direction: "in", channel: "email", fromEmail: from.email, fromName: from.name, toEmail: s("to").slice(0, 500) || null, cc: s("cc").slice(0, 500) || null,
      subject, text, html, read: false, threadId, status: "received", userId: user?.id ?? null,
      headers: { ...headers, envelope: s("envelope") || undefined, spamScore: s("spam_score") || undefined, dkim: s("dkim") || undefined, spf: s("SPF") || undefined },
      attachments: attachments.length ? { create: attachments } : undefined,
    },
  });
  /* rewrite cid: references so inline images render from our attachment endpoint */
  if (html && attachments.some((a) => a.inline)) {
    const rows = await prisma.attachment.findMany({ where: { messageId: msg.id, inline: true }, select: { id: true, contentId: true } });
    let out = html;
    for (const a of rows) if (a.contentId) out = out.split(`cid:${a.contentId}`).join(`/api/admin/emails/attachments/${a.id}?inline=1`);
    if (out !== html) await prisma.message.update({ where: { id: msg.id }, data: { html: out } });
  }
  return NextResponse.json({ ok: true, id: msg.id, threadId, attachments: attachments.length });
}
