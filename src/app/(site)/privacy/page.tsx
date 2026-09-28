import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/privacy", {
    title: "Privacy Policy",
    description: "How Play Time collects, uses and protects your information, what we store when you order or subscribe, and how to reach us about your data.",
    keywords: ["Play Time Privacy", "Privacy Policy"],
    noindex: false,
  });
}

export default async function PrivacyPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Privacy Policy", href: "/privacy" }]} />
      <ContentPage slug="privacy" fallbackTitle="Privacy" next={[["Terms", "/terms"], ["Contact", "/contact"]]} />
    </>
  );
}
