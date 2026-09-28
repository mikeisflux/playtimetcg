import { openPack, grantPacks, grantStarterDeck } from "@/lib/packs";
import { prisma } from "@/lib/db";
import { requirePlayer, json, fail, listPacks } from "../_shared";

/* GET: my unopened packs. */
export async function GET() {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  return json({ packs: await listPacks(auth.user.id) });
}

/* POST {packId}: tear one open.
   Admin testing (isAdmin only): {action:"grant", productId} adds a pack free;
   {action:"removeSet", setId} removes that set's cards and unopened packs;
   {action:"reset"} wipes the collection back to the base deck. */
export async function POST(req: Request) {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const body = (await req.json().catch(() => null)) as { packId?: unknown; action?: unknown; productId?: unknown; setId?: unknown } | null;
  if (body && typeof body.action === "string") {
    if (!auth.user.isAdmin) return fail("Admins only.", 403);
    const uid = auth.user.id;
    if (body.action === "grant" && typeof body.productId === "string") {
      await grantPacks(uid, body.productId, 1);
      return json({ ok: true, packs: await listPacks(uid) });
    }
    if (body.action === "removeSet" && typeof body.setId === "string") {
      const [cards, packs] = await Promise.all([
        prisma.userCard.deleteMany({ where: { userId: uid, card: { setId: body.setId } } }),
        prisma.userPack.deleteMany({ where: { userId: uid, setId: body.setId } }),
      ]);
      return json({ ok: true, removedCards: cards.count, removedPacks: packs.count, packs: await listPacks(uid) });
    }
    if (body.action === "reset") {
      await prisma.userCard.deleteMany({ where: { userId: uid } });
      await prisma.userPack.deleteMany({ where: { userId: uid } });
      const granted = await grantStarterDeck(uid);
      return json({ ok: true, granted, packs: await listPacks(uid) });
    }
    return fail("Unknown admin action.");
  }
  if (!body || typeof body.packId !== "string") return fail("Which pack?");
  try {
    const r = await openPack(auth.user.id, body.packId);
    return json({ set: { name: r.set.name, slug: r.set.slug, accent: r.set.accent }, cards: r.cards });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t open that pack.");
  }
}
