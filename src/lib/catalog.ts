/* Product catalog helpers (server). Prices come from the database, seeded
   from design/handoff/content/catalog.json. The $14 expansion price is a
   placeholder the owner has not confirmed — change it in Admin → Products. */
import { prisma } from "./db";
import type { Product } from "@/generated/prisma/client";

export type ProductKind = "set" | "expansion" | "digital_pack" | "subscription";

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

/* Artwork URLs for a list of card codes (only cards whose art has been
   rendered by scripts/import-card-art.mjs). Used by the public pages. */
export async function cardArtMap(codes: string[]): Promise<Record<string, string>> {
  try {
    const rows = await prisma.card.findMany({ where: { code: { in: codes }, imageUrl: { not: null } }, select: { code: true } });
    return Object.fromEntries(rows.map((r) => [r.code, `/api/cards/art/${r.code}`]));
  } catch { return {}; }
}
