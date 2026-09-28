import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, readJson, str, int } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  return NextResponse.json({ rows: await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } }) });
}

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson(req);
  const fromPath = str(b.fromPath, 500).trim(), toPath = str(b.toPath, 1000).trim();
  if (!fromPath.startsWith("/") || !toPath) return bad("fromPath must start with / and toPath is required");
  if (fromPath === toPath) return bad("from and to are the same");
  if (await prisma.redirect.findUnique({ where: { fromPath } })) return bad("A redirect from that path already exists");
  const code = [301, 302, 307, 308].includes(int(b.code, 301)) ? int(b.code, 301) : 301;
  const row = await prisma.redirect.create({ data: { fromPath, toPath, code } });
  await audit(g.id, "redirect.create", "redirect", row.id, undefined, row);
  return NextResponse.json({ row });
}
