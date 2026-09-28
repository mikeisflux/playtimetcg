import type { Prisma } from "@/generated/prisma/client";
import { CATEGORIES } from "@/lib/content";
import { str, optStr, int, bool } from "../_lib";

export function cardData(b: Record<string, unknown>): Prisma.CardUncheckedCreateInput {
  const category = CATEGORIES.find((c) => c.toLowerCase() === str(b.category).trim().toLowerCase()) ?? "Soft Touch";
  const rarityRaw = str(b.rarity).trim().toLowerCase();
  const rarity = rarityRaw === "rare" ? "Rare" : rarityRaw === "uncommon" ? "Uncommon" : "Common";
  return {
    code: str(b.code, 20).trim().toUpperCase(),
    setId: str(b.setId, 40),
    title: str(b.title, 120).trim(),
    category, rarity,
    spice: Math.min(5, Math.max(1, int(b.spice, 1))),
    time: str(b.time, 40).trim() || "5 min",
    text: str(b.text, 4000).trim(),
    imageUrl: optStr(b.imageUrl, 500),
    active: b.active === undefined ? true : bool(b.active),
    sortIndex: int(b.sortIndex),
  };
}

export function setData(b: Record<string, unknown>): Prisma.CardSetUncheckedCreateInput {
  const kind = ["base", "expansion", "monthly", "promo"].includes(String(b.kind)) ? String(b.kind) : "expansion";
  const rd = b.releaseDate ? new Date(String(b.releaseDate)) : null;
  return {
    slug: str(b.slug, 60).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
    name: str(b.name, 120).trim(),
    kind,
    accent: str(b.accent, 9) || "#FF5C8A",
    releaseDate: rd && !Number.isNaN(rd.getTime()) ? rd : null,
    sortIndex: int(b.sortIndex),
  };
}
