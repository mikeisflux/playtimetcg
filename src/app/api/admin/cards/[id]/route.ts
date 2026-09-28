import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, notFound, readJson } from "../../_lib";
import { cardData } from "../_shape";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.card.findUnique({ where: { id } });
  if (!before) return notFound();
  const data = cardData({ ...before, ...(await readJson(req)) });
  if (!data.code || !data.title) return bad("code and title are required");
  const dupe = await prisma.card.findUnique({ where: { code: data.code } });
  if (dupe && dupe.id !== id) return bad("code already exists");
  const row = await prisma.card.update({ where: { id }, data });
  await audit(g.id, "card.update", "card", id, before, row);
  return NextResponse.json({ row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.card.findUnique({ where: { id } });
  if (!before) return notFound();
  await prisma.card.delete({ where: { id } });
  await audit(g.id, "card.delete", "card", id, before, undefined);
  return NextResponse.json({ ok: true });
}
