import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { guard, bad, notFound, readJson, str, optStr } from "../../_lib";

export const dynamic = "force-dynamic";
const DRAFT = "draft";
const DRAFT_ATTACH_LIMIT = 10 * 1024 * 1024;

interface DraftBody { id?: string; to?: string; cc?: string; bcc?: string; subject?: string; html?: string; threadId?: string; copyAttachmentsFrom?: string }
const select = { id: true, toEmail: true, cc: true, subject: true, html: true, threadId: true, headers: true, createdAt: true, attachments: { select: { id: true, filename: true, contentType: true, size: true, inline: true } } } as const;

/* POST — upsert a draft (Message row, direction "out", status "draft").
   Body: { id?, to, cc, bcc, subject, html, threadId?, copyAttachmentsFrom? }.
   Bcc has no column, so it lives in `headers.bcc`. */
export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson<DraftBody>(req);
  const fields = {
    toEmail: optStr(b.to, 2000), cc: optStr(b.cc, 2000), subject: str(b.subject, 300).trim(),
    html: str(b.html, 500_000), threadId: optStr(b.threadId, 64),
    headers: { bcc: str(b.bcc, 2000).trim(), draftUpdatedAt: new Date().toISOString() },
  };
  if (b.id) {
    const existing = await prisma.message.findUnique({ where: { id: String(b.id) }, select: { id: true, status: true } });
    if (!existing) return notFound();
    if (existing.status !== DRAFT) return bad("Not a draft");
    const row = await prisma.message.update({ where: { id: existing.id }, data: fields, select });
    return NextResponse.json({ row });
  }
  const s = await getSettings(["MAIL_FROM", "MAIL_FROM_NAME", "SITE_NAME"]);
  const row = await prisma.message.create({
    data: {
      direction: "out", channel: fields.threadId ? "reply" : "email", status: DRAFT, read: true,
      fromEmail: s.MAIL_FROM || "no-reply@playtimetcg.com", fromName: s.MAIL_FROM_NAME || s.SITE_NAME || "Play Time",
      ...fields,
    }, select,
  });
  if (b.copyAttachmentsFrom) {
    const src = await prisma.attachment.findMany({ where: { messageId: String(b.copyAttachmentsFrom), inline: false } });
    let total = 0;
    const keep = src.filter((a) => { total += a.size; return total <= DRAFT_ATTACH_LIMIT; });
    if (keep.length) {
      await prisma.attachment.createMany({ data: keep.map((a) => ({ messageId: row.id, filename: a.filename, contentType: a.contentType, size: a.size, data: a.data, inline: false })) });
      const attachments = await prisma.attachment.findMany({ where: { messageId: row.id }, select: { id: true, filename: true, contentType: true, size: true, inline: true } });
      return NextResponse.json({ row: { ...row, attachments } });
    }
  }
  return NextResponse.json({ row });
}
