import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { sendMail } from "@/lib/sendgrid";
import { getSetting } from "@/lib/settings";
import { guard, bad, notFound, readJson } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/* GET → { row, thread, me }. `thread` holds the other messages that share the
   thread (oldest first, drafts excluded) with a short snippet each; `me` is the
   configured sending address so the client can build Reply-all lists. */
export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.message.findUnique({ where: { id }, include: { attachments: { select: { id: true, filename: true, contentType: true, size: true, inline: true, contentId: true } } } });
  if (!row) return notFound();
  const tid = row.threadId || row.id;
  const [threadRows, me] = await Promise.all([
    prisma.message.findMany({
      where: { OR: [{ threadId: tid }, { id: tid }], NOT: { id }, AND: [{ OR: [{ status: null }, { status: { not: "draft" } }] }] }, orderBy: { createdAt: "asc" },
      select: { id: true, direction: true, fromEmail: true, fromName: true, toEmail: true, subject: true, text: true, createdAt: true, status: true, read: true, _count: { select: { attachments: true } } },
    }),
    getSetting("MAIL_FROM"),
  ]);
  const thread = threadRows.map(({ text, ...t }) => ({ ...t, snippet: (text || "").replace(/\s+/g, " ").trim().slice(0, 140) }));
  return NextResponse.json({ row, thread, me: me || "" });
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

/* actions: resend (outbound, typically failed) — re-calls sendMail with the
   stored fields; a fresh log row is written by sendMail. */
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.message.findUnique({ where: { id }, include: { attachments: true } });
  if (!row) return notFound();
  const b = await readJson<{ action?: string }>(req);
  if (b.action !== "resend") return bad("Unknown action");
  if (row.direction !== "out" || !row.toEmail) return bad("Only outbound messages can be resent.");
  if (row.status === "draft") return bad("Drafts are sent from the composer.");
  const split = (s: string | null | undefined) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const bcc = split((row.headers as { bcc?: string } | null)?.bcc);
  const r = await sendMail({
    to: split(row.toEmail), cc: row.cc ? split(row.cc) : undefined, bcc: bcc.length ? bcc : undefined,
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
  const row = await prisma.message.findUnique({ where: { id }, select: { id: true, subject: true, fromEmail: true, status: true } });
  if (!row) return notFound();
  await prisma.message.delete({ where: { id } });
  await audit(g.id, row.status === "draft" ? "email.draft_discard" : "email.delete", "message", id, row, undefined);
  return NextResponse.json({ ok: true });
}
