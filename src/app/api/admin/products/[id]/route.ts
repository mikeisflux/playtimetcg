import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/auth";
import { guard, bad, notFound, readJson } from "../../_lib";
import { productData } from "../_shape";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
  return row ? NextResponse.json({ row }) : notFound();
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) return notFound();
  const data = productData(await readJson(req));
  if (!data.slug || !data.name) return bad("slug and name are required");
  const dupe = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (dupe && dupe.id !== id) return bad("slug already exists");
  const { requiresChoice, ...rest } = data;
  const row = await prisma.product.update({ where: { id }, data: { ...rest, requiresChoice: requiresChoice === undefined ? Prisma.DbNull : requiresChoice } });
  await audit(g.id, "product.update", "product", id, before, row);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const hard = new URL(req.url).searchParams.get("hard") === "1";
  const before = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true, packs: true } } } });
  if (!before) return notFound();
  if (hard) {
    if (before._count.orderItems > 0) return bad(`Referenced by ${before._count.orderItems} order item(s) — deactivate instead.`);
    await prisma.seoEntry.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    await audit(g.id, "product.delete", "product", id, before, undefined);
    return NextResponse.json({ ok: true, deleted: true });
  }
  const row = await prisma.product.update({ where: { id }, data: { active: false } });
  await audit(g.id, "product.deactivate", "product", id, { active: before.active }, { active: false });
  return NextResponse.json({ ok: true, row });
}
