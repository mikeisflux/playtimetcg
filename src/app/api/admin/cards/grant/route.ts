import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { grantCards, grantStarterDeck } from "@/lib/packs";
import { guard, bad, readJson, str } from "../../_lib";

export const dynamic = "force-dynamic";

/* { email, cardId? | code?, setId?, starter? } */
export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson<{ email?: string; cardId?: string; code?: string; setId?: string; starter?: boolean }>(req);
  const email = str(b.email, 200).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return bad("No user with that email.");
  let granted = 0;
  if (b.starter) {
    granted = await grantStarterDeck(user.id);
  } else if (b.setId) {
    const cards = await prisma.card.findMany({ where: { setId: b.setId, active: true } });
    granted = (await grantCards(user.id, cards, "admin")).length;
  } else if (b.cardId || b.code) {
    const card = b.cardId ? await prisma.card.findUnique({ where: { id: b.cardId } }) : await prisma.card.findUnique({ where: { code: str(b.code, 20).toUpperCase() } });
    if (!card) return bad("Card not found.");
    granted = (await grantCards(user.id, [card], "admin")).length;
  } else return bad("Nothing to grant.");
  await audit(g.id, "card.grant", "user", user.id, undefined, { cardId: b.cardId, code: b.code, setId: b.setId, starter: b.starter, granted });
  return NextResponse.json({ ok: true, granted, user: { id: user.id, email: user.email } });
}
