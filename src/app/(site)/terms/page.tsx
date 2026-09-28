import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/terms", {
    title: "Terms of Service",
    description: "The terms that apply when you use the Play Time site, buy from the store or subscribe to online play. Adults 18+ only.",
    keywords: ["Play Time Terms", "Terms of Service"],
    noindex: false,
  });
}

export default async function TermsPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Terms of Service", href: "/terms" }]} />
      <ContentPage slug="terms" fallbackTitle="Terms" next={[["Privacy", "/privacy"], ["Returns", "/returns"]]} />
    </>
  );
}
