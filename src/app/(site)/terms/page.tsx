import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/terms", {
    title: "Terms of Service | Play Time",
    description: "The terms that apply when you use the Play Time site and buy from the store.",
    keywords: ["Play Time Terms", "Terms of Service"],
    noindex: false,
  });
}

export default async function TermsPage() {
  return <ContentPage slug="terms" fallbackTitle="Terms" />;
}
