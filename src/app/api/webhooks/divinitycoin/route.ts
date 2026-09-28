import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/divinitycoin";
import { processDivinityEvent } from "@/lib/orders";

export const runtime = "nodejs";

/* DivinityCoin → Play Time webhook.
   Registered on DivinityCoin as the partner webhook URL:
       https://playtimetcg.com/api/webhooks/divinitycoin
   Header: X-Webhook-Signature: t=<unix>,v1=<hmac-sha256 hex of "<t>.<raw body>">
   Body:   { event, timestamp, data: { pledgeId, paymentIntentId, amount(cents), … } }
   DivinityCoin retries up to three times on a non-2xx, so deliveries are
   deduplicated on (provider, event id) derived from the event name and the
   object it concerns. Always answers 200 for a verified event; processing
   errors are stored on the WebhookEvent row and can be re-run from Admin →
   Webhooks. */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-webhook-signature") || req.headers.get("x-divinitycoin-signature") || req.headers.get("x-signature");
  const verified = await verifyWebhookSignature(raw, sig);
  if (!verified.ok) {
    console.warn("divinitycoin webhook rejected:", verified.reason);
    return NextResponse.json({ error: `invalid signature: ${verified.reason}` }, { status: 401 });
  }

  let evt: { id?: string; type?: string; event?: string; timestamp?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const type = String(evt.event || evt.type || "");
  if (!type) return NextResponse.json({ error: "missing event" }, { status: 400 });
  const d = (evt.data ?? {}) as Record<string, unknown>;
  const subject = evt.id || d.disputeId || d.refundId || d.paymentIntentId || d.sessionId || d.setupIntentId || d.pledgeId || evt.timestamp || createHash("sha256").update(raw).digest("hex").slice(0, 24);
  const id = `${type}:${String(subject)}`;

  let row;
  try {
    row = await prisma.webhookEvent.create({ data: { provider: "divinitycoin", eventId: id, type, payload: evt as object } });
  } catch {
    /* duplicate delivery */
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const result = await processDivinityEvent({ id, type, data: (evt.data ?? {}) as Record<string, unknown> });
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { status: result.status, error: result.note ?? null, processedAt: new Date() } });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("divinitycoin webhook", err);
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { status: "failed", error: String(err).slice(0, 1000), processedAt: new Date() } });
    return NextResponse.json({ ok: false, error: "processing failed; stored for retry" }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "divinitycoin webhook", method: "POST" });
}
