import { NextResponse } from "next/server";
import { getSessionUser, requestOrigin } from "@/lib/auth";
import { confirmSubscriptionSetup, resumeSubscriptionSetup } from "@/lib/subscriptions";

/* Embedded DivinityCoin card setup → our page. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || ""), sessionId = String(body.sessionId || "");
  if (!subscriptionId) return NextResponse.json({ error: "subscriptionId is required." }, { status: 400 });
  if (body.reopen) {
    try { const r = await resumeSubscriptionSetup(subscriptionId, user.id, false, await requestOrigin()); return NextResponse.json({ ok: true, url: r.url }); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not reopen checkout." }, { status: 400 }); }
  }
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  try {
    const r = await confirmSubscriptionSetup(subscriptionId, user.id, sessionId);
    if (r.ok) return NextResponse.json({ ok: true, status: r.status, redirect: `/account/subscriptions?started=${subscriptionId}` });
    return NextResponse.json({ ok: false, status: r.status, message: r.message }, { status: r.status === "pending" ? 202 : 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not verify the card setup." }, { status: 502 });
  }
}
