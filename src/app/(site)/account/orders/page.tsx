import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/content";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Orders() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/orders");
  const orders = await prisma.order.findMany({ where: { OR: [{ userId: user.id }, { email: user.email }] }, orderBy: { createdAt: "desc" }, include: { items: true } });
  return (
    <section className="wrap section">
      <AccountNav current="/account/orders" name={user.name} />
      {orders.length === 0 && <div className="empty"><div className="t-item-md">No orders yet</div><Link className="btn" href="/shop" style={{ alignSelf: "flex-start" }}>Go to the shop</Link></div>}
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Status</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><strong>#{o.number}</strong></td>
                <td>{o.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                <td>{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                <td><span className={["paid", "fulfilled", "shipped"].includes(o.status) ? "tag tag--ok" : ["refunded", "failed"].includes(o.status) ? "tag tag--bad" : "tag"}>{o.status.replace("_", " ")}</span></td>
                <td><strong>{money(o.totalCents)}</strong></td>
                <td><Link href={`/account/orders/${o.id}`}>Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
