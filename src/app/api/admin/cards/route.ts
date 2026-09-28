import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { guard, bad, readJson, pageParams, paged, toCsv, csvResponse } from "../_lib";
import { cardData } from "./_shape";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const setId = url.searchParams.get("set") || "";
  const category = url.searchParams.get("category") || "";
  const rarity = url.searchParams.get("rarity") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const where: Prisma.CardWhereInput = {
    ...(setId ? { setId } : {}), ...(category ? { category } : {}), ...(rarity ? { rarity } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { text: { contains: q, mode: "insensitive" } }] } : {}),
  };
  if (url.searchParams.get("format") === "csv") {
    const rows = await prisma.card.findMany({ where, include: { set: true }, orderBy: [{ set: { sortIndex: "asc" } }, { sortIndex: "asc" }, { code: "asc" }] });
    return csvResponse("cards.csv", toCsv(["code", "set", "title", "category", "rarity", "spice", "time", "text", "imageUrl", "active"],
      rows.map((c) => [c.code, c.set.slug, c.title, c.category, c.rarity, c.spice, c.time, c.text, c.imageUrl, c.active])));
  }
  const { page, size, skip, take } = pageParams(url, 100);
  const [total, rows] = await Promise.all([
    prisma.card.count({ where }),
    prisma.card.findMany({ where, skip, take, include: { set: { select: { slug: true, name: true } }, _count: { select: { owners: true } } }, orderBy: [{ sortIndex: "asc" }, { code: "asc" }] }),
  ]);
  return NextResponse.json(paged(rows, total, page, size));
}

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const data = cardData(await readJson(req));
  if (!data.code || !data.title || !data.setId) return bad("code, title and set are required");
  if (await prisma.card.findUnique({ where: { code: data.code } })) return bad("code already exists");
  const row = await prisma.card.create({ data });
  await audit(g.id, "card.create", "card", row.id, undefined, row);
  return NextResponse.json({ row });
}
