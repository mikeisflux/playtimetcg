import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { json, fail, joinRoom, createGuestUser } from "../../../_shared";

/* POST {name?}: join a waiting room by code. No subscription needed — the
   host's deck is the night's deck. Not signed in? Send a display name and
   you're in as a guest. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await prisma.gameRoom.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) return fail("No room with that code.", 404);
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  let user = await getSessionUser();
  if (!user) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("Tell your partner who you are — enter a name.", 401);
    if (room.status !== "waiting" || room.guestId) return fail(room.status === "ended" ? "That night is over." : "That room is full.");
    user = await createGuestUser(name);
  }
  const r = await joinRoom(room, { id: user.id, name: user.name });
  if (!r.ok) return fail(r.error);
  return json({ code: r.room.code });
}
