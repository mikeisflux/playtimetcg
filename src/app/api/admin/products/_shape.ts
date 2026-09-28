import type { Prisma } from "@/generated/prisma/client";
import { str, optStr, int, bool } from "../_lib";

const KINDS = ["set", "expansion", "digital_pack", "subscription"];

export function productData(b: Record<string, unknown>): Prisma.ProductUncheckedCreateInput {
  const includes = Array.isArray(b.includes) ? (b.includes as unknown[]).map((x) => String(x)).filter(Boolean)
    : typeof b.includes === "string" ? b.includes.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const rc = b.requiresChoice as { type?: string; count?: number } | null | undefined;
  const requiresChoice = rc && rc.type && Number(rc.count) > 0 ? { type: String(rc.type), count: int(rc.count, 1) } : null;
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : "set";
  return {
    slug: str(b.slug, 80).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
    kind,
    name: str(b.name, 160).trim(),
    tag: optStr(b.tag, 80),
    description: optStr(b.description, 20000),
    priceCents: b.priceCents !== undefined ? int(b.priceCents) : Math.round(Number(b.price || 0) * 100),
    currency: str(b.currency, 3).toUpperCase() || "USD",
    accent: str(b.accent, 9) || "#FF5C8A",
    includes,
    requiresChoice: requiresChoice === null ? undefined : requiresChoice,
    featured: bool(b.featured),
    active: b.active === undefined ? true : bool(b.active),
    digital: bool(b.digital) || kind === "digital_pack" || kind === "subscription",
    cardSetId: optStr(b.cardSetId, 40),
    packSize: b.packSize ? int(b.packSize) : null,
    subPlan: kind === "subscription" ? (optStr(b.subPlan, 30) as "monthly_cards" | "online_play" | null) : null,
    subInterval: kind === "subscription" ? (optStr(b.subInterval, 10) || "month") : null,
    imageUrl: optStr(b.imageUrl, 500),
    imageSlot: optStr(b.imageSlot, 80),
    sortIndex: int(b.sortIndex),
  };
}
