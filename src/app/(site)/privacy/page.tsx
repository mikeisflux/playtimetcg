import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/privacy", {
    title: "Privacy Policy | Play Time",
    description: "How Play Time collects, uses and protects your information.",
    keywords: ["Play Time Privacy", "Privacy Policy"],
    noindex: false,
  });
}

export default async function PrivacyPage() {
  return <ContentPage slug="privacy" fallbackTitle="Privacy" />;
}
