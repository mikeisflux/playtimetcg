import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { guard, pageParams, paged } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "";
  const where: Prisma.GameRoomWhereInput = status ? { status } : {};
  const { page, size, skip, take } = pageParams(url);
  const [total, rows] = await Promise.all([
    prisma.gameRoom.count({ where }),
    prisma.gameRoom.findMany({ where, skip, take, orderBy: { updatedAt: "desc" }, include: { host: { select: { id: true, name: true, email: true } }, guest: { select: { id: true, name: true, email: true } } } }),
  ]);
  const out = rows.map((r) => {
    const st = (r.state ?? {}) as Record<string, unknown>;
    const { state: _s, ...rest } = r; void _s;
    return { ...rest, turn: st.turn ?? st.currentTurn ?? st.activePlayer ?? null, round: st.round ?? null, phase: st.phase ?? null };
  });
  return NextResponse.json(paged(out, total, page, size));
}
