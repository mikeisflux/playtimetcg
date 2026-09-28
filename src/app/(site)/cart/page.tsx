import type { Metadata } from "next";
import CartPage from "@/components/CartPage";
import { buildMetadata } from "@/lib/seo";
import { getSettings, flag } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/cart", { title: "Your cart", noindex: true });
}

export default async function Cart() {
  const s = await getSettings(["DISCREET_PACKAGING"]);
  return (
    <section className="wrap section" data-screen-label="Cart">
      <div className="stack gap-12" style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Cart</div>
        <h1 className="t-h2">Your cart</h1>
      </div>
      <CartPage discreet={flag(s.DISCREET_PACKAGING)} />
    </section>
  );
}
