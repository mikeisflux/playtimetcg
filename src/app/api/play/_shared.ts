/* Server helpers shared by the /api/play routes and the /play pages. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasOnlineAccess } from "@/lib/packs";
import { ceilingFor, reduce, type GameCardRef, type GameState, type Phase } from "@/lib/game";
import type { GameRoom, User } from "@/generated/prisma/client";
import type { CollectionItem, PackItem } from "@/components/play/types";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function requirePlayer(): Promise<{ user: User; res?: undefined } | { user?: undefined; res: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { res: fail("Sign in to play.", 401) };
  if (!(await hasOnlineAccess(user.id))) return { res: fail("Your account doesn’t have online play yet.", 403) };
  return { user };
}

export const asState = (j: unknown): GameState => j as GameState;
export const toJson = (s: GameState) => JSON.parse(JSON.stringify(s));

export function statusFor(phase: Phase): string {
  return phase === "ended" ? "ended" : phase === "lobby" ? "waiting" : "playing";
}

export const isParticipant = (room: GameRoom, userId: string) => room.hostId === userId || room.guestId === userId;

export const isUniqueError = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/* Add a second player. Returns the updated room or a human error message. */
export async function joinRoom(room: GameRoom, user: { id: string; name: string }): Promise<{ ok: true; room: GameRoom } | { ok: false; error: string }> {
  if (isParticipant(room, user.id)) return { ok: true, room };
  if (room.status === "ended") return { ok: false, error: "That night is over." };
  if (room.guestId) return { ok: false, error: "That room is full." };
  const state = asState(room.state);
  let next: GameState;
  try { next = reduce(state, { type: "join", userId: user.id, name: user.name }); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn’t join." }; }
  const r = await prisma.gameRoom.updateMany({
    where: { id: room.id, version: room.version, guestId: null },
    data: { guestId: user.id, state: toJson(next), version: { increment: 1 }, status: statusFor(next.phase) },
  });
  if (r.count === 0) return { ok: false, error: "Someone else joined first." };
  const fresh = await prisma.gameRoom.findUnique({ where: { id: room.id } });
  return fresh ? { ok: true, room: fresh } : { ok: false, error: "Room vanished." };
}

/* The roller's playable cards for the current night: their collection, under
   the shared ceiling, minus both players' vetoes and anything already drawn. */
export async function playablePool(state: GameState): Promise<GameCardRef[]> {
  const roller = state.players[state.rollerIndex];
  if (!roller) return [];
  const vetoed = new Set(state.players.flatMap((p) => p.vetoes));
  const drawn = new Set(state.drawn);
  const owned = await prisma.userCard.findMany({
    where: { userId: roller.userId, card: { active: true, spice: { lte: ceilingFor(state) } } },
    include: { card: true },
  });
  return owned
    .map((o) => o.card)
    .filter((c) => !vetoed.has(c.code) && !drawn.has(c.code))
    .map((c) => ({ code: c.code, title: c.title, category: c.category, rarity: c.rarity, spice: c.spice, time: c.time, text: c.text, art: c.imageUrl ? `/api/cards/art/${c.code}` : null }));
}

export function countByCategory(pool: GameCardRef[], exclude: Set<string> = new Set()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of pool) if (!exclude.has(c.code)) out[c.category] = (out[c.category] ?? 0) + 1;
  return out;
}

export function sample<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export async function collectionFor(userId: string): Promise<CollectionItem[]> {
  const rows = await prisma.userCard.findMany({
    where: { userId, card: { active: true } },
    include: { card: { include: { set: true } } },
    orderBy: [{ card: { set: { sortIndex: "asc" } } }, { card: { sortIndex: "asc" } }, { card: { code: "asc" } }],
  });
  return rows.map((r) => ({
    id: r.id, code: r.card.code, title: r.card.title, category: r.card.category, rarity: r.card.rarity, spice: r.card.spice,
    time: r.card.time, text: r.card.text, qty: r.qty, setName: r.card.set.name, setSlug: r.card.set.slug, source: r.source, imageUrl: r.card.imageUrl,
  }));
}

export async function listPacks(userId: string): Promise<PackItem[]> {
  const rows = await prisma.userPack.findMany({
    where: { userId, qty: { gt: 0 } },
    include: { set: true, product: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id, setName: p.set.name, setSlug: p.set.slug, accent: p.set.accent, size: p.size, qty: p.qty, productName: p.product?.name ?? null,
  }));
}
