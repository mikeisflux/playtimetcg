import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, readJson } from "../../_lib";
import { setData } from "../_shape";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const rows = await prisma.cardSet.findMany({ orderBy: [{ sortIndex: "asc" }, { name: "asc" }], include: { _count: { select: { cards: true, products: true } } } });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const data = setData(await readJson(req));
  if (!data.slug || !data.name) return bad("slug and name are required");
  if (await prisma.cardSet.findUnique({ where: { slug: data.slug } })) return bad("slug already exists");
  const row = await prisma.cardSet.create({ data });
  await audit(g.id, "cardset.create", "cardset", row.id, undefined, row);
  return NextResponse.json({ row });
}
