/* Text pages (Privacy, Terms, Shipping, Returns, FAQ). Seeded from
   prisma/pages/*.html and edited in Admin → Pages (stored as HTML in the Page
   table). When no published page exists we say so. */
import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function ContentPage({ slug, fallbackTitle, next = [] }: { slug: string; fallbackTitle: string; next?: [label: string, href: string][] }) {
  let page: { title: string; html: string; published: boolean; updatedAt: Date } | null = null;
  try {
    page = await prisma.page.findUnique({ where: { slug }, select: { title: true, html: true, published: true, updatedAt: true } });
  } catch { page = null; }
  const live = page && page.published ? page : null;

  return (
    <section id="top" className="wrap section" data-screen-label={fallbackTitle}>
      <div className="stack gap-12" style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Play Time</div>
        <h1 className="t-h2">{live?.title || fallbackTitle}</h1>
        {live && <div className="label" style={{ marginTop: 8 }}>Last updated {live.updatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>}
      </div>
      {live ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: live.html }} />
      ) : (
        <div className="prose">
          <p>This page hasn’t been written yet. The owner supplies the legal copy in Admin → Pages.</p>
        </div>
      )}
      {next.length > 0 && (
        <div className="nextup" style={{ marginTop: 48, maxWidth: 760 }}>
          <span className="nextup__label">Related</span>
          {next.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </div>
      )}
    </section>
  );
}
