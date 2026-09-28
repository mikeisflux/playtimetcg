import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, readJson } from "../_lib";
import { productData } from "./_shape";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const [rows, sets] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }], include: { cardSet: { select: { id: true, name: true, slug: true } }, _count: { select: { orderItems: true } } } }),
    prisma.cardSet.findMany({ orderBy: { sortIndex: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  return NextResponse.json({ rows, sets });
}

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const body = await readJson(req);
  const data = productData(body);
  if (!data.slug || !data.name) return bad("slug and name are required");
  if (await prisma.product.findUnique({ where: { slug: data.slug } })) return bad("slug already exists");
  const row = await prisma.product.create({ data });
  await audit(g.id, "product.create", "product", row.id, undefined, row);
  return NextResponse.json({ row });
}
