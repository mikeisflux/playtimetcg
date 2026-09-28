import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings(["SITE_URL", "SITE_NAME", "SEO_DEFAULT_TITLE", "SEO_TITLE_TEMPLATE", "SEO_DEFAULT_DESCRIPTION", "SEO_OG_IMAGE"]);
  const name = s.SITE_NAME || "Play Time";
  return {
    metadataBase: new URL(s.SITE_URL || "https://playtimetcg.com"),
    title: {
      default: s.SEO_DEFAULT_TITLE || `${name} — The Card Game for Couples (18+)`,
      template: s.SEO_TITLE_TEMPLATE || `%s | ${name}`,
    },
    description: s.SEO_DEFAULT_DESCRIPTION || "72 cards, one 12-sided die, and a better night than the one you were planning. An adult card game for couples, written by a practicing sex therapist.",
    applicationName: name,
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
    openGraph: { type: "website", siteName: name, images: [{ url: s.SEO_OG_IMAGE || "/og.png", width: 1200, height: 630, alt: name }] },
    twitter: { card: "summary_large_image", images: [s.SEO_OG_IMAGE || "/og.png"] },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0d0b10",
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
