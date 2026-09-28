import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, notFound, readJson, str, bool } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.page.findUnique({ where: { id } });
  return row ? NextResponse.json({ row }) : notFound();
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.page.findUnique({ where: { id } });
  if (!before) return notFound();
  const b = await readJson(req);
  const slug = b.slug === undefined ? before.slug : str(b.slug, 80).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return bad("slug is required");
  const dupe = await prisma.page.findUnique({ where: { slug } });
  if (dupe && dupe.id !== id) return bad("slug already exists");
  const row = await prisma.page.update({ where: { id }, data: { slug, title: str(b.title, 200).trim() || before.title, html: b.html === undefined ? before.html : str(b.html, 500_000), published: b.published === undefined ? before.published : bool(b.published) } });
  await audit(g.id, "page.update", "page", id, { slug: before.slug, title: before.title, published: before.published }, { slug: row.slug, title: row.title, published: row.published });
  return NextResponse.json({ row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.page.findUnique({ where: { id } });
  if (!before) return notFound();
  await prisma.page.delete({ where: { id } });
  await audit(g.id, "page.delete", "page", id, { slug: before.slug }, undefined);
  return NextResponse.json({ ok: true });
}
