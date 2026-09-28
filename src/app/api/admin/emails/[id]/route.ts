import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { sendMail } from "@/lib/sendgrid";
import { guard, bad, notFound, readJson } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.message.findUnique({ where: { id }, include: { attachments: { select: { id: true, filename: true, contentType: true, size: true, inline: true, contentId: true } } } });
  if (!row) return notFound();
  const tid = row.threadId || row.id;
  const thread = await prisma.message.findMany({
    where: { OR: [{ threadId: tid }, { id: tid }], NOT: { id } }, orderBy: { createdAt: "asc" },
    select: { id: true, direction: true, fromEmail: true, toEmail: true, subject: true, createdAt: true, status: true },
  });
  return NextResponse.json({ row, thread });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const b = await readJson<{ read?: boolean; starred?: boolean; archived?: boolean }>(req);
  const data: { read?: boolean; starred?: boolean; archived?: boolean } = {};
  if (typeof b.read === "boolean") data.read = b.read;
  if (typeof b.starred === "boolean") data.starred = b.starred;
  if (typeof b.archived === "boolean") data.archived = b.archived;
  const row = await prisma.message.update({ where: { id }, data, select: { id: true, read: true, starred: true, archived: true } }).catch(() => null);
  return row ? NextResponse.json({ row }) : notFound();
}

/* actions: resend (outbound failed) */
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.message.findUnique({ where: { id }, include: { attachments: true } });
  if (!row) return notFound();
  const b = await readJson<{ action?: string }>(req);
  if (b.action !== "resend") return bad("Unknown action");
  if (row.direction !== "out" || !row.toEmail) return bad("Only outbound messages can be resent.");
  const r = await sendMail({
    to: row.toEmail.split(",").map((s) => s.trim()).filter(Boolean),
    cc: row.cc ? row.cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    subject: row.subject, text: row.text || "", html: row.html || undefined,
    attachments: row.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.data), inline: a.inline, contentId: a.contentId ?? undefined })),
    templateSlug: row.templateSlug ?? undefined, userId: row.userId ?? undefined, orderId: row.orderId ?? undefined, threadId: row.threadId ?? row.id, channel: row.channel,
  });
  await audit(g.id, "email.resend", "message", id, undefined, { ok: r.ok, logId: r.logId, error: r.error });
  if (!r.ok) return bad(r.error || "Send failed", 502);
  return NextResponse.json({ ok: true, logId: r.logId });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.message.findUnique({ where: { id }, select: { id: true, subject: true, fromEmail: true } });
  if (!row) return notFound();
  await prisma.message.delete({ where: { id } });
  await audit(g.id, "email.delete", "message", id, row, undefined);
  return NextResponse.json({ ok: true });
}
