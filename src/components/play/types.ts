/* Client-safe types shared by the online play components and API routes. */
import type { Action, GameCardRef, GameState } from "@/lib/game";
import type { CardData, Category, Rarity } from "@/lib/content";

export interface CollectionItem {
  id: string; code: string; title: string; category: string; rarity: string; spice: number; time: string; text: string;
  qty: number; setName: string; setSlug: string; source: string; imageUrl: string | null;
}

export interface PackItem {
  id: string; setName: string; setSlug: string; accent: string; size: number; qty: number; productName: string | null;
}

export interface RoomSummary { code: string; status: string; createdAt: string; partner: string | null }

export interface RoomResponse { version: number; state: GameState; status: string }

/* What the client posts: an Action without userId (the server sets it), and a
   "draw" that only names the count (the server picks the cards). */
type Strip<T> = T extends { userId: string } ? Omit<T, "userId"> : T;
export type ClientAction = Exclude<Strip<Action>, { type: "draw" } | { type: "start" }> | { type: "start" } | { type: "draw" } | { type: "pickAny"; code: string };

export function toCardData(c: GameCardRef | CollectionItem | { code: string; title: string; category: string; rarity: string; spice: number; time: string; text: string; art?: string | null; imageUrl?: string | null }): CardData {
  const art = "art" in c && c.art ? c.art : "imageUrl" in c && c.imageUrl ? `/api/cards/art/${c.code}` : null;
  return { code: c.code, title: c.title, category: c.category as Category, rarity: c.rarity as Rarity, spice: c.spice, time: c.time, text: c.text, art };
}

export const GREY = "#3a363f";
