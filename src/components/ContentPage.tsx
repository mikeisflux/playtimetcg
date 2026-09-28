/* Text pages (Privacy, Terms, Shipping, Returns, FAQ). Seeded from
   prisma/pages/*.html and edited in Admin → Pages (stored as HTML in the Page
   table). When no published page exists we say so. */
import { prisma } from "@/lib/db";

export default async function ContentPage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
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
    </section>
  );
}
