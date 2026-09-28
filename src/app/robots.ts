import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { PRIVATE_PREFIXES } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* robots.txt: public pages are crawlable; carts, checkout, accounts, auth,
   online play, the admin and the API are not. Extra paths come from
   Admin → Settings → SEO_ROBOTS_EXTRA. getSettings() swallows a missing
   database, so this always renders. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings(["SITE_URL", "SEO_ROBOTS_EXTRA"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  const extra = (s.SEO_ROBOTS_EXTRA || "").split(",").map((x) => x.trim()).filter(Boolean);
  const disallow = [...PRIVATE_PREFIXES.map((p) => (p === "/api" ? "/api/" : p)), ...extra];
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/og.png", "/icon-192.png", "/icon-512.png"], disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
