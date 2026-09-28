/* Product catalog helpers (server). Prices come from the database, seeded
   from design/handoff/content/catalog.json. The $14 expansion price is a
   placeholder the owner has not confirmed — change it in Admin → Products. */
import { prisma } from "./db";
import type { Product } from "@/generated/prisma/client";
import { SAMPLE_CARDS, type CardData, type Category, type Rarity } from "./content";

export type ProductKind = "set" | "kit" | "expansion" | "digital_pack" | "subscription";

export interface PublicProduct {
  id: string; slug: string; kind: string; name: string; tag: string | null; description: string | null;
  priceCents: number; accent: string; includes: string[]; requiresChoice: { type: string; count: number } | null;
  featured: boolean; digital: boolean; imageUrl: string | null; imageSlot: string | null; subPlan: string | null;
  subInterval: string | null; packSize: number | null; cardSetId: string | null;
}

export function toPublic(p: Product): PublicProduct {
  return {
    id: p.id, slug: p.slug, kind: p.kind, name: p.name, tag: p.tag, description: p.description,
    priceCents: p.priceCents, accent: p.accent,
    includes: Array.isArray(p.includes) ? (p.includes as string[]) : [],
    requiresChoice: p.requiresChoice && typeof p.requiresChoice === "object" ? (p.requiresChoice as { type: string; count: number }) : null,
    featured: p.featured, digital: p.digital, imageUrl: p.imageUrl, imageSlot: p.imageSlot, subPlan: p.subPlan,
    subInterval: p.subInterval, packSize: p.packSize, cardSetId: p.cardSetId,
  };
}

export async function activeProducts(kind?: ProductKind): Promise<PublicProduct[]> {
  try {
    const rows = await prisma.product.findMany({
      where: { active: true, ...(kind ? { kind } : {}) },
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toPublic);
  } catch { return []; }
}

export async function productBySlug(slug: string): Promise<PublicProduct | null> {
  try {
    const p = await prisma.product.findUnique({ where: { slug } });
    return p && p.active ? toPublic(p) : null;
  } catch { return null; }
}

export async function productsByIds(ids: string[]): Promise<Map<string, Product>> {
  if (!ids.length) return new Map();
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, active: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

/* The seven public sample cards (one per category), read from the database
   so titles, text and artwork stay in sync with Admin → Cards. Falls back to
   the design handoff's static samples. */
export async function sampleCards(): Promise<CardData[]> {
  try {
    const rows = await prisma.card.findMany({ where: { code: { in: SAMPLE_CARDS.map((c) => c.code) }, active: true } });
    const byCode = new Map(rows.map((r) => [r.code, r]));
    return SAMPLE_CARDS.map((s) => {
      const r = byCode.get(s.code);
      return r ? { code: r.code, title: r.title, category: r.category as Category, rarity: r.rarity as Rarity, spice: r.spice, time: r.time, text: r.text, art: r.imageUrl ? `/api/cards/art/${r.code}` : null } : s;
    });
  } catch { return SAMPLE_CARDS; }
}

/* Artwork URLs for a list of card codes (only cards whose art has been
   rendered by scripts/import-card-art.mjs). Used by the public pages. */
export async function cardArtMap(codes: string[]): Promise<Record<string, string>> {
  try {
    const rows = await prisma.card.findMany({ where: { code: { in: codes }, imageUrl: { not: null } }, select: { code: true } });
    return Object.fromEntries(rows.map((r) => [r.code, `/api/cards/art/${r.code}`]));
  } catch { return {}; }
}
