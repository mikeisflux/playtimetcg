/* SEO: per-path overrides from Admin → SEO merged over sensible defaults. */
import type { Metadata } from "next";
import { prisma } from "./db";
import { getSettings } from "./settings";

export interface SeoDefaults {
  title: string;
  description?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
}

export async function buildMetadata(path: string, d: SeoDefaults): Promise<Metadata> {
  const s = await getSettings(["SITE_URL", "SITE_NAME", "SEO_TITLE_TEMPLATE", "SEO_DEFAULT_DESCRIPTION", "SEO_DEFAULT_KEYWORDS", "SEO_OG_IMAGE", "SEO_TWITTER_HANDLE", "GOOGLE_SITE_VERIFICATION", "BING_SITE_VERIFICATION"]);
  const base = (s.SITE_URL || "https://playtimetcg.com").replace(/\/$/, "");
  let o: { title?: string | null; description?: string | null; keywords?: string | null; canonical?: string | null; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null; robots?: string | null } | null = null;
  try { o = await prisma.seoEntry.findUnique({ where: { path } }); } catch { /* no db yet */ }

  const title = o?.title || d.title;
  const description = o?.description || d.description || s.SEO_DEFAULT_DESCRIPTION || "72 cards, one 12-sided die, and a better night than the one you were planning. An adult card game for couples, written by a practicing sex therapist.";
  const keywords = o?.keywords ? o.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : (d.keywords ?? (s.SEO_DEFAULT_KEYWORDS ? s.SEO_DEFAULT_KEYWORDS.split(",").map((k) => k.trim()) : undefined));
  const image = o?.ogImage || d.image || s.SEO_OG_IMAGE || "/og.png";
  const robotsStr = o?.robots || (d.noindex ? "noindex,nofollow" : "index,follow");
  const index = !/noindex/i.test(robotsStr);
  const canonical = o?.canonical || `${base}${path === "/" ? "" : path}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: { index, follow: !/nofollow/i.test(robotsStr) },
    openGraph: {
      type: d.type ?? "website",
      siteName: s.SITE_NAME || "Play Time",
      title: o?.ogTitle || title,
      description: o?.ogDescription || description,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: s.SITE_NAME || "Play Time" }],
    },
    twitter: {
      card: "summary_large_image",
      title: o?.ogTitle || title,
      description: o?.ogDescription || description,
      images: [image],
      ...(s.SEO_TWITTER_HANDLE ? { site: s.SEO_TWITTER_HANDLE } : {}),
    },
    ...(s.GOOGLE_SITE_VERIFICATION || s.BING_SITE_VERIFICATION ? {
      verification: {
        ...(s.GOOGLE_SITE_VERIFICATION ? { google: s.GOOGLE_SITE_VERIFICATION } : {}),
        ...(s.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": s.BING_SITE_VERIFICATION } } : {}),
      },
    } : {}),
  };
}

export async function jsonLdFor(path: string): Promise<string | null> {
  try {
    const o = await prisma.seoEntry.findUnique({ where: { path }, select: { jsonLd: true } });
    return o?.jsonLd || null;
  } catch { return null; }
}

/* Public routes for the sitemap and the SEO manager's page list. */
export const SITE_ROUTES: { path: string; label: string; priority: number; changeFreq: "weekly" | "monthly" | "yearly" | "daily" }[] = [
  { path: "/", label: "Home", priority: 1, changeFreq: "weekly" },
  { path: "/how-to-play", label: "How to play", priority: 0.9, changeFreq: "monthly" },
  { path: "/the-deck", label: "The deck", priority: 0.9, changeFreq: "monthly" },
  { path: "/expansions", label: "Expansions", priority: 0.9, changeFreq: "monthly" },
  { path: "/pricing", label: "Pricing", priority: 0.9, changeFreq: "monthly" },
  { path: "/shop", label: "Shop", priority: 0.95, changeFreq: "weekly" },
  { path: "/play", label: "Play online", priority: 0.8, changeFreq: "monthly" },
  { path: "/faq", label: "FAQ", priority: 0.7, changeFreq: "monthly" },
  { path: "/contact", label: "Contact", priority: 0.5, changeFreq: "yearly" },
  { path: "/shipping", label: "Shipping", priority: 0.3, changeFreq: "yearly" },
  { path: "/returns", label: "Returns", priority: 0.3, changeFreq: "yearly" },
  { path: "/privacy", label: "Privacy", priority: 0.2, changeFreq: "yearly" },
  { path: "/terms", label: "Terms", priority: 0.2, changeFreq: "yearly" },
];
