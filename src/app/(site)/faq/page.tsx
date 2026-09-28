import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import Breadcrumbs from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/ui";
import { prisma } from "@/lib/db";
import { buildMetadata, jsonLdFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/faq", {
    title: "FAQ — Questions, Answered",
    description: "How the Play Time couples card game works, who it’s for, the sex therapy behind it, expansions, discreet shipping, returns and privacy. Straight answers.",
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
  const [faqLd, override] = await Promise.all([faqJsonLd(), jsonLdFor("/faq")]);
  return (
    <>
      <JsonLd data={override || faqLd} />
      <Breadcrumbs items={[{ name: "FAQ", href: "/faq" }]} />
      <ContentPage slug="faq" fallbackTitle="Questions, answered." next={[["How to play", "/how-to-play"], ["The deck", "/the-deck"], ["Shop", "/shop"], ["Contact", "/contact"]]} />
    </>
  );
}
