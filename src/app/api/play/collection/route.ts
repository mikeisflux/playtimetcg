import { requirePlayer, json, collectionFor } from "../_shared";

/* GET: my collection, with card + set details. */
export async function GET() {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  return json(await collectionFor(auth.user.id));
}
