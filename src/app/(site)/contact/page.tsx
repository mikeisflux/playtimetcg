import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";
import Breadcrumbs from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/ui";
import { buildMetadata, jsonLdFor } from "@/lib/seo";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/contact", {
    title: "Contact Us",
    description: "Questions about an order, shipping, returns or the game itself? Send the Play Time team a note. We read everything and reply within 1–2 business days.",
    keywords: ["contact Play Time", "Play Time support", "card game customer service", "order help"],
  });
}

export default async function Contact() {
  const [supportEmail, jsonLd] = await Promise.all([getSetting("SUPPORT_EMAIL"), jsonLdFor("/contact")]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: "Contact", href: "/contact" }]} />
      <section id="top" className="wrap section grid g-380" style={{ gap: "clamp(32px, 5vw, 80px)", alignItems: "start" }} data-screen-label="Contact">
        <div className="stack gap-28">
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "var(--primary)" }}>Contact</div>
            <h1 className="t-h2">Say hello.</h1>
            <p className="t-lead" style={{ marginTop: 8, maxWidth: 480 }}>Questions about an order, a pack, or the game itself? Send us a note. We read everything and reply within 1–2 business days.</p>
          </div>
          <div className="rows rows--rule">
            <div className="stack" style={{ gap: 6, padding: "16px 0" }}>
              <div className="label">Orders and shipping</div>
              <div className="t-body-sm">Include your order number and we can look it up straight away. See <Link href="/shipping">Shipping</Link> and <Link href="/returns">Returns</Link> for the basics.</div>
            </div>
            <div className="stack" style={{ gap: 6, padding: "16px 0" }}>
              <div className="label">The game</div>
              <div className="t-body-sm">Rules questions usually have an answer on <Link href="/how-to-play">How to play</Link> or the <Link href="/faq">FAQ</Link>. If not, ask away.</div>
            </div>
            {supportEmail && (
              <div className="stack" style={{ gap: 6, padding: "16px 0" }}>
                <div className="label">Prefer email?</div>
                <div className="t-body-sm"><a href={`mailto:${supportEmail}`}>{supportEmail}</a></div>
              </div>
            )}
          </div>
        </div>
        <ContactForm />
      </section>
    </>
  );
}
