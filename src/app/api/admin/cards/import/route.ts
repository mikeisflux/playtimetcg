import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, parseCsv } from "../../_lib";
import { cardData } from "../_shape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* CSV columns: code,set,title,category,rarity,spice,time,text[,imageUrl,active] — upsert by code.
   Accepts JSON {csv} or multipart with a `file` field. */
export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  let csv = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    csv = f instanceof File ? await f.text() : String(fd.get("csv") || "");
  } else {
    csv = String(((await req.json().catch(() => ({}))) as { csv?: string }).csv || "");
  }
  const rows = parseCsv(csv);
  if (rows.length < 2) return bad("CSV needs a header row and at least one card.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  for (const need of ["code", "set", "title"]) if (col(need) < 0) return bad(`Missing column: ${need}`);
  const sets = new Map((await prisma.cardSet.findMany()).map((s) => [s.slug, s.id]));
  let created = 0, updated = 0;
  const errors: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (n: string) => { const c = col(n); return c >= 0 ? (r[c] ?? "").trim() : ""; };
    const setSlug = get("set").toLowerCase();
    let setId = sets.get(setSlug);
    if (!setId) {
      if (!setSlug) { errors.push(`row ${i + 1}: no set`); continue; }
      const s = await prisma.cardSet.create({ data: { slug: setSlug, name: setSlug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), kind: setSlug === "base" ? "base" : "expansion" } });
      sets.set(setSlug, s.id); setId = s.id;
    }
    const data = cardData({ code: get("code"), setId, title: get("title"), category: get("category"), rarity: get("rarity"), spice: get("spice"), time: get("time"), text: get("text"), imageUrl: get("imageurl") || undefined, active: get("active") ? get("active") : true, sortIndex: i });
    if (!data.code || !data.title) { errors.push(`row ${i + 1}: code/title missing`); continue; }
    const existing = await prisma.card.findUnique({ where: { code: data.code } });
    if (existing) { await prisma.card.update({ where: { id: existing.id }, data: { ...data, imageUrl: data.imageUrl ?? existing.imageUrl } }); updated++; }
    else { await prisma.card.create({ data }); created++; }
  }
  await audit(g.id, "card.import", "card", null, undefined, { created, updated, errors: errors.length });
  return NextResponse.json({ created, updated, errors });
}
