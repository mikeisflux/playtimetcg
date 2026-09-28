import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings(["SITE_URL", "SEO_ROBOTS_EXTRA"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  const extra = (s.SEO_ROBOTS_EXTRA || "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/account", "/checkout", "/cart", "/login", "/signup", "/forgot", "/reset", "/play/room/", ...extra] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
