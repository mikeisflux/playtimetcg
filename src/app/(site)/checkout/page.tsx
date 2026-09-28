import type { Metadata } from "next";
import Checkout from "@/components/Checkout";
import { buildMetadata } from "@/lib/seo";
import { getSessionUser } from "@/lib/auth";
import { getSettings, flag } from "@/lib/settings";
import { prisma } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/checkout", { title: "Checkout", noindex: true });
}

export default async function CheckoutPage() {
  const [user, s] = await Promise.all([getSessionUser(), getSettings(["DISCREET_PACKAGING"])]);
  let me = null;
  if (user) {
    const addr = await prisma.address.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    me = { id: user.id, email: user.email, name: user.name, address: addr ? { name: addr.name, line1: addr.line1, line2: addr.line2 ?? "", city: addr.city, region: addr.region, postal: addr.postal, country: addr.country, phone: addr.phone ?? "" } : null };
  }
  return (
    <section className="wrap section" data-screen-label="Checkout">
      <div className="stack gap-12" style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Checkout</div>
        <h1 className="t-h2">Almost there.</h1>
      </div>
      <Checkout me={me} discreet={flag(s.DISCREET_PACKAGING)} />
    </section>
  );
}
