import { NextResponse } from "next/server";
import { runRenewals } from "@/lib/subscriptions";
import { audit } from "@/lib/auth";
import { guard } from "../../_lib";

export const dynamic = "force-dynamic";

/* Run the subscription renewal pass now (it also runs every 15 minutes in
   the server, see src/instrumentation.ts). */
export async function POST() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const r = await runRenewals();
  await audit(g.id, "subscriptions.run_renewals", "subscription", null, undefined, r);
  return NextResponse.json({ ok: true, ...r });
}
