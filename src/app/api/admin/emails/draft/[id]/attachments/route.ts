import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, bad, notFound, readJson } from "../../../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const LIMIT = 10 * 1024 * 1024;
type Ctx = { params: Promise<{ id: string }> };
const select = { id: true, filename: true, contentType: true, size: true, inline: true } as const;

async function draft(id: string) {
  return prisma.message.findFirst({ where: { id, status: "draft" }, select: { id: true, attachments: { select: { size: true } } } });
}

/* POST multipart files[] — attach to a draft. 10 MB total per draft. */
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const d = await draft(id);
  if (!d) return notFound();
  let fd: FormData;
  try { fd = await req.formData(); } catch { return bad("multipart form expected"); }
  let total = d.attachments.reduce((n, a) => n + a.size, 0);
  const rows = [];
  for (const f of fd.getAll("files")) {
    if (!(f instanceof File) || !f.size) continue;
    total += f.size;
    if (total > LIMIT) return bad("Attachments exceed 10 MB total.", 413);
    rows.push({ messageId: id, filename: f.name.slice(0, 255), contentType: f.type || "application/octet-stream", size: f.size, data: new Uint8Array(await f.arrayBuffer()), inline: false });
  }
  if (rows.length) await prisma.attachment.createMany({ data: rows });
  const attachments = await prisma.attachment.findMany({ where: { messageId: id }, select, orderBy: { id: "asc" } });
  return NextResponse.json({ attachments, total });
}

/* DELETE { attachmentId } — remove one attachment from the draft. */
export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  if (!(await draft(id))) return notFound();
  const b = await readJson<{ attachmentId?: string }>(req);
  if (!b.attachmentId) return bad("attachmentId required");
  await prisma.attachment.deleteMany({ where: { id: String(b.attachmentId), messageId: id } });
  const attachments = await prisma.attachment.findMany({ where: { messageId: id }, select, orderBy: { id: "asc" } });
  return NextResponse.json({ attachments });
}
