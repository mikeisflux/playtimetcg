import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasOnlineAccess } from "@/lib/packs";
import { buildMetadata } from "@/lib/seo";
import { collectionFor } from "@/app/api/play/_shared";
import PlayTabs from "@/components/play/PlayTabs";
import Collection from "@/components/play/Collection";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/play/collection", {
    title: "Your Collection | Play Time Online",
    description: "Every card you own, in one place. Filter by category, rarity and set.",
    noindex: true,
  });
}

export default async function CollectionPage() {
  const user = await getSessionUser();
  const access = user ? await hasOnlineAccess(user.id) : false;
  if (!user || !access) {
    return (
      <div className="wrap section--tight" style={{ paddingTop: 32 }}>
        <PlayTabs active="/play/collection" />
        <div className="empty">
          <div className="eyebrow">Collection</div>
          <h1 className="t-h2m">Your collection starts with the base deck the moment you subscribe.</h1>
          <p className="t-body">All 72 base cards, yours to play online. Digital packs add to it.</p>
          <div><Link className="btn" href="/play">{user ? "Get online play" : "Log in"}</Link></div>
        </div>
      </div>
    );
  }

  const [items, baseTotal] = await Promise.all([
    collectionFor(user.id),
    prisma.card.count({ where: { active: true, set: { kind: "base" } } }).catch(() => 0),
  ]);

  return (
    <div className="wrap section--tight" style={{ paddingTop: 32 }}>
      <PlayTabs active="/play/collection" />
      <div className="stack gap-12" style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: "#E86BD8" }}>Collection</div>
        <h1 className="t-h2">Every card you own.</h1>
      </div>
      <Collection items={items} baseTotal={baseTotal || 72} />
    </div>
  );
}
