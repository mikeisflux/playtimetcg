import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasOnlineAccess } from "@/lib/packs";
import { money } from "@/lib/content";
import { toPublic } from "@/lib/catalog";
import { buildMetadata } from "@/lib/seo";
import { listPacks } from "@/app/api/play/_shared";
import AddToCart from "@/components/AddToCart";
import PlayTabs from "@/components/play/PlayTabs";
import PackOpener from "@/components/play/PackOpener";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/play/packs", {
    title: "Digital Packs | Play Time Online",
    description: "Tear open digital packs and add new cards to your online collection.",
    noindex: true,
  });
}

export default async function PacksPage() {
  const user = await getSessionUser();
  const access = user ? await hasOnlineAccess(user.id) : false;
  const [packs, products] = await Promise.all([
    user && access ? listPacks(user.id) : Promise.resolve([]),
    prisma.product.findMany({ where: { kind: "digital_pack", active: true }, orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }] }).catch(() => []),
  ]);

  return (
    <div className="wrap section--tight" style={{ paddingTop: 32 }}>
      <PlayTabs active="/play/packs" />
      <div className="stack gap-12" style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: "#FFD23F" }}>Packs</div>
        <h1 className="t-h2">Tear one open.</h1>
      </div>

      {user && access ? (
        <PackOpener initial={packs} />
      ) : (
        <div className="empty">
          <div className="t-item">Packs need online play.</div>
          <p className="t-body">Subscribe and your base deck is waiting — packs add to it from there.</p>
          <div><Link className="btn" href="/play">{user ? "Get online play" : "Log in"}</Link></div>
        </div>
      )}

      <section style={{ marginTop: "clamp(48px, 6vw, 80px)", borderTop: "2px solid var(--rule)", paddingTop: 40 }}>
        <div className="between" style={{ marginBottom: 28 }}>
          <div className="stack gap-12">
            <div className="eyebrow" style={{ color: "#5AB8F0" }}>Shop</div>
            <h2 className="t-h3">Digital packs</h2>
          </div>
          <div className="note" style={{ maxWidth: 380 }}>Digital packs are added to your account the moment your order is paid.</div>
        </div>
        {products.length === 0 ? (
          <div className="note">No digital packs in the shop right now.</div>
        ) : (
          <div className="grid g-190">
            {products.map((raw) => {
              const p = toPublic(raw);
              return (
                <div key={p.id} className="pack">
                  <div className="pack__band" style={{ background: p.accent }} />
                  <div className="pack__body">
                    <Link href={`/shop/${p.slug}`} className="pack__name" style={{ color: "var(--text-strong)" }}>{p.name}</Link>
                    <div className="pack__hook">{p.tag ?? `${p.packSize ?? 3} cards, drawn with rarity odds. Rares glow.`}</div>
                    <div className="pack__foot">
                      <div className="pack__price">{money(p.priceCents)}</div>
                      <AddToCart product={p} className="btn btn--sm" style={{ "--accent": p.accent } as React.CSSProperties} label="Add" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
