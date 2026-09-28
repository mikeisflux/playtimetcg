import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/content";
import { hasOnlineAccess } from "@/lib/packs";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "tag", awaiting_payment: "tag tag--warn", paid: "tag tag--ok", fulfilled: "tag tag--ok", shipped: "tag tag--ok", cancelled: "tag", refunded: "tag tag--bad", failed: "tag tag--bad" };

export default async function Account() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const [orders, subs, cards, packs, online] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
    prisma.subscription.findMany({ where: { userId: user.id, status: { in: ["active", "past_due"] } } }),
    prisma.userCard.count({ where: { userId: user.id } }),
    prisma.userPack.aggregate({ where: { userId: user.id }, _sum: { qty: true } }),
    hasOnlineAccess(user.id),
  ]);
  const spent = await prisma.order.aggregate({ where: { userId: user.id, status: { in: ["paid", "fulfilled", "shipped"] } }, _sum: { totalCents: true } });
  return (
    <section className="wrap section" data-screen-label="Account">
      <AccountNav current="/account" name={user.name} />
      <div className="row" style={{ gap: 32, borderTop: "2px solid var(--rule)", paddingTop: 20, marginBottom: 48, alignItems: "flex-start" }}>
        {[[String(orders.length ? await prisma.order.count({ where: { userId: user.id } }) : 0), "Orders"], [money(spent._sum.totalCents ?? 0), "Spent"], [String(subs.length), "Subscriptions"], [String(cards), "Cards owned"], [String(packs._sum.qty ?? 0), "Unopened packs"]].map(([v, l]) => (
          <div key={l} className="stack" style={{ gap: 4 }}><div className="num">{v}</div><div className="label">{l}</div></div>
        ))}
      </div>
      <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
        <div className="stack gap-20">
          <div className="between"><div className="t-item">Recent orders</div><Link href="/account/orders" className="label" style={{ fontSize: 12 }}>All orders</Link></div>
          {orders.length === 0 && <div className="empty"><div className="t-body-sm">No orders yet.</div><Link className="btn" href="/shop" style={{ alignSelf: "flex-start" }}>Go to the shop</Link></div>}
          <div className="stack">
            {orders.map((o) => (
              <Link key={o.id} href={`/account/orders/${o.id}`} className="line" style={{ color: "inherit" }}>
                <div className="stack min0" style={{ flex: 1, gap: 4 }}>
                  <div className="line__name">Order #{o.number}</div>
                  <div className="line__unit">{o.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })} · {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</div>
                </div>
                <span className={STATUS[o.status] ?? "tag"}>{o.status.replace("_", " ")}</span>
                <div className="line__total">{money(o.totalCents)}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="stack gap-20">
          <div className="t-item">Play online</div>
          {online ? (
            <div className="panel panel--surface">
              <div className="tag tag--ok" style={{ alignSelf: "flex-start" }}>Online play active</div>
              <p className="t-body-sm">Your collection has {cards} cards{packs._sum.qty ? ` and ${packs._sum.qty} unopened pack${packs._sum.qty === 1 ? "" : "s"}` : ""}.</p>
              <div className="row"><Link className="btn btn--md" href="/play">Open a room</Link><Link className="btn btn--outline btn--md" href="/play/packs">Open packs</Link></div>
            </div>
          ) : (
            <div className="panel panel--surface">
              <p className="t-body-sm">Subscribe to online play and the full 72-card base deck is yours to play with your partner on any screen.</p>
              <Link className="btn btn--md" href="/shop/online-play" style={{ alignSelf: "flex-start" }}>See online play</Link>
            </div>
          )}
          <div className="t-item" style={{ marginTop: 12 }}>Subscriptions</div>
          {subs.length === 0 && <div className="t-body-sm">None active. <Link href="/shop#subscriptions">See the options</Link>.</div>}
          {subs.map((s) => (
            <div key={s.id} className="line">
              <div className="stack min0" style={{ flex: 1, gap: 4 }}>
                <div className="line__name">{s.plan === "online_play" ? "Online play" : "Monthly 3-card drop"}</div>
                <div className="line__unit">{money(s.priceCents)} / {s.interval}{s.currentPeriodEnd ? ` · renews ${s.currentPeriodEnd.toLocaleDateString("en-US", { dateStyle: "medium" })}` : ""}</div>
              </div>
              <span className={s.status === "active" ? "tag tag--ok" : "tag tag--warn"}>{s.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
