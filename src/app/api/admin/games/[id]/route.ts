import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, notFound, readJson } from "../../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.gameRoom.findUnique({ where: { id }, include: { host: { select: { name: true, email: true } }, guest: { select: { name: true, email: true } } } });
  return row ? NextResponse.json({ row }) : notFound();
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const room = await prisma.gameRoom.findUnique({ where: { id } });
  if (!room) return notFound();
  const b = await readJson<{ action?: string }>(req);
  if (b.action === "end") {
    const st = (room.state ?? {}) as Record<string, unknown>;
    const row = await prisma.gameRoom.update({ where: { id }, data: { status: "ended", version: { increment: 1 }, state: { ...st, status: "ended", endedBy: "admin", endedAt: new Date().toISOString() } } });
    await audit(g.id, "game.end", "game_room", id, { status: room.status }, { status: row.status });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "delete") {
    await prisma.gameRoom.delete({ where: { id } });
    await audit(g.id, "game.delete", "game_room", id, { code: room.code }, undefined);
    return NextResponse.json({ ok: true });
  }
  return bad("Unknown action");
}
