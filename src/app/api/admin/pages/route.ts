import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, readJson, str, bool } from "../_lib";
import { PAGE_PRESETS } from "./_presets";

export const dynamic = "force-dynamic";


export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const rows = await prisma.page.findMany({ orderBy: { slug: "asc" } });
  return NextResponse.json({ rows, presets: Object.keys(PAGE_PRESETS).filter((k) => !rows.some((r) => r.slug === k)) });
}

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson(req);
  const slug = str(b.slug, 80).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return bad("slug is required");
  if (await prisma.page.findUnique({ where: { slug } })) return bad("slug already exists");
  const preset = PAGE_PRESETS[slug];
  const row = await prisma.page.create({ data: { slug, title: str(b.title, 200).trim() || preset?.title || slug, html: str(b.html, 500_000) || preset?.html || "<p></p>", published: b.published === undefined ? true : bool(b.published) } });
  await audit(g.id, "page.create", "page", row.id, undefined, { slug });
  return NextResponse.json({ row });
}
