import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, notFound, readJson, str, int } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.redirect.findUnique({ where: { id } });
  if (!before) return notFound();
  const b = await readJson(req);
  const fromPath = str(b.fromPath, 500).trim() || before.fromPath, toPath = str(b.toPath, 1000).trim() || before.toPath;
  if (!fromPath.startsWith("/")) return bad("fromPath must start with /");
  const dupe = await prisma.redirect.findUnique({ where: { fromPath } });
  if (dupe && dupe.id !== id) return bad("A redirect from that path already exists");
  const row = await prisma.redirect.update({ where: { id }, data: { fromPath, toPath, code: [301, 302, 307, 308].includes(int(b.code, before.code)) ? int(b.code, before.code) : before.code } });
  await audit(g.id, "redirect.update", "redirect", id, before, row);
  return NextResponse.json({ row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.redirect.findUnique({ where: { id } });
  if (!before) return notFound();
  await prisma.redirect.delete({ where: { id } });
  await audit(g.id, "redirect.delete", "redirect", id, before, undefined);
  return NextResponse.json({ ok: true });
}
