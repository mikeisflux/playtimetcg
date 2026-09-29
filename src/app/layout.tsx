import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

const DEFAULT_DESCRIPTION = "72 cards, one 12-sided die, and a better night than the one you were planning. An adult card game for couples, written by a practicing sex therapist.";

/* Site-wide defaults. Every page overrides these through buildMetadata()
   (src/lib/seo.ts); this layer only guarantees a sane title, description,
   share image and icon set when a route forgets to. */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings(["SITE_URL", "SITE_NAME", "SEO_DEFAULT_TITLE", "SEO_TITLE_TEMPLATE", "SEO_DEFAULT_DESCRIPTION", "SEO_OG_IMAGE"]);
  const name = s.SITE_NAME || "Play Time";
  const image = s.SEO_OG_IMAGE || "/og.png";
  return {
    metadataBase: new URL(s.SITE_URL || "https://playtimetcg.com"),
    title: {
      default: s.SEO_DEFAULT_TITLE || `${name} — The Card Game for Couples (18+)`,
      template: s.SEO_TITLE_TEMPLATE || `%s | ${name}`,
    },
    description: s.SEO_DEFAULT_DESCRIPTION || DEFAULT_DESCRIPTION,
    applicationName: name,
    referrer: "strict-origin-when-cross-origin",
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
        { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: { type: "website", locale: "en_US", siteName: name, images: [{ url: image, width: 3600, height: 1890, alt: `${name} — the card game for couples` }] },
    twitter: { card: "summary_large_image", images: [image] },
    robots: { index: true, follow: true },
    other: { rating: "adult" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0d0b10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
