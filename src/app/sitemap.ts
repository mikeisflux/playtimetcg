import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SITE_ROUTES } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* lastModified must not be "now": a date that changes on every crawl is
   ignored. The build stamp changes only on deploy; products carry their own
   updatedAt; SEO overrides carry theirs. */
const BUILT = (() => {
  const m = (process.env.NEXT_PUBLIC_PT_BUILD || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return new Date(`${m ? m[1] : new Date().toISOString().slice(0, 10)}T00:00:00Z`);
})();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ((await getSetting("SITE_URL")) || "https://playtimetcg.com").replace(/\/$/, "");
  let overrides = new Map<string, { priority: number | null; changeFreq: string | null; robots: string | null; updatedAt: Date }>();
  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    const [seo, prods] = await Promise.all([
      prisma.seoEntry.findMany({ select: { path: true, priority: true, changeFreq: true, robots: true, updatedAt: true } }),
      prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    ]);
    overrides = new Map(seo.map((s) => [s.path, s]));
    products = prods;
  } catch { /* db not ready */ }

  const entries: MetadataRoute.Sitemap = [];
  for (const r of SITE_ROUTES) {
    const o = overrides.get(r.path);
    if (o?.robots && /noindex/i.test(o.robots)) continue;
    entries.push({
      url: `${base}${r.path === "/" ? "" : r.path}`,
      lastModified: o?.updatedAt && o.updatedAt > BUILT ? o.updatedAt : BUILT,
      changeFrequency: (o?.changeFreq as MetadataRoute.Sitemap[number]["changeFrequency"]) || r.changeFreq,
      priority: o?.priority ?? r.priority,
    });
  }
  for (const p of products) {
    const path = `/shop/${p.slug}`;
    const o = overrides.get(path);
    if (o?.robots && /noindex/i.test(o.robots)) continue;
    entries.push({ url: `${base}${path}`, lastModified: o?.updatedAt && o.updatedAt > p.updatedAt ? o.updatedAt : p.updatedAt, changeFrequency: "weekly", priority: o?.priority ?? 0.8 });
  }
  return entries;
}
