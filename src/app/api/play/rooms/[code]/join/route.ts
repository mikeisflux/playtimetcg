import { prisma } from "@/lib/db";
import { requirePlayer, json, fail, joinRoom } from "../../../_shared";

/* POST: join a waiting room by code. */
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const { code } = await params;
  const room = await prisma.gameRoom.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) return fail("No room with that code.", 404);
  const r = await joinRoom(room, { id: auth.user.id, name: auth.user.name });
  if (!r.ok) return fail(r.error);
  return json({ code: r.room.code });
}
