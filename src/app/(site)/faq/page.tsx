import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { prisma } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/faq", {
    title: "FAQ — Questions, answered | Play Time",
    description: "How the Play Time couples card game works, who it's for, the sex therapy behind it, expansions, shipping, returns and privacy.",
    keywords: ["Play Time FAQ", "couples card game questions", "sex therapist card game", "how to play Play Time", "discreet shipping"],
  });
}

/* FAQPage structured data built from the page's own <h3> question / <p> answer
   pairs, so it stays in sync with edits made in Admin → Pages. */
async function faqJsonLd(): Promise<string | null> {
  try {
    const page = await prisma.page.findUnique({ where: { slug: "faq" }, select: { html: true, published: true } });
    if (!page?.published) return null;
    const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const items: { "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } }[] = [];
    const re = /<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h2>|<h3>|$)/g;
    for (const m of page.html.matchAll(re)) {
      const name = strip(m[1]); const text = strip(m[2]);
      if (name && text && !name.includes("[")) items.push({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } });
    }
    return items.length ? JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items }) : null;
  } catch { return null; }
}

export default async function Faq() {
  const jsonLd = await faqJsonLd();
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <ContentPage slug="faq" fallbackTitle="Questions, answered." />
    </>
  );
}
