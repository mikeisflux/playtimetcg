import { notFound, redirect } from "next/navigation";
import { getSessionUser, requestOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startCheckout } from "@/lib/orders";

/* Re-open DivinityCoin checkout for an unpaid order from the account page. */
export default async function Resume({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: id } = await searchParams;
  const user = await getSessionUser();
  if (!user || !id) redirect("/account/orders");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || (o.userId !== user.id && o.email !== user.email)) notFound();
  if (!["pending", "awaiting_payment", "failed"].includes(o.status)) redirect(`/account/orders/${o.id}`);
  let url = `/account/orders/${o.id}`;
  try { url = (await startCheckout(o.id, { origin: await requestOrigin() })).url; } catch { /* fall back to the order page */ }
  redirect(url);
}
