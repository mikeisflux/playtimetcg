import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasOnlineAccess } from "@/lib/packs";
import { publicState } from "@/lib/game";
import { asState, isParticipant, joinRoom } from "@/app/api/play/_shared";
import Room from "@/components/play/Room";

export const metadata: Metadata = { title: "Your room | Play Time", robots: { index: false, follow: false } };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/play/room/${code}`)}`);
  if (!(await hasOnlineAccess(user.id))) redirect("/play");

  let room = await prisma.gameRoom.findUnique({ where: { code } });
  if (!room) notFound();

  let joinError: string | null = null;
  if (!isParticipant(room, user.id)) {
    if (room.status === "waiting" && !room.guestId) {
      const r = await joinRoom(room, { id: user.id, name: user.name });
      if (r.ok) room = r.room; else joinError = r.error;
    } else {
      joinError = room.status === "ended" ? "That night is over." : "That room is full.";
    }
  }

  if (joinError) {
    return (
      <div className="wrap section--tight" style={{ paddingTop: 32 }}>
        <div className="empty">
          <div className="eyebrow">Room {code}</div>
          <h1 className="t-h2m">{joinError}</h1>
          <p className="t-body">Ask your partner for a fresh code, or open a room of your own.</p>
          <div><Link className="btn btn--outline" href="/play">Back to play</Link></div>
        </div>
      </div>
    );
  }

  const state = asState(room.state);
  return (
    <div className="wrap section--tight" style={{ paddingTop: 32 }}>
      <Room code={room.code} user={{ id: user.id, name: user.name }} hostId={room.hostId} initial={publicState(state, user.id)} version={room.version} />
    </div>
  );
}
