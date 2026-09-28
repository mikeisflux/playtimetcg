import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import Credits from "@/components/Credits";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { divinitycoin, divinityConfigured } from "@/lib/divinitycoin";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "DivinityCoin credits", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/credits");
  const configured = await divinityConfigured();
  let balance: { available: number; held: number; total: number } | null = null;
  let error = "";
  if (configured) {
    try { balance = await divinitycoin.getBalance(user.id); } catch (e) { error = "DivinityCoin isn’t reachable right now. Try again in a moment."; void e; }
  }
  const ledger = await prisma.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const buyUrl = (await getSetting("DIVINITYCOIN_API_URL")) || "https://divinitycoin.com";
  return (
    <section className="wrap section">
      <AccountNav current="/account/credits" name={user.name} />
      <Credits configured={configured} balance={balance} error={error} buyUrl={buyUrl}
        ledger={ledger.map((l) => ({ id: l.id, type: l.type, amountCents: l.amountCents, description: l.description, createdAt: l.createdAt.toISOString() }))} />
    </section>
  );
}
