import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, readJson, str, optStr, bool } from "../../_lib";
import { SAMPLE_VARS } from "./_defaults";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const rows = await prisma.emailTemplate.findMany({ orderBy: { slug: "asc" }, include: { _count: { select: { versions: true } } } });
  return NextResponse.json({ rows, sampleVars: SAMPLE_VARS });
}

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson(req);
  const slug = str(b.slug, 60).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  const name = str(b.name, 120).trim();
  if (!slug || !name) return bad("slug and name are required");
  if (await prisma.emailTemplate.findUnique({ where: { slug } })) return bad("slug already exists");
  const row = await prisma.emailTemplate.create({ data: { slug, name, description: optStr(b.description, 500), subject: str(b.subject, 300) || name, html: str(b.html, 200_000) || "<p>Hello {{name}},</p>", text: optStr(b.text, 50_000), isActive: b.isActive === undefined ? true : bool(b.isActive) } });
  await audit(g.id, "template.create", "email_template", row.id, undefined, { slug });
  return NextResponse.json({ row });
}
