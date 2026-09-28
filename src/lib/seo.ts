/* SEO: per-path overrides from Admin → SEO merged over sensible defaults,
   plus the JSON-LD builders the public pages render server-side.
   See docs/SEO.md. */
import type { Metadata } from "next";
import { prisma } from "./db";
import { getSettings } from "./settings";
import type { PublicProduct } from "./catalog";

export interface SeoDefaults {
  title: string;
  /** true: use the title verbatim (no "%s | Play Time" template). */
  absolute?: boolean;
  description?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
}

/* Anything under these prefixes is private: never indexed, never in the
   sitemap, disallowed in robots.txt, whatever the page or the Admin → SEO
   override says. */
export const PRIVATE_PREFIXES = ["/admin", "/api", "/account", "/checkout", "/cart", "/play", "/login", "/signup", "/forgot", "/reset"];
export const isPrivatePath = (path: string) => PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

const DEFAULT_DESCRIPTION = "72 cards, one 12-sided die, and a better night than the one you were planning. An adult card game for couples, written by a practicing sex therapist.";
const SITE_KEYS = ["SITE_URL", "SITE_NAME", "SEO_TITLE_TEMPLATE", "SEO_DEFAULT_DESCRIPTION", "SEO_DEFAULT_KEYWORDS", "SEO_OG_IMAGE", "SEO_TWITTER_HANDLE", "GOOGLE_SITE_VERIFICATION", "BING_SITE_VERIFICATION"];

export const stripSlash = (u: string) => u.replace(/\/$/, "");
export const absUrl = (base: string, u: string) => (/^https?:\/\//i.test(u) ? u : `${stripSlash(base)}${u.startsWith("/") ? "" : "/"}${u}`);

export async function siteBase(): Promise<{ base: string; name: string }> {
  const s = await getSettings(["SITE_URL", "SITE_NAME"]);
  return { base: stripSlash(s.SITE_URL || "https://playtimetcg.com"), name: s.SITE_NAME || "Play Time" };
}

type Override = { title?: string | null; description?: string | null; keywords?: string | null; canonical?: string | null; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null; robots?: string | null };

export async function buildMetadata(path: string, d: SeoDefaults): Promise<Metadata> {
  const s = await getSettings(SITE_KEYS);
  const base = stripSlash(s.SITE_URL || "https://playtimetcg.com");
  const name = s.SITE_NAME || "Play Time";
  let o: Override | null = null;
  try { o = await prisma.seoEntry.findUnique({ where: { path } }); } catch { /* no db yet */ }

  /* A page or override that already ends in " | Play Time" must not get the
     suffix twice from the root template. */
  const suffix = new RegExp(`\\s*[|\u2014-]\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const titleText = (o?.title || d.title).replace(suffix, "").trim() || d.title;
  const title: Metadata["title"] = d.absolute && !o?.title ? { absolute: titleText } : titleText;
  const description = o?.description || d.description || s.SEO_DEFAULT_DESCRIPTION || DEFAULT_DESCRIPTION;
  const keywords = o?.keywords ? o.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : (d.keywords ?? (s.SEO_DEFAULT_KEYWORDS ? s.SEO_DEFAULT_KEYWORDS.split(",").map((k) => k.trim()) : undefined));
  const image = absUrl(base, o?.ogImage || d.image || s.SEO_OG_IMAGE || "/og.png");
  const privatePath = isPrivatePath(path);
  const robotsStr = privatePath ? (path === "/play" ? "noindex,follow" : "noindex,nofollow") : o?.robots || (d.noindex ? "noindex,nofollow" : "index,follow");
  const index = !/noindex/i.test(robotsStr);
  const follow = !/nofollow/i.test(robotsStr);
  const canonical = o?.canonical || `${base}${path === "/" ? "" : path}`;
  const ogTitle = o?.ogTitle || (d.absolute || o?.title ? titleText : `${titleText} | ${name}`);
  const ogDescription = o?.ogDescription || description;

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: { index, follow, googleBot: { index, follow, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: {
      type: d.type ?? "website",
      locale: "en_US",
      siteName: name,
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: `${name} — the card game for couples` }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [image],
      ...(s.SEO_TWITTER_HANDLE ? { site: s.SEO_TWITTER_HANDLE, creator: s.SEO_TWITTER_HANDLE } : {}),
    },
    other: { rating: "adult" },
    ...(s.GOOGLE_SITE_VERIFICATION || s.BING_SITE_VERIFICATION ? {
      verification: {
        ...(s.GOOGLE_SITE_VERIFICATION ? { google: s.GOOGLE_SITE_VERIFICATION } : {}),
        ...(s.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": s.BING_SITE_VERIFICATION } } : {}),
      },
    } : {}),
  };
}

/* Raw JSON-LD override for a path (Admin → SEO). When set it replaces the
   page's default graph; the BreadcrumbList always renders. */
export async function jsonLdFor(path: string): Promise<string | null> {
  try {
    const o = await prisma.seoEntry.findUnique({ where: { path }, select: { jsonLd: true } });
    return o?.jsonLd || null;
  } catch { return null; }
}

/* ───────────── JSON-LD builders (return objects; render with <JsonLd>) ───────────── */

export type Ld = Record<string, unknown>;
export const ldToString = (ld: Ld | Ld[]) => JSON.stringify(ld).replace(/</g, "\\u003c");

export const BRAND = { "@type": "Brand", name: "Play Time" } as const;

export async function organizationLd(): Promise<Ld> {
  const { base, name } = await siteBase();
  const s = await getSettings(["SEO_ORG_JSONLD", "SUPPORT_EMAIL", "SEO_TWITTER_HANDLE"]);
  if (s.SEO_ORG_JSONLD) { try { return JSON.parse(s.SEO_ORG_JSONLD) as Ld; } catch { /* fall through to the default */ } }
  const handle = s.SEO_TWITTER_HANDLE?.replace(/^@/, "");
  return {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${base}/#organization`,
    name: "Divinity Comics Inc", alternateName: name, brand: BRAND, url: base, logo: `${base}/icon-512.png`, image: `${base}/og.png`,
    ...(s.SUPPORT_EMAIL ? { email: s.SUPPORT_EMAIL, contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: s.SUPPORT_EMAIL, url: `${base}/contact` } } : {}),
    ...(handle ? { sameAs: [`https://x.com/${handle}`] } : {}),
  };
}

