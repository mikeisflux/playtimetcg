import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { RampStrip } from "@/components/ui";

export const dynamic = "force-dynamic";

/* Admin-managed redirects (Admin → SEO → Redirects) are applied here, so a
   retired URL 301s instead of 404ing. */
export default async function NotFound() {
  try {
    const h = await headers();
    const raw = h.get("x-invoke-path") || h.get("next-url") || h.get("x-matched-path") || "";
    const path = raw ? new URL(raw, "http://x").pathname.replace(/\/+$/, "") || "/" : "";
    if (path) {
      const r = await prisma.redirect.findUnique({ where: { fromPath: path } });
      if (r) redirect(r.toPath);
    }
  } catch { /* fall through to the 404 */ }
  return (
    <>
      <RampStrip h={4} />
      <main className="wrap section stack gap-28" style={{ minHeight: "70vh", maxWidth: 720 }}>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>404</div>
        <h1 className="t-h2">That card isn’t in the deck.</h1>
        <p className="t-lead">The page you’re after has moved or never existed. Roll again.</p>
        <div className="row"><Link className="btn" href="/">Home</Link><Link className="btn btn--outline" href="/shop">Shop</Link></div>
      </main>
    </>
  );
}
