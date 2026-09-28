import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, notFound, readJson } from "../../../_lib";
import { setData } from "../../_shape";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.cardSet.findUnique({ where: { id } });
  if (!before) return notFound();
  const data = setData({ ...before, ...(await readJson(req)) });
  const dupe = await prisma.cardSet.findUnique({ where: { slug: data.slug } });
  if (dupe && dupe.id !== id) return bad("slug already exists");
  const row = await prisma.cardSet.update({ where: { id }, data });
  await audit(g.id, "cardset.update", "cardset", id, before, row);
  return NextResponse.json({ row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.cardSet.findUnique({ where: { id }, include: { _count: { select: { cards: true, products: true, packs: true } } } });
  if (!before) return notFound();
  if (before._count.cards || before._count.products || before._count.packs) return bad(`Set still has ${before._count.cards} cards / ${before._count.products} products / ${before._count.packs} packs.`);
  await prisma.cardSet.delete({ where: { id } });
  await audit(g.id, "cardset.delete", "cardset", id, before, undefined);
  return NextResponse.json({ ok: true });
}
