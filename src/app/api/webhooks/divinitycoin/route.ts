import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/divinitycoin";
import { processDivinityEvent } from "@/lib/orders";

export const runtime = "nodejs";

/* DivinityCoin → Play Time webhook.
   Configure on DivinityCoin:  https://playtimetcg.com/api/webhooks/divinitycoin
   Header: X-DivinityCoin-Signature: t=<unix>,v1=<hmac-sha256 hex of "<t>.<raw body>">
   Body:   { id, type, created, data: { reference, amount, paymentId, ... } }
   Idempotent on (provider, event id). Always answers 200 for a verified event
   so DivinityCoin doesn't retry forever; processing errors are stored on the
   WebhookEvent row and can be re-run from Admin → Webhooks. */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-divinitycoin-signature") || req.headers.get("x-signature") || req.headers.get("x-webhook-signature");
  const verified = await verifyWebhookSignature(raw, sig);
  if (!verified.ok) {
    console.warn("divinitycoin webhook rejected:", verified.reason);
    return NextResponse.json({ error: `invalid signature: ${verified.reason}` }, { status: 401 });
  }

  let evt: { id?: string; type?: string; event?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const type = String(evt.type || evt.event || "");
  const id = String(evt.id || `${type}:${JSON.stringify(evt.data ?? {}).slice(0, 200)}`);
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

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
