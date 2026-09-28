import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountNav from "@/components/AccountNav";
import AccountSettings from "@/components/AccountSettings";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/settings");
  const addresses = await prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return (
    <section className="wrap section">
      <AccountNav current="/account/settings" name={user.name} />
      <AccountSettings user={{ name: user.name, email: user.email, marketingOptIn: user.marketingOptIn }}
        addresses={addresses.map((a) => ({ id: a.id, name: a.name, line1: a.line1, line2: a.line2 ?? "", city: a.city, region: a.region, postal: a.postal, country: a.country, phone: a.phone ?? "", isDefault: a.isDefault }))} />
    </section>
  );
}
