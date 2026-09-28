import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { SITE_ROUTES } from "@/lib/seo";
import { getSetting } from "@/lib/settings";
import { guard, bad, readJson, str, optStr } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const [products, entries, pages, siteUrl] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true, slug: true, name: true }, orderBy: { sortIndex: "asc" } }),
    prisma.seoEntry.findMany(),
    prisma.page.findMany({ where: { published: true }, select: { slug: true, title: true } }),
    getSetting("SITE_URL"),
  ]);
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const known = new Set<string>();
  const list: { path: string; label: string; kind: string; productId?: string; entry: (typeof entries)[number] | null }[] = [];
  for (const r of SITE_ROUTES) { known.add(r.path); list.push({ path: r.path, label: r.label, kind: "route", entry: byPath.get(r.path) ?? null }); }
  for (const p of products) { const path = `/shop/${p.slug}`; known.add(path); list.push({ path, label: p.name, kind: "product", productId: p.id, entry: byPath.get(path) ?? null }); }
  for (const p of pages) { const path = `/${p.slug}`; if (!known.has(path)) { known.add(path); list.push({ path, label: p.title, kind: "page", entry: byPath.get(path) ?? null }); } }
  for (const e of entries) if (!known.has(e.path)) list.push({ path: e.path, label: e.path, kind: "custom", entry: e });
  const audit_ = list.map((l) => {
    const issues: string[] = [];
    if (!l.entry?.title) issues.push("no title override");
    else if (l.entry.title.length > 60) issues.push(`title ${l.entry.title.length} chars`);
    if (!l.entry?.description) issues.push("no description");
    else if (l.entry.description.length > 160) issues.push(`description ${l.entry.description.length} chars`);
    if (l.entry?.jsonLd) { try { JSON.parse(l.entry.jsonLd); } catch { issues.push("invalid JSON-LD"); } }
    return { path: l.path, issues };
  }).filter((a) => a.issues.length);
  return NextResponse.json({ pages: list, audit: audit_, siteUrl: siteUrl || "https://playtimetcg.com" });
}

/* upsert by path */
export async function PUT(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson(req);
  const path = str(b.path, 300).trim();
  if (!path.startsWith("/")) return bad("path must start with /");
  if (b.jsonLd) { try { JSON.parse(String(b.jsonLd)); } catch { return bad("JSON-LD is not valid JSON"); } }
  const productId = path.startsWith("/shop/") ? (await prisma.product.findUnique({ where: { slug: path.slice(6) }, select: { id: true } }))?.id ?? null : null;
  const data = {
    title: optStr(b.title, 200), description: optStr(b.description, 500), keywords: optStr(b.keywords, 500), canonical: optStr(b.canonical, 500),
    ogTitle: optStr(b.ogTitle, 200), ogDescription: optStr(b.ogDescription, 500), ogImage: optStr(b.ogImage, 500), robots: optStr(b.robots, 60),
    jsonLd: optStr(b.jsonLd, 20_000), priority: b.priority === "" || b.priority === undefined || b.priority === null ? null : Math.min(1, Math.max(0, Number(b.priority) || 0)),
    changeFreq: optStr(b.changeFreq, 20), productId,
  };
  const before = await prisma.seoEntry.findUnique({ where: { path } });
  const row = await prisma.seoEntry.upsert({ where: { path }, update: data, create: { path, ...data } });
  await audit(g.id, "seo.upsert", "seo_entry", row.id, before, row);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const path = new URL(req.url).searchParams.get("path") || "";
  const before = await prisma.seoEntry.findUnique({ where: { path } });
  if (!before) return bad("no entry", 404);
  await prisma.seoEntry.delete({ where: { path } });
  await audit(g.id, "seo.delete", "seo_entry", before.id, before, undefined);
  return NextResponse.json({ ok: true });
}