export async function websiteLd(): Promise<Ld> {
  const { base, name } = await siteBase();
  return {
    "@context": "https://schema.org", "@type": "WebSite", "@id": `${base}/#website`, name, url: base, inLanguage: "en-US",
    isFamilyFriendly: false, publisher: { "@id": `${base}/#organization` },
  };
}

export async function breadcrumbLd(items: { name: string; href: string }[]): Promise<Ld> {
  const { base } = await siteBase();
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absUrl(base, it.href) })),
  };
}

export async function productLd(p: PublicProduct): Promise<Ld> {
  const { base } = await siteBase();
  const url = `${base}/shop/${p.slug}`;
  return {
    "@context": "https://schema.org", "@type": "Product", "@id": `${url}#product`,
    name: p.name, sku: p.slug, url, brand: BRAND, isFamilyFriendly: false,
    description: p.description || [p.tag, p.includes.join(", ")].filter(Boolean).join(". ") || undefined,
    image: p.imageUrl ? [absUrl(base, p.imageUrl)] : [`${base}/og.png`],
    category: p.kind === "expansion" ? "Expansion pack" : p.kind === "subscription" ? "Subscription" : p.kind === "digital_pack" ? "Digital pack" : "Card game",
    audience: { "@type": "PeopleAudience", suggestedMinAge: 18 },
    offers: {
      "@type": "Offer", url, priceCurrency: "USD", price: (p.priceCents / 100).toFixed(2), availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition", seller: { "@id": `${base}/#organization` },
      ...(p.digital ? {} : { hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", merchantReturnLink: `${base}/returns` }, shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" } } }),
    },
  };
}

export async function itemListLd(name: string, path: string, products: PublicProduct[]): Promise<Ld> {
  const { base } = await siteBase();
  return {
    "@context": "https://schema.org", "@type": "ItemList", name, url: `${base}${path}`, numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem", position: i + 1, url: `${base}/shop/${p.slug}`,
      item: { "@type": "Product", name: p.name, sku: p.slug, url: `${base}/shop/${p.slug}`, brand: BRAND, isFamilyFriendly: false, offers: { "@type": "Offer", priceCurrency: "USD", price: (p.priceCents / 100).toFixed(2), availability: "https://schema.org/InStock", url: `${base}/shop/${p.slug}` } },
    })),
  };
}

export async function howToLd(name: string, description: string, steps: { title: string; body: string }[], path: string): Promise<Ld> {
  const { base } = await siteBase();
  return {
    "@context": "https://schema.org", "@type": "HowTo", name, description, url: `${base}${path}`, totalTime: "PT1M",
    tool: [{ "@type": "HowToTool", name: "Play Time base deck (72 cards)" }, { "@type": "HowToTool", name: "12-sided die" }],
    step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body, url: `${base}${path}#how` })),
  };
}

/* Public routes for the sitemap and the SEO manager's page list. Private
   paths (PRIVATE_PREFIXES) are deliberately absent. */
export const SITE_ROUTES: { path: string; label: string; priority: number; changeFreq: "weekly" | "monthly" | "yearly" | "daily" }[] = [
  { path: "/", label: "Home", priority: 1, changeFreq: "weekly" },
  { path: "/how-to-play", label: "How to play", priority: 0.9, changeFreq: "monthly" },
  { path: "/the-deck", label: "The deck", priority: 0.9, changeFreq: "monthly" },
  { path: "/expansions", label: "Expansions", priority: 0.9, changeFreq: "monthly" },
  { path: "/pricing", label: "Pricing", priority: 0.9, changeFreq: "monthly" },
  { path: "/shop", label: "Shop", priority: 0.95, changeFreq: "weekly" },
  { path: "/faq", label: "FAQ", priority: 0.7, changeFreq: "monthly" },
  { path: "/contact", label: "Contact", priority: 0.5, changeFreq: "yearly" },
  { path: "/shipping", label: "Shipping", priority: 0.3, changeFreq: "yearly" },
  { path: "/returns", label: "Returns", priority: 0.3, changeFreq: "yearly" },
  { path: "/privacy", label: "Privacy", priority: 0.2, changeFreq: "yearly" },
  { path: "/terms", label: "Terms", priority: 0.2, changeFreq: "yearly" },
];
