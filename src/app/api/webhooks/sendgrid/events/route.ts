import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, string | null> = { delivered: "delivered", open: "opened", click: "clicked", bounce: "bounced", dropped: "bounced", spamreport: "spam", deferred: null, processed: null, unsubscribe: null, group_unsubscribe: null, group_resubscribe: null };
const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4, bounced: 5, spam: 5, failed: 5 };

function keyOk(provided: string | null, expected: string) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface SgEvent { event?: string; sg_event_id?: string; sg_message_id?: string; pt_log_id?: string; email?: string; timestamp?: number; reason?: string; response?: string; url?: string; status?: string; [k: string]: unknown }

export async function POST(req: Request) {
  const expected = await getSetting("SENDGRID_EVENT_KEY");
  if (!keyOk(new URL(req.url).searchParams.get("key"), expected)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let events: SgEvent[];
  try { const body = await req.json(); events = Array.isArray(body) ? body : [body]; } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  let handled = 0, skipped = 0;
  for (const ev of events) {
    if (!ev || typeof ev !== "object" || !ev.event) { skipped++; continue; }
    const eventId = String(ev.sg_event_id || `${ev.sg_message_id || ev.pt_log_id || "x"}-${ev.event}-${ev.timestamp || Date.now()}`);
    const existing = await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: "sendgrid", eventId } } }).catch(() => null);
    if (existing) { skipped++; continue; }
    const rec = await prisma.webhookEvent.create({ data: { provider: "sendgrid", eventId, type: String(ev.event), payload: JSON.parse(JSON.stringify(ev)), status: "received" } });
    try {
      const sgId = ev.sg_message_id ? String(ev.sg_message_id).split(".")[0] : null;
      const msg = (ev.pt_log_id ? await prisma.message.findUnique({ where: { id: String(ev.pt_log_id) } }) : null)
        ?? (sgId ? await prisma.message.findFirst({ where: { OR: [{ sendgridMessageId: sgId }, { sendgridMessageId: { startsWith: sgId } }] } }) : null);
      if (!msg) { await prisma.webhookEvent.update({ where: { id: rec.id }, data: { status: "ignored", error: "no matching message", processedAt: new Date() } }); skipped++; continue; }
      const prev = Array.isArray(msg.events) ? (msg.events as unknown[]) : [];
      const entry = { event: ev.event, at: ev.timestamp ? new Date(Number(ev.timestamp) * 1000).toISOString() : new Date().toISOString(), email: ev.email, reason: ev.reason, response: ev.response, url: ev.url, status: ev.status };
      const next = STATUS[String(ev.event)] ?? null;
      const cur = msg.status || "sent";
      const status = next && (RANK[next] ?? 0) >= (RANK[cur] ?? 0) ? next : cur;
      const statusMessage = ["bounce", "dropped", "deferred", "spamreport"].includes(String(ev.event)) ? String(ev.reason || ev.response || ev.event).slice(0, 500) : msg.statusMessage;
      await prisma.message.update({ where: { id: msg.id }, data: { events: JSON.parse(JSON.stringify([...prev, entry].slice(-100))), status, statusMessage, ...(sgId && !msg.sendgridMessageId ? { sendgridMessageId: sgId } : {}) } });
      await prisma.webhookEvent.update({ where: { id: rec.id }, data: { status: "processed", processedAt: new Date() } });
      handled++;
    } catch (err) {
      await prisma.webhookEvent.update({ where: { id: rec.id }, data: { status: "failed", error: String(err).slice(0, 1000), processedAt: new Date() } });
    }
  }
  return NextResponse.json({ ok: true, handled, skipped });
}
