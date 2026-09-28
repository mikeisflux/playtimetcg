import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/shipping", {
    title: "Shipping | Play Time",
    description: "How and when Play Time orders ship, and what it costs.",
    keywords: ["Play Time Shipping", "Shipping"],
    noindex: false,
  });
}

export default async function ShippingPage() {
  return <ContentPage slug="shipping" fallbackTitle="Shipping" />;
}
