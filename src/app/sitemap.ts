import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SITE_ROUTES, isPrivatePath } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* lastModified must not be "now": a date that changes on every crawl is
   ignored. The build stamp changes only on deploy; products and Pages carry
   their own updatedAt; SEO overrides carry theirs. Every database read is
   wrapped so the sitemap still renders (static routes only) when the DB is
   unreachable, e.g. during a build. */
const BUILT = (() => {
  const m = (process.env.NEXT_PUBLIC_PT_BUILD || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return new Date(`${m ? m[1] : new Date().toISOString().slice(0, 10)}T00:00:00Z`);
})();

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];
const later = (...d: (Date | null | undefined)[]) => d.reduce<Date>((a, b) => (b && b > a ? b : a), BUILT);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ((await getSetting("SITE_URL")) || "https://playtimetcg.com").replace(/\/$/, "");
  let overrides = new Map<string, { priority: number | null; changeFreq: string | null; robots: string | null; updatedAt: Date }>();
  let products: { slug: string; updatedAt: Date }[] = [];
  let pages = new Map<string, { slug: string; updatedAt: Date }>();
  try {
    const [seo, prods, pgs] = await Promise.all([
      prisma.seoEntry.findMany({ select: { path: true, priority: true, changeFreq: true, robots: true, updatedAt: true } }),
      prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true }, orderBy: { sortIndex: "asc" } }),
      prisma.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    ]);
    overrides = new Map(seo.map((s) => [s.path, s]));
    products = prods;
    pages = new Map(pgs.map((p) => [`/${p.slug}`, p]));
  } catch { /* db not ready: static routes only */ }

  const hidden = (path: string) => { const o = overrides.get(path); return isPrivatePath(path) || !!(o?.robots && /noindex/i.test(o.robots)); };
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  for (const r of SITE_ROUTES) {
    if (hidden(r.path)) continue;
    const o = overrides.get(r.path); const pg = pages.get(r.path);
    seen.add(r.path);
    entries.push({
      url: `${base}${r.path === "/" ? "" : r.path}`,
      lastModified: later(o?.updatedAt, pg?.updatedAt),
      changeFrequency: (o?.changeFreq as Freq) || r.changeFreq,
      priority: o?.priority ?? r.priority,
    });
  }
  for (const p of products) {
    const path = `/shop/${p.slug}`;
    if (hidden(path) || seen.has(path)) continue;
    seen.add(path);
    const o = overrides.get(path);
    entries.push({ url: `${base}${path}`, lastModified: later(o?.updatedAt, p.updatedAt), changeFrequency: (o?.changeFreq as Freq) || "weekly", priority: o?.priority ?? 0.8 });
  }
  /* Published Page rows without a hard-coded route (privacy, terms, shipping,
     returns and faq already have one; anything else the owner adds shows up
     here as long as a route serves it). */
  for (const [path, pg] of pages) {
    if (hidden(path) || seen.has(path)) continue;
    seen.add(path);
    const o = overrides.get(path);
    entries.push({ url: `${base}${path}`, lastModified: later(o?.updatedAt, pg.updatedAt), changeFrequency: (o?.changeFreq as Freq) || "yearly", priority: o?.priority ?? 0.3 });
  }
  return entries;
}
