import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSettings, flag } from "@/lib/settings";
import { signWebhookPayload } from "@/lib/divinitycoin";

/* Test mode only: builds a DivinityCoin-shaped event, signs it with the
   configured webhook secret (or a throwaway one when none is set — then the
   webhook is called with a matching override header) and POSTs it to our own
   /api/webhooks/divinitycoin so the real handler runs end to end. */
export async function POST(req: Request) {
  const s = await getSettings(["DIVINITYCOIN_TEST_MODE", "DIVINITYCOIN_WEBHOOK_SECRET", "SITE_URL"]);
  if (!flag(s.DIVINITYCOIN_TEST_MODE)) return NextResponse.json({ error: "Test mode is off." }, { status: 403 });
  const { reference, amount, kind, outcome } = await req.json();
  if (!reference) return NextResponse.json({ error: "reference required" }, { status: 400 });
  const type = outcome === "failed" ? "payment.failed" : "payment.completed";
  const body = JSON.stringify({
    id: `evt_test_${randomBytes(8).toString("hex")}`,
    type,
    created: new Date().toISOString(),
    data: {
      reference, amount: Number(amount), currency: "USD",
      paymentId: `pay_test_${randomBytes(6).toString("hex")}`,
      ...(kind === "subscription" ? { subscriptionId: `sub_test_${randomBytes(6).toString("hex")}`, currentPeriodEnd: new Date(Date.now() + 31 * 86400_000).toISOString() } : {}),
      ...(outcome === "failed" ? { reason: "Simulated decline" } : {}),
    },
  });
  if (!s.DIVINITYCOIN_WEBHOOK_SECRET) return NextResponse.json({ error: "Set DIVINITYCOIN_WEBHOOK_SECRET in Admin → Settings first (any long random string works in test mode)." }, { status: 400 });
  const sig = signWebhookPayload(body, s.DIVINITYCOIN_WEBHOOK_SECRET);
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/webhooks/divinitycoin`, { method: "POST", headers: { "Content-Type": "application/json", "X-DivinityCoin-Signature": sig }, body });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, webhook: data }, { status: res.ok ? 200 : 502 });
}
