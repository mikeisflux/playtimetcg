import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import SubscriptionActions from "@/components/SubscriptionActions";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/content";
import { activeProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Subscriptions", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Subscriptions({ searchParams }: { searchParams: Promise<{ started?: string; cancelled?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/subscriptions");
  const sp = await searchParams;
  const [subs, products] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, include: { invoices: { orderBy: { createdAt: "desc" }, take: 12 } } }),
    activeProducts("subscription"),
  ]);
  const active = new Set(subs.filter((s) => ["active", "past_due"].includes(s.status)).map((s) => s.plan));
  return (
    <section className="wrap section">
      <AccountNav current="/account/subscriptions" name={user.name} />
      {sp.started && <div className="note note--ok" style={{ marginBottom: 24 }}>Thanks — DivinityCoin is confirming your subscription. It activates the moment the payment lands (refresh in a few seconds).</div>}
      {sp.cancelled && <div className="note" style={{ marginBottom: 24 }}>Checkout was cancelled. No charge was made.</div>}
      <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
        <div className="stack gap-20">
          <div className="t-item">Your subscriptions</div>
          {subs.length === 0 && <div className="t-body-sm">None yet.</div>}
          {subs.map((s) => (
            <div key={s.id} className="panel panel--surface">
              <div className="between">
                <div className="t-item-md">{s.plan === "online_play" ? "Online play" : "Monthly 3-card drop"}</div>
                <span className={s.status === "active" ? "tag tag--ok" : s.status === "past_due" ? "tag tag--warn" : "tag"}>{s.status.replace("_", " ")}</span>
              </div>
              <div className="t-body-sm">{money(s.priceCents)} / {s.interval}
                {s.currentPeriodEnd && s.status === "active" ? ` · ${s.cancelAtPeriodEnd ? "ends" : "renews"} ${s.currentPeriodEnd.toLocaleDateString("en-US", { dateStyle: "medium" })}` : ""}
                {s.status === "past_due" ? " · last payment failed — we’ll retry your card daily for a week" : ""}
              </div>
              {["active", "past_due", "pending"].includes(s.status) && <SubscriptionActions id={s.id} status={s.status} cancelAtPeriodEnd={s.cancelAtPeriodEnd} />}
              {s.invoices.length > 0 && (
                <details>
                  <summary className="label" style={{ cursor: "pointer", fontSize: 12 }}>Billing history</summary>
                  <table className="tbl" style={{ marginTop: 10 }}>
                    <tbody>
                      {s.invoices.map((i) => (
                        <tr key={i.id}><td>{i.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td><td>{money(i.amountCents)}</td><td><span className={i.status === "paid" ? "tag tag--ok" : "tag tag--bad"}>{i.status}</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          ))}
        </div>
        <div className="stack gap-20">
          <div className="t-item">Available</div>
          {products.filter((p) => !active.has(p.subPlan ?? "")).map((p) => (
            <div key={p.id} className="panel">
              <div className="between"><div className="t-item-md">{p.name}</div><div className="price">{money(p.priceCents)}<span className="label" style={{ marginLeft: 6 }}>/ {p.subInterval || "month"}</span></div></div>
              <p className="t-body-sm">{p.description}</p>
              <Link className="btn btn--md" href={`/shop/${p.slug}`} style={{ alignSelf: "flex-start" }}>Subscribe</Link>
            </div>
          ))}
          {products.every((p) => active.has(p.subPlan ?? "")) && <div className="t-body-sm">You’re subscribed to everything we offer. Thank you.</div>}
        </div>
      </div>
    </section>
  );
}
