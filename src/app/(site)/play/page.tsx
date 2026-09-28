import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasOnlineAccess } from "@/lib/packs";
import { money } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";
import PlayTabs from "@/components/play/PlayTabs";
import Lobby from "@/components/play/Lobby";
import SoloDie from "@/components/play/SoloDie";
import type { RoomSummary } from "@/components/play/types";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/play", {
    title: "Play Online — The Whole Deck, On Any Screen | Play Time",
    description: "Subscribe to online play: your base 72 cards, a digital 12-sided die, and a private room code to share with your partner. Roll, draw, read it out loud, answer.",
    keywords: ["play online", "couples game online", "digital card game for couples", "Play Time online"],
  });
}

const STEPS = [
  { n: "01", col: "#3FD6C8", title: "Subscribe", body: "One plan, one login. Cancel whenever you like." },
  { n: "02", col: "#A68CF5", title: "Your 72 cards are yours", body: "The full base deck lands in your collection the moment you subscribe. Digital packs add to it." },
  { n: "03", col: "#FF5C8A", title: "Invite your partner", body: "Open a room, share the six-letter code. They join from any screen — same bed or different cities." },
  { n: "04", col: "#FFD23F", title: "Roll, draw, read, answer", body: "The d12 picks the mood. Draw a card, read it out loud, then do it, tweak it, save it or pass." },
];

async function subscriptionProduct() {
  try { return await prisma.product.findFirst({ where: { kind: "subscription", subPlan: "online_play", active: true }, orderBy: { sortIndex: "asc" } }); }
  catch { return null; }
}

function Marketing({ signedIn, product }: { signedIn: boolean; product: Awaited<ReturnType<typeof subscriptionProduct>> }) {
  const price = product ? `${money(product.priceCents)}/${product.subInterval === "year" ? "year" : "month"}` : null;
  return (
    <>
      <section className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "end", marginBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="stack gap-28">
          <div className="eyebrow" style={{ color: "var(--primary)" }}>Play online</div>
          <h1 className="t-h2">The whole deck, on any screen.</h1>
          <p className="t-lead" style={{ maxWidth: 520 }}>
            Your base 72 cards, a digital 12-sided die, and a private room only the two of you can enter. Same rules, same heat ceiling, same right to pass — no shipping required.
          </p>
          {signedIn && <p className="note note--err">Your account doesn’t have online play yet. Subscribe below to unlock it.</p>}
          <div className="row">
            {product ? <Link className="btn" href={`/shop/${product.slug}`}>Subscribe — {price}</Link> : <Link className="btn" href="/pricing">See pricing</Link>}
            {!signedIn && <Link className="btn btn--outline" href="/login">Log in</Link>}
          </div>
        </div>
        <div className="panel panel--surface" style={{ gap: 20 }}>
          <div className="label">What you get</div>
          <div className="rows rows--rule">
            {["All 72 base cards in your collection", "A digital d12 you can roll on its own", "Private rooms with a six-letter code", "Ceiling and vetoes, set before the night starts", "Digital packs to grow the deck"].map((x) => (
              <div key={x} style={{ padding: "12px 0", fontSize: 15, color: "var(--text-soft)" }}>{x}</div>
            ))}
          </div>
          {product && (
            <div className="between" style={{ alignItems: "center" }}>
              <div className="stack" style={{ gap: 4 }}>
                <div className="t-item-sm">{product.name}</div>
                {product.tag && <div className="label">{product.tag}</div>}
              </div>
              <div className="price">{price}</div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="stack gap-12" style={{ marginBottom: 40 }}>
          <div className="eyebrow" style={{ color: "#A68CF5" }}>How it works</div>
          <h2 className="t-h2m">Four steps. Then the die decides.</h2>
        </div>
        <div className="grid g-230" style={{ gap: 0, borderTop: "2px solid var(--text)" }}>
          {STEPS.map((st) => (
            <div key={st.n} className="step">
              <div className="step__n" style={{ color: st.col }}>{st.n}</div>
              <div className="t-item">{st.title}</div>
              <div className="t-body">{st.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: "clamp(48px, 6vw, 80px)" }}>
        <SoloDie />
      </section>
    </>
  );
}

export default async function PlayPage() {
  const user = await getSessionUser();
  const access = user ? await hasOnlineAccess(user.id) : false;

  if (!user || !access) {
    const product = await subscriptionProduct();
    return (
      <div className="wrap section--tight" style={{ paddingTop: 32 }}>
        <PlayTabs active="/play" />
        <Marketing signedIn={!!user} product={product} />
      </div>
    );
  }

  const rows = await prisma.gameRoom.findMany({
    where: { status: { not: "ended" }, OR: [{ hostId: user.id }, { guestId: user.id }] },
    include: { host: { select: { name: true } }, guest: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rooms: RoomSummary[] = rows.map((r) => ({
    code: r.code, status: r.status, createdAt: r.createdAt.toISOString(),
    partner: r.hostId === user.id ? r.guest?.name ?? null : r.host.name,
  }));

  return (
    <div className="wrap section--tight" style={{ paddingTop: 32 }}>
      <PlayTabs active="/play" />
      <div className="stack gap-12" style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Play online</div>
        <h1 className="t-h2">Ready when you are, {user.name.split(" ")[0]}.</h1>
        <p className="t-lead" style={{ maxWidth: 560 }}>Open a room and share the code, or join the one your partner sent you.</p>
      </div>
      <Lobby user={{ id: user.id, name: user.name }} rooms={rooms} />
    </div>
  );
}
