import { openPack } from "@/lib/packs";
import { requirePlayer, json, fail, listPacks } from "../_shared";

/* GET: my unopened packs. */
export async function GET() {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  return json({ packs: await listPacks(auth.user.id) });
}

/* POST {packId}: tear one open. */
export async function POST(req: Request) {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const body = (await req.json().catch(() => null)) as { packId?: unknown } | null;
  if (!body || typeof body.packId !== "string") return fail("Which pack?");
  try {
    const r = await openPack(auth.user.id, body.packId);
    return json({ set: { name: r.set.name, slug: r.set.slug, accent: r.set.accent }, cards: r.cards });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t open that pack.");
  }
}
