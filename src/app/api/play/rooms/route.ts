import { prisma } from "@/lib/db";
import { newGame, randomRoomCode } from "@/lib/game";
import { requirePlayer, json, fail, toJson, isUniqueError } from "../_shared";

/* POST: open a new room. */
export async function POST() {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const { user } = auth;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomRoomCode();
    try {
      const room = await prisma.gameRoom.create({
        data: { code, hostId: user.id, status: "waiting", state: toJson(newGame({ userId: user.id, name: user.name })) },
      });
      return json({ code: room.code });
    } catch (e) {
      if (isUniqueError(e)) continue;
      throw e;
    }
  }
  return fail("Couldn’t find a free room code. Try again.", 500);
}

/* GET: my open rooms (host or guest), newest first. */
export async function GET() {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const { user } = auth;
  const rooms = await prisma.gameRoom.findMany({
    where: { status: { not: "ended" }, OR: [{ hostId: user.id }, { guestId: user.id }] },
    include: { host: { select: { name: true } }, guest: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return json({
    rooms: rooms.map((r) => ({
      code: r.code, status: r.status, createdAt: r.createdAt.toISOString(),
      partner: r.hostId === user.id ? r.guest?.name ?? null : r.host.name,
    })),
  });
}
