import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/returns", {
    title: "Returns | Play Time",
    description: "How to return or exchange a Play Time order.",
    keywords: ["Play Time Returns", "Returns"],
    noindex: false,
  });
}

export default async function ReturnsPage() {
  return <ContentPage slug="returns" fallbackTitle="Returns" />;
}
