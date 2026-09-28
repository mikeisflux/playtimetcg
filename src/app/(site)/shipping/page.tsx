import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/shipping", {
    title: "Shipping",
    description: "How and when Play Time orders ship, what it costs, free-shipping thresholds and the plain, discreet packaging every order goes out in.",
    keywords: ["Play Time Shipping", "Shipping"],
    noindex: false,
  });
}

export default async function ShippingPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Shipping", href: "/shipping" }]} />
      <ContentPage slug="shipping" fallbackTitle="Shipping" next={[["Returns", "/returns"], ["Shop", "/shop"]]} />
    </>
  );
}
