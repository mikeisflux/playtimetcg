import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/returns", {
    title: "Returns & Exchanges",
    description: "How to return or exchange a Play Time order, what qualifies, how long you have and how refunds are issued.",
    keywords: ["Play Time Returns", "Returns"],
    noindex: false,
  });
}

export default async function ReturnsPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Returns & Exchanges", href: "/returns" }]} />
      <ContentPage slug="returns" fallbackTitle="Returns" next={[["Shipping", "/shipping"], ["Contact", "/contact"]]} />
    </>
  );
}
