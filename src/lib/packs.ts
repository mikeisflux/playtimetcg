/* Digital packs: grant, open, and starter-deck logic. */
import { prisma } from "./db";
import { getSetting, flag } from "./settings";
import type { Card } from "@/generated/prisma/client";

export interface OpenedCard {
  code: string; title: string; rarity: string; category: string; spice: number; time: string; text: string; isNew: boolean; art: string | null;
}

async function weights(): Promise<Record<string, number>> {
  const raw = (await getSetting("PACK_RARITY_WEIGHTS")) || "common:70,uncommon:25,rare:5";
  const out: Record<string, number> = { common: 70, uncommon: 25, rare: 5 };
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":").map((x) => x.trim().toLowerCase());
    if (k && v && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return out;
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function rollRarity(w: Record<string, number>): "Common" | "Uncommon" | "Rare" {
  const total = w.common + w.uncommon + w.rare;
  let r = Math.random() * total;
  if ((r -= w.common) < 0) return "Common";
  if ((r -= w.uncommon) < 0) return "Uncommon";
  return "Rare";
}

/* Draw `size` cards from a set with rarity weighting. Duplicates are allowed
   (that's what a collection's qty is for) but we avoid dupes inside one pack
   when the pool is big enough. */
export async function drawPack(setId: string, size: number): Promise<Card[]> {
  const pool = await prisma.card.findMany({ where: { setId, active: true } });
  if (!pool.length) return [];
  const w = await weights();
  const guarantee = flag(await getSetting("PACK_GUARANTEE_UNCOMMON"), true);
  const byRarity: Record<string, Card[]> = { Common: [], Uncommon: [], Rare: [] };
  for (const c of pool) (byRarity[c.rarity] ?? byRarity.Common).push(c);
  const out: Card[] = [];
  const used = new Set<string>();
  for (let i = 0; i < size; i++) {
    let rarity = rollRarity(w);
    if (guarantee && i === size - 1 && !out.some((c) => c.rarity !== "Common") && byRarity.Uncommon.length) rarity = "Uncommon";
    let candidates = byRarity[rarity].filter((c) => !used.has(c.id));
    if (!candidates.length) candidates = pool.filter((c) => !used.has(c.id));
    if (!candidates.length) candidates = pool;
    const c = pick(candidates);
    used.add(c.id);
    out.push(c);
  }
  return out;
}

export async function grantCards(userId: string, cards: Card[], source: string): Promise<OpenedCard[]> {
  const owned = await prisma.userCard.findMany({ where: { userId, cardId: { in: cards.map((c) => c.id) } }, select: { cardId: true } });
  const ownedSet = new Set(owned.map((o) => o.cardId));
  const seen = new Set<string>();
  const result: OpenedCard[] = [];
  for (const c of cards) {
    const isNew = !ownedSet.has(c.id) && !seen.has(c.id);
    seen.add(c.id);
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId, cardId: c.id } },
      update: { qty: { increment: 1 } },
      create: { userId, cardId: c.id, qty: 1, source },
    });
    result.push({ code: c.code, title: c.title, rarity: c.rarity, category: c.category, spice: c.spice, time: c.time, text: c.text, isNew, art: c.imageUrl ? `/api/cards/art/${c.code}` : null });
  }
  return result;
}

/* Everyone who subscribes to online play starts with the full base deck. */
export async function grantStarterDeck(userId: string): Promise<number> {
  const slug = (await getSetting("STARTER_SET_SLUG")) || "base";
  const set = await prisma.cardSet.findUnique({ where: { slug } });
  if (!set) return 0;
  const cards = await prisma.card.findMany({ where: { setId: set.id, active: true } });
  let granted = 0;
  for (const c of cards) {
    const r = await prisma.userCard.upsert({
      where: { userId_cardId: { userId, cardId: c.id } },
      update: {},
      create: { userId, cardId: c.id, qty: 1, source: "starter" },
    });
    if (r.source === "starter" && r.qty === 1) granted++;
  }
  return granted;
}

export async function grantPacks(userId: string, productId: string, qty: number) {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p || !p.cardSetId) return;
  const existing = await prisma.userPack.findFirst({ where: { userId, productId } });
  if (existing) await prisma.userPack.update({ where: { id: existing.id }, data: { qty: { increment: qty } } });
  else await prisma.userPack.create({ data: { userId, productId, setId: p.cardSetId, size: p.packSize ?? 3, qty } });
}

/* Open one pack: consume it, draw, grant, record. */
export async function openPack(userId: string, packId: string) {
  const pack = await prisma.userPack.findFirst({ where: { id: packId, userId }, include: { set: true } });
  if (!pack || pack.qty < 1) throw new Error("You don’t have that pack.");
  const cards = await drawPack(pack.setId, pack.size);
  if (!cards.length) throw new Error("That set has no cards yet.");
  if (pack.qty === 1) await prisma.userPack.delete({ where: { id: pack.id } });
  else await prisma.userPack.update({ where: { id: pack.id }, data: { qty: { decrement: 1 } } });
  const opened = await grantCards(userId, cards, "pack");
  await prisma.packOpening.create({ data: { userId, setSlug: pack.set.slug, cards: JSON.parse(JSON.stringify(opened)) } });
  return { set: pack.set, cards: opened };
}

/* Admins always have online play (for testing) and get the base deck the
   first time they visit. Everyone else needs an online_play subscription. */
export async function hasOnlineAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (user?.isAdmin) {
    const owned = await prisma.userCard.count({ where: { userId } });
    if (owned === 0) await grantStarterDeck(userId);
    return true;
  }
  const sub = await prisma.subscription.findFirst({
    where: { userId, plan: "online_play", status: { in: ["active", "past_due"] } },
    orderBy: { startedAt: "desc" },
  });
  if (!sub) return false;
  if (sub.status === "active") return true;
  /* past_due: grace period of 7 days */
  return !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() + 7 * 86400_000 > Date.now();
}
