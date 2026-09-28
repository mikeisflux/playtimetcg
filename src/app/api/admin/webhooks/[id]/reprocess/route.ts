import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { processDivinityEvent } from "@/lib/orders";
import { guard, bad, notFound } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const ev = await prisma.webhookEvent.findUnique({ where: { id } });
  if (!ev) return notFound();
  if (ev.provider !== "divinitycoin") return bad("Only DivinityCoin events can be reprocessed.");
  const payload = (ev.payload ?? {}) as Record<string, unknown>;
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  try {
    const r = await processDivinityEvent({ id: ev.eventId, type: ev.type, data });
    const row = await prisma.webhookEvent.update({ where: { id }, data: { status: r.status, error: r.note ?? null, processedAt: new Date() } });
    await audit(g.id, "webhook.reprocess", "webhook_event", id, { status: ev.status }, { status: row.status, note: r.note });
    return NextResponse.json({ ok: true, result: r });
  } catch (err) {
    const error = String((err as Error).message || err).slice(0, 1000);
    await prisma.webhookEvent.update({ where: { id }, data: { status: "failed", error, processedAt: new Date() } });
    await audit(g.id, "webhook.reprocess", "webhook_event", id, { status: ev.status }, { status: "failed", error });
    return bad(error, 500);
  }
}
